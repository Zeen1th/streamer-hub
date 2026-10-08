using StreamerHub.Core.Twitch;

namespace StreamerHub.Core.Host;

public sealed record ParsedChatCommand(string Name, IReadOnlyList<string> Args, string RawArgs);

public sealed record ChatCommandResult(bool Handled, bool Ok, string Message);

/// <summary>
/// Runs the "/timeout user 10m" style commands typed into the streamer's chat box (OBS dock and the Chat tab).
/// Text that does not start with a single "/" is not ours and is sent to chat as usual.
/// </summary>
public sealed class ChatCommandProcessor
{
    public const int DefaultTimeoutSeconds = 600;
    public const int MaxTimeoutSeconds = 14 * 24 * 60 * 60;

    private readonly ITwitchClient _twitch;
    private readonly Func<string, string> _resolveTarget;
    private readonly Func<bool> _isArabic;

    public ChatCommandProcessor(ITwitchClient twitch, Func<string, string> resolveTarget, Func<bool> isArabic)
    {
        _twitch = twitch;
        _resolveTarget = resolveTarget;
        _isArabic = isArabic;
    }

    /// <summary>"/to @bob 5m spam" -> name "to", args ["@bob","5m","spam"]. Null when the text is not a command.</summary>
    public static ParsedChatCommand? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var trimmed = text.Trim();
        // "//" and a lone "/" are ordinary text (e.g. a pasted path or emoticon)
        if (trimmed.Length < 2 || trimmed[0] != '/' || trimmed[1] == '/' || char.IsWhiteSpace(trimmed[1])) return null;

