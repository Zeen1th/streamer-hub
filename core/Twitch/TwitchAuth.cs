using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace StreamerHub.Core.Twitch;

public sealed record TwitchTokens
{
    [JsonPropertyName("access_token")] public string AccessToken { get; init; } = string.Empty;
    [JsonPropertyName("refresh_token")] public string RefreshToken { get; init; } = string.Empty;
    [JsonPropertyName("expires_at")] public DateTime ExpiresAtUtc { get; init; }
    [JsonPropertyName("login")] public string? Login { get; init; }
}

public sealed record TwitchDeviceCode
{
    [JsonPropertyName("device_code")] public string DeviceCode { get; init; } = string.Empty;
    [JsonPropertyName("expires_in")] public int ExpiresIn { get; init; }
    [JsonPropertyName("interval")] public int Interval { get; init; } = 5;
    [JsonPropertyName("user_code")] public string UserCode { get; init; } = string.Empty;
    [JsonPropertyName("verification_uri")] public string VerificationUri { get; init; } = string.Empty;
}

public static class TwitchConstants
{
    public const string ClientId = "n2vystw7pymd6owm06wahn67hgr08z";
    public const string RedirectUri = "http://localhost:8787/oauth";
    public const string Scopes = "chat:read chat:edit channel:manage:broadcast";
    public const string IrcHost = "irc.chat.twitch.tv";
    public const int IrcPort = 6697;
}

public static class TwitchAuth
{
    private static readonly HttpClient Http = new();

