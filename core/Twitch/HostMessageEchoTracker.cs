namespace StreamerHub.Core.Twitch;

/// <summary>
/// Tracks messages sent by the local host (broadcaster or bot) and matches incoming
/// Twitch IRC PRIVMSG echoes so that host-sent messages are not published twice to
/// logs, frontend events, or overlay feeds.
/// </summary>
public sealed class HostMessageEchoTracker
{
    private sealed class SentHostMessage
    {
        public string SenderLogin { get; init; } = string.Empty;
        public string MessageText { get; init; } = string.Empty;
        public DateTime SentAt { get; init; } = DateTime.UtcNow;
    }

    private readonly List<SentHostMessage> _recentMessages = new();
    private readonly object _lock = new();
    private readonly TimeSpan _window;

    public HostMessageEchoTracker(TimeSpan? window = null)
    {
        _window = window ?? TimeSpan.FromSeconds(25);
    }

    public int TrackedCount
    {
        get
        {
            lock (_lock)
            {
                Prune_NoLock(DateTime.UtcNow);
                return _recentMessages.Count;
            }
        }
    }

    /// <summary>
    /// Records a message that was successfully sent to Twitch IRC by the local client.
    /// </summary>
    public void TrackSent(string senderLogin, string messageText, DateTime? sentAt = null)
    {
        if (string.IsNullOrWhiteSpace(senderLogin) || string.IsNullOrWhiteSpace(messageText))
            return;

        var cleanSender = senderLogin.Trim().ToLowerInvariant();
        var cleanText = messageText.Trim();
        var now = sentAt ?? DateTime.UtcNow;

        lock (_lock)
        {
            Prune_NoLock(now);
            _recentMessages.Add(new SentHostMessage
            {
                SenderLogin = cleanSender,
                MessageText = cleanText,
                SentAt = now
            });
        }
    }

    /// <summary>
    /// Checks whether an incoming IRC message matches a recently sent local message from the host.
    /// If a match is found, it is consumed (removed from the tracker) and this returns true.
    /// </summary>
    public bool IsEchoAndConsume(string senderLogin, string messageText, string? channelLogin = null, string? botLogin = null, DateTime? nowTime = null)
    {
        if (string.IsNullOrWhiteSpace(senderLogin) || string.IsNullOrWhiteSpace(messageText))
            return false;

        var cleanSender = senderLogin.Trim().ToLowerInvariant();
        var cleanText = messageText.Trim();
        var cleanChannel = channelLogin?.Trim().ToLowerInvariant();
        var cleanBot = botLogin?.Trim().ToLowerInvariant();
        var now = nowTime ?? DateTime.UtcNow;

        lock (_lock)
        {
            Prune_NoLock(now);

            var idx = _recentMessages.FindIndex(m =>
            {
                if (!string.Equals(m.MessageText, cleanText, StringComparison.Ordinal))
                    return false;

                // Direct sender match (e.g. "streamer" == "streamer" or "mybot" == "mybot")
                if (string.Equals(m.SenderLogin, cleanSender, StringComparison.OrdinalIgnoreCase))
                    return true;

                // If tracked as channel alias and incoming sender is channel login
                if (!string.IsNullOrEmpty(cleanChannel) &&
                    string.Equals(cleanSender, cleanChannel, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(m.SenderLogin, cleanChannel, StringComparison.OrdinalIgnoreCase))
                    return true;

                // If tracked as bot alias and incoming sender is bot login
                if (!string.IsNullOrEmpty(cleanBot) &&
                    string.Equals(cleanSender, cleanBot, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(m.SenderLogin, cleanBot, StringComparison.OrdinalIgnoreCase))
                    return true;

                return false;
            });

            if (idx >= 0)
            {
                _recentMessages.RemoveAt(idx);
                return true;
            }

            return false;
        }
    }

    private void Prune_NoLock(DateTime now)
    {
        _recentMessages.RemoveAll(m => (now - m.SentAt) > _window || m.SentAt > now + TimeSpan.FromMinutes(1));
    }
}
