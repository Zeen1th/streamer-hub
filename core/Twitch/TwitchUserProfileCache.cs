namespace StreamerHub.Core.Twitch;

public sealed record TwitchUserProfileResult(string UserId, string? AvatarUrl, bool ShouldLogFailure);

public sealed class TwitchUserProfileCache
{
    private const int HelixMaxBatchSize = 100;
    private readonly Dictionary<string, string?> _avatarUrls = new(StringComparer.Ordinal);
    private readonly object _cacheLock = new();
    private readonly HashSet<string> _loggedFailures = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim _resolveLock = new(1, 1);
    private readonly int _maxBatchSize;

    public TwitchUserProfileCache(int maxBatchSize = HelixMaxBatchSize)
    {
        if (maxBatchSize is < 1 or > HelixMaxBatchSize)
        {
            throw new ArgumentOutOfRangeException(nameof(maxBatchSize), $"Batch size must be between 1 and {HelixMaxBatchSize}.");
        }

        _maxBatchSize = maxBatchSize;
    }

    public bool TryGet(string userId, out string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            avatarUrl = null;
            return false;
        }

        lock (_cacheLock)
        {
            return _avatarUrls.TryGetValue(userId.Trim(), out avatarUrl);
        }
    }

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
                missingIds = requestedIds.Where(userId => !_avatarUrls.ContainsKey(userId)).ToArray();
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

                lock (_cacheLock)
                {
                    foreach (var userId in batch)
                    {
                        _avatarUrls[userId] = resolved.TryGetValue(userId, out var avatarUrl) && !string.IsNullOrWhiteSpace(avatarUrl)
                            ? avatarUrl
                            : null;
                    }
                }
            }

            lock (_cacheLock)
            {
                return requestedIds
                    .Select(userId =>
                    {
                        var avatarUrl = _avatarUrls[userId];
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