    public static (string Verifier, string Challenge) CreatePkcePair()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        var verifier = Base64Url(bytes);
        var challengeBytes = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
        return (verifier, Base64Url(challengeBytes));
    }

    public static string BuildAuthorizeUrl(string clientId, string codeChallenge)
    {
        var scope = Uri.EscapeDataString(TwitchConstants.Scopes);
        return "https://id.twitch.tv/oauth2/authorize" +
               $"?client_id={clientId}" +
               $"&redirect_uri={Uri.EscapeDataString(TwitchConstants.RedirectUri)}" +
               "&response_type=code" +
               $"&scope={scope}" +
               "&force_verify=false" +
               "&code_challenge_method=S256" +
               $"&code_challenge={codeChallenge}";
    }

    public static async Task<(TwitchTokens? Tokens, string? Error)> ExchangeCodeAsync(string clientId, string clientSecret, string code, string verifier, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = TwitchConstants.RedirectUri,
            ["code_verifier"] = verifier,
        };
        if (!string.IsNullOrWhiteSpace(clientSecret)) form["client_secret"] = clientSecret;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://id.twitch.tv/oauth2/token")
        {
            Content = new FormUrlEncodedContent(form),
        };
        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            return (null, $"{response.StatusCode} {Truncate(body)}");
        }
        var tokens = await ParseTokenResponseAsync(response, ct).ConfigureAwait(false);
        return tokens is null ? (null, "TOKEN RESPONSE COULD NOT BE PARSED") : (tokens, null);
    }

    public static async Task<TwitchTokens?> RefreshAsync(string clientId, string clientSecret, string refreshToken, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken,
        };
        if (!string.IsNullOrWhiteSpace(clientSecret)) form["client_secret"] = clientSecret;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://id.twitch.tv/oauth2/token")
        {
            Content = new FormUrlEncodedContent(form),
        };
        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return null;
        return await ParseTokenResponseAsync(response, ct).ConfigureAwait(false);
    }

    public static async Task<string?> ValidateLoginAsync(string accessToken, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://id.twitch.tv/oauth2/validate");
        request.Headers.TryAddWithoutValidation("Authorization", $"OAuth {accessToken}");
        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false));
        return doc.RootElement.TryGetProperty("login", out var login)
            ? login.GetString()?.ToLowerInvariant()
            : null;
    }

    public static void OpenBrowser(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            try
            {
                Process.Start(new ProcessStartInfo("cmd", $"/c start \"\" \"{url}\"") { CreateNoWindow = true });
            }
            catch
            {
            }
        }
    }

    public static async Task<(string? Code, string? Error)> ListenForCodeAsync(CancellationToken ct)
    {
        const string successHtml =
            "<!doctype html><html><head><meta charset=\"utf-8\"><title>Streamer Hub</title></head>" +
            "<body style=\"background:#e8e2d2;color:#241b13;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;\">" +
            "<div style=\"text-align:center;\"><div style=\"font-size:28px;letter-spacing:0.08em;\">CONNECTED · تم الربط</div>" +
            "<div style=\"margin-top:12px;opacity:0.75;\">Twitch is linked to Streamer Hub — you can close this tab.</div>" +
            "<div style=\"margin-top:6px;opacity:0.75;\">تم ربط تويتش مع Streamer Hub — يمكنك إغلاق هذا التبويب.</div></div>" +
            "</body></html>";

        TcpListener listener;
        try
        {
            listener = new TcpListener(IPAddress.Loopback, 8787);
            listener.Start();
        }
        catch (SocketException)
        {
            return (null, "PORT 8787 IS IN USE — CLOSE OTHER STREAMER HUB INSTANCES");
        }

        try
        {
            while (!ct.IsCancellationRequested)
            {
                TcpClient client;
                try
                {
                    client = await listener.AcceptTcpClientAsync(ct).ConfigureAwait(false);
                }
                catch
                {
                    return (null, null);
                }

                using (client)
                {
                    client.ReceiveTimeout = 5000;
                    using var reader = new StreamReader(client.GetStream(), Encoding.ASCII, false, 1024, leaveOpen: true);
                    var requestLine = await reader.ReadLineAsync().ConfigureAwait(false);
                    if (requestLine is null) continue;
                    var parts = requestLine.Split(' ');
                    if (parts.Length < 2) continue;
                    var pathAndQuery = parts[1];
                    var queryIndex = pathAndQuery.IndexOf('?');
                    var path = queryIndex >= 0 ? pathAndQuery[..queryIndex] : pathAndQuery;
                    if (path.Equals("/oauth", StringComparison.OrdinalIgnoreCase) && queryIndex >= 0)
                    {
                        var code = ExtractQueryParam(pathAndQuery[(queryIndex + 1)..], "code");
                        await WriteResponseAsync(client, "200 OK", successHtml).ConfigureAwait(false);
                        return (code, null);
                    }
                    await WriteResponseAsync(client, "404 Not Found", "<html><body>Not found</body></html>").ConfigureAwait(false);
                }
            }
            return (null, null);
        }
        finally
        {
            listener.Stop();
        }
    }

    public static async Task<(TwitchDeviceCode? Device, string? Error)> RequestDeviceCodeAsync(string clientId, CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["scopes"] = TwitchConstants.Scopes,
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://id.twitch.tv/oauth2/device")
        {
            Content = new FormUrlEncodedContent(form),
        };
        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode) return (null, $"{response.StatusCode} {Truncate(body)}");
        try
        {
            var device = JsonSerializer.Deserialize<TwitchDeviceCode>(body);
            return device is null || string.IsNullOrWhiteSpace(device.DeviceCode) ? (null, "DEVICE CODE RESPONSE COULD NOT BE PARSED") : (device, null);
        }
        catch (JsonException)
        {
            return (null, "DEVICE CODE RESPONSE COULD NOT BE PARSED");
        }
    }

    public static async Task<(TwitchTokens? Tokens, string? Error)> PollDeviceCodeAsync(string clientId, TwitchDeviceCode device, CancellationToken ct = default)
    {
        var interval = Math.Max(5, device.Interval);
        var deadline = DateTime.UtcNow.AddSeconds(Math.Max(60, device.ExpiresIn));
        while (DateTime.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(interval), ct).ConfigureAwait(false);
            var form = new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["device_code"] = device.DeviceCode,
                ["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code",
            };
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://id.twitch.tv/oauth2/token")
            {
                Content = new FormUrlEncodedContent(form),
            };
            using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                var tokens = await ParseTokenResponseAsync(response, ct).ConfigureAwait(false);
                return tokens is null ? (null, "TOKEN RESPONSE COULD NOT BE PARSED") : (tokens, null);
            }

            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            var message = ExtractErrorMessage(body);
            if (message == "authorization_pending") continue;
            if (message == "slow_down") { interval += 5; continue; }
            return (null, Truncate(body));
        }
        return (null, "TWITCH DEVICE LOGIN EXPIRED OR WAS CANCELLED");
    }

    private static async Task WriteResponseAsync(TcpClient client, string status, string html)
    {
        var body = Encoding.UTF8.GetBytes(html);
        var header = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {body.Length}\r\nConnection: close\r\n\r\n");
        var stream = client.GetStream();
        await stream.WriteAsync(header).ConfigureAwait(false);
        await stream.WriteAsync(body).ConfigureAwait(false);
        await stream.FlushAsync().ConfigureAwait(false);
    }

    private static string? ExtractQueryParam(string query, string key)
    {
        foreach (var pair in query.Split('&'))
        {
            var eq = pair.IndexOf('=');
            if (eq < 0) continue;
            if (string.Equals(pair[..eq], key, StringComparison.OrdinalIgnoreCase))
                return Uri.UnescapeDataString(pair[(eq + 1)..]);
        }
        return null;
    }

    private static string Truncate(string value)
    {
        value = value.Replace('\n', ' ').Replace('\r', ' ').Trim();
        return value.Length <= 180 ? value : value[..180];
    }

    private static string? ExtractErrorMessage(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("message", out var message) ? message.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static async Task<TwitchTokens?> ParseTokenResponseAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        if (!root.TryGetProperty("access_token", out var access)) return null;
        var expiresIn = root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 14400;
        var refresh = root.TryGetProperty("refresh_token", out var refEl) ? refEl.GetString() : string.Empty;
        return new TwitchTokens
        {
            AccessToken = access.GetString() ?? string.Empty,
            RefreshToken = refresh ?? string.Empty,
            ExpiresAtUtc = DateTime.UtcNow.AddSeconds(expiresIn),
        };
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