        var space = trimmed.IndexOfAny(new[] { ' ', '\t' });
        var name = (space < 0 ? trimmed[1..] : trimmed[1..space]).ToLowerInvariant();
        var rawArgs = space < 0 ? string.Empty : trimmed[(space + 1)..].Trim();
        var args = rawArgs.Length == 0
            ? Array.Empty<string>()
            : rawArgs.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
        return new ParsedChatCommand(name, args, rawArgs);
    }

    /// <summary>"90", "90s", "10m", "2h", "1d" -> seconds (null when it is not a duration).</summary>
    public static int? ParseDuration(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim().ToLowerInvariant();
        var multiplier = 1;
        switch (text[^1])
        {
            case 's': text = text[..^1]; break;
            case 'm': multiplier = 60; text = text[..^1]; break;
            case 'h': multiplier = 3600; text = text[..^1]; break;
            case 'd': multiplier = 86400; text = text[..^1]; break;
        }
        if (!int.TryParse(text, out var amount) || amount <= 0) return null;
        var seconds = (long)amount * multiplier;
        return (int)Math.Min(seconds, MaxTimeoutSeconds);
    }

    public static string CleanUser(string value) => value.Trim().TrimStart('@').TrimEnd(',', ':', ';');

    public async Task<ChatCommandResult> ExecuteAsync(string? text, CancellationToken cancellationToken = default)
    {
        var command = Parse(text);
        if (command is null) return new ChatCommandResult(false, true, string.Empty);

        if (command.Name is "help" or "commands" or "?")
        {
            return Done(true, Tr(
                "Commands: /timeout user [10m] [reason], /untimeout, /ban user [reason], /unban, /clear, /mod, /unmod, /vip, /unvip, /shoutout user",
                "الأوامر: /timeout مستخدم [10m] [السبب]، /untimeout، /ban مستخدم [السبب]، /unban، /clear، /mod، /unmod، /vip، /unvip، /shoutout مستخدم"));
        }

        if (_twitch.State != TwitchState.Connected)
        {
            return Done(false, Tr("Twitch chat is not connected.", "الشات غير متصل بتويتش."));
        }

        if (command.Name == "clear")
        {
            var result = await _twitch.ClearChatAsync(cancellationToken).ConfigureAwait(false);
            return Finish(result.Ok, result.Error, Tr("Chat cleared.", "تم مسح الشات."));
        }

        switch (command.Name)
        {
            case "timeout" or "to":
            case "untimeout" or "unban" or "ban":
            case "mod" or "unmod" or "vip" or "unvip":
            case "shoutout" or "so":
                break;
            default:
                return Done(false, Tr($"Unknown command /{command.Name}. Type /help for the list.", $"أمر غير معروف /{command.Name}. اكتب /help للقائمة."));
        }

        if (command.Args.Count == 0)
        {
            return Done(false, Tr($"/{command.Name} needs a username, e.g. /{command.Name} somebody", $"/{command.Name} يحتاج اسم مستخدم، مثال: /{command.Name} فلان"));
        }

        var user = CleanUser(command.Args[0]);
        if (user.Length == 0)
        {
            return Done(false, Tr("That is not a valid username.", "اسم المستخدم غير صالح."));
        }
        var target = _resolveTarget(user);

        switch (command.Name)
        {
            case "timeout" or "to":
            {
                var seconds = command.Args.Count > 1 ? ParseDuration(command.Args[1]) : DefaultTimeoutSeconds;
                if (seconds is null)
                {
                    return Done(false, Tr("Use a duration like 90, 10m, 2h or 1d.", "استخدم مدة مثل 90 أو 10m أو 2h أو 1d."));
                }
                var reasonStart = command.Args.Count > 1 && ParseDuration(command.Args[1]) is not null ? 2 : 1;
                var reason = command.Args.Count > reasonStart ? string.Join(' ', command.Args.Skip(reasonStart)) : null;
                var result = await _twitch.TimeoutUserAsync(target, seconds.Value, reason, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"Timed out @{user} for {FormatDuration(seconds.Value)}.", $"تم إسكات @{user} لمدة {FormatDuration(seconds.Value)}."));
            }
            case "untimeout" or "unban":
            {
                var result = await _twitch.UnbanUserAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"Removed the timeout/ban on @{user}.", $"تمت إزالة الإسكات/الحظر عن @{user}."));
            }
            case "ban":
            {
                var reason = command.Args.Count > 1 ? string.Join(' ', command.Args.Skip(1)) : null;
                var result = await _twitch.BanUserAsync(target, reason, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"Banned @{user}.", $"تم حظر @{user}."));
            }
            case "mod":
            {
                var result = await _twitch.ModUserAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"@{user} is now a moderator.", $"@{user} أصبح مشرفاً."));
            }
            case "unmod":
            {
                var result = await _twitch.UnmodUserAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"@{user} is no longer a moderator.", $"@{user} لم يعد مشرفاً."));
            }
            case "vip":
            {
                var result = await _twitch.VipUserAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"@{user} is now a VIP.", $"@{user} أصبح VIP."));
            }
            case "unvip":
            {
                var result = await _twitch.UnvipUserAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"@{user} is no longer a VIP.", $"@{user} لم يعد VIP."));
            }
            default: // shoutout / so
            {
                var result = await _twitch.SendShoutoutAsync(target, cancellationToken).ConfigureAwait(false);
                return Finish(result.Ok, result.Error, Tr($"Shouted out @{user}.", $"تم عمل شوت أوت لـ @{user}."));
            }
        }
    }

    public static string FormatDuration(int seconds)
    {
        if (seconds % 86400 == 0) return $"{seconds / 86400}d";
        if (seconds % 3600 == 0) return $"{seconds / 3600}h";
        if (seconds % 60 == 0) return $"{seconds / 60}m";
        return $"{seconds}s";
    }

    private string Tr(string en, string ar) => _isArabic() ? ar : en;

    private static ChatCommandResult Done(bool ok, string message) => new(true, ok, message);

    private ChatCommandResult Finish(bool ok, string? error, string success) =>
        ok ? Done(true, success) : Done(false, Tr($"Failed: {error ?? "unknown error"}", $"فشل: {error ?? "خطأ غير معروف"}"));
}
