namespace StreamerHub.Core.Twitch;

public sealed record TwitchUserProfileResult(string UserId, string? AvatarUrl, bool ShouldLogFailure);

public sealed class TwitchUserProfileCache
{
    private const int HelixMaxBatchSize = 100;

    /// <summary>
    /// How long a failed lookup is remembered before it is retried.
    ///
    /// Without this, one transient Helix error would cache a null permanently
    /// and that viewer would have no avatar until the app restarted.
    /// </summary>
    private static readonly TimeSpan NegativeCacheTtl = TimeSpan.FromMinutes(5);

    private readonly record struct CacheEntry(string? AvatarUrl, DateTimeOffset ResolvedAt);

    private readonly Dictionary<string, CacheEntry> _avatarUrls = new(StringComparer.Ordinal);
    private readonly object _cacheLock = new();
    private readonly HashSet<string> _loggedFailures = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _resolveLock = new(1, 1);
    private readonly int _maxBatchSize;
    private readonly Func<DateTimeOffset> _clock;

    public TwitchUserProfileCache(int maxBatchSize = HelixMaxBatchSize, Func<DateTimeOffset>? clock = null)
    {
        if (maxBatchSize is < 1 or > HelixMaxBatchSize)
        {
            throw new ArgumentOutOfRangeException(nameof(maxBatchSize), $"Batch size must be between 1 and {HelixMaxBatchSize}.");
        }

        _maxBatchSize = maxBatchSize;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public bool TryGet(string userId, out string? avatarUrl)
    {
        avatarUrl = null;
        if (string.IsNullOrWhiteSpace(userId)) return false;

        lock (_cacheLock)
        {
            if (!_avatarUrls.TryGetValue(userId.Trim(), out var entry)) return false;
            if (IsExpired(entry)) return false;
            avatarUrl = entry.AvatarUrl;
            return true;
        }
    }

    /// <summary>Successful lookups are kept indefinitely; failures expire so they are retried.</summary>
    private bool IsExpired(CacheEntry entry) =>
        entry.AvatarUrl is null && _clock() - entry.ResolvedAt >= NegativeCacheTtl;

    public async Task<IReadOnlyList<TwitchUserProfileResult>> ResolveAsync(
        IEnumerable<string> userIds,
        Func<IReadOnlyList<string>, CancellationToken, Task<IReadOnlyDictionary<string, string?>>> fetchAsync,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        ArgumentNullException.ThrowIfNull(fetchAsync);

        var requestedIds = userIds
            .Where(userId => !string.IsNullOrWhiteSpace(userId))
            .Select(userId => userId.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        if (requestedIds.Length == 0) return Array.Empty<TwitchUserProfileResult>();

        await _resolveLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            string[] missingIds;
            lock (_cacheLock)
            {
                missingIds = requestedIds
                    .Where(userId => !_avatarUrls.TryGetValue(userId, out var entry) || IsExpired(entry))
                    .ToArray();
            }
            foreach (var batch in missingIds.Chunk(_maxBatchSize))
            {
                cancellationToken.ThrowIfCancellationRequested();
                IReadOnlyDictionary<string, string?> resolved;
                try
                {
                    resolved = await fetchAsync(batch, cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    resolved = new Dictionary<string, string?>(StringComparer.Ordinal);
                }

                var now = _clock();
                lock (_cacheLock)
                {
                    foreach (var userId in batch)
                    {
                        var avatarUrl = resolved.TryGetValue(userId, out var candidate) && !string.IsNullOrWhiteSpace(candidate)
                            ? candidate
                            : null;
                        _avatarUrls[userId] = new CacheEntry(avatarUrl, now);
                    }
                }
            }

            lock (_cacheLock)
            {
                return requestedIds
                    .Select(userId =>
                    {
                        var avatarUrl = _avatarUrls.TryGetValue(userId, out var entry) ? entry.AvatarUrl : null;
                        var shouldLogFailure = avatarUrl is null && _loggedFailures.Add(userId);
                        return new TwitchUserProfileResult(userId, avatarUrl, shouldLogFailure);
                    })
                    .ToArray();
            }
        }
        finally
        {
            _resolveLock.Release();
        }
    }
}
