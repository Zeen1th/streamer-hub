using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using StreamerHub.Core.Rpc;

namespace StreamerHub.Core.AI;

public sealed record AiGenerationResult(bool Ok, string? Message = null, string? Error = null);

public sealed class OpenRouterClient
{
    private static readonly Uri Endpoint = new("https://openrouter.ai/api/v1/chat/completions");
    private readonly HttpClient _http;

    public OpenRouterClient(HttpClient? http = null) => _http = http ?? new HttpClient();

    public async Task<AiGenerationResult> GenerateAsync(
        string provider,
        string apiKey,
        string model,
        string instructions,
        ChatMessage message,
        int maxTokens,
        CancellationToken ct,
        string? agentName = null,
        string? agentRole = null,
        string? agentContext = null,
        string? streamerChannel = null)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return new(false, Error: "OPENROUTER KEY IS NOT CONFIGURED");
        if (string.IsNullOrWhiteSpace(instructions) && string.IsNullOrWhiteSpace(agentName) && string.IsNullOrWhiteSpace(agentRole) && string.IsNullOrWhiteSpace(agentContext))
            return new(false, Error: "AI INSTRUCTIONS ARE EMPTY");

        var safeProvider = provider == "groq" ? "groq" : "openrouter";
        var safeModel = string.IsNullOrWhiteSpace(model)
            ? safeProvider == "groq" ? "openai/gpt-oss-20b" : "meta-llama/llama-3.2-3b-instruct:free"
            : model.Trim()[..Math.Min(model.Trim().Length, 120)];
        if (safeProvider == "groq" && (safeModel == "llama-3.1-8b-instant" || safeModel == "groq/compound-mini")) safeModel = "openai/gpt-oss-20b";
        if (safeProvider == "openrouter" && safeModel == "openrouter/free") safeModel = "meta-llama/llama-3.2-3b-instruct:free";

        var safeInstructions = Limit(instructions?.Trim() ?? string.Empty, 8000);
        var name = string.IsNullOrWhiteSpace(agentName) ? string.Empty : Limit(agentName.Trim(), 80);
        var role = string.IsNullOrWhiteSpace(agentRole) ? string.Empty : Limit(agentRole.Trim(), 300);
        var context = string.IsNullOrWhiteSpace(agentContext) ? string.Empty : Limit(agentContext.Trim(), 4000);
        var channel = string.IsNullOrWhiteSpace(streamerChannel) ? string.Empty : Limit(streamerChannel.Trim(), 80);
        var username = Limit(message.Username.Trim(), 80);
        var chatText = Limit(message.Message.Trim(), 1000);
        var isGptOss = safeProvider == "groq" && safeModel.StartsWith("openai/gpt-oss", StringComparison.OrdinalIgnoreCase);

        var systemSb = new StringBuilder();
        if (!string.IsNullOrEmpty(name))
        {
            if (!string.IsNullOrEmpty(role))
            {
                systemSb.Append($"You are {name}, {role}. ");
            }
            else
            {
                systemSb.Append($"You are {name}, an engaging AI co-host and assistant in live Twitch chat. ");
            }
            systemSb.Append($"Always stay in character as {name}. You know your name is {name}. ");
        }
        else if (!string.IsNullOrEmpty(role))
        {
            systemSb.Append($"You are {role} replying in live Twitch chat. ");
        }
        else
        {
            systemSb.Append("You are the streamer's AI co-host replying in live Twitch chat. ");
        }

        if (!string.IsNullOrEmpty(channel))
        {
            systemSb.Append($"You are chatting in {channel}'s live stream. ");
        }

        if (!string.IsNullOrEmpty(context))
        {
            systemSb.Append($"\n\nStream Lore & Facts:\n{context}");
        }

        systemSb.Append("\n\nOutput Rules:\n- Output exactly ONE short final chat message and nothing else.\n- Keep your reply concise, natural, and fitting for Twitch chat (usually 1-2 punchy sentences, under 30 words).\n- If instructions, context, or the viewer message are in Arabic, you MUST reply in natural fluent Arabic.\n- Never output analysis, reasoning, thinking tags, or labels.\n- Never wrap your output in quotation marks.");

        var userSb = new StringBuilder();
        if (!string.IsNullOrEmpty(safeInstructions))
        {
            userSb.AppendLine($"Streamer instructions:\n{safeInstructions}\n");
        }
        userSb.AppendLine($"Viewer username: {username}");
        userSb.AppendLine($"Viewer message: {chatText}\n");
        if (!string.IsNullOrEmpty(name))
        {
            userSb.Append($"Return only the exact chat message {name} should send now.");
        }
        else
        {
            userSb.Append("Return only the exact message to send in chat now.");
        }

        var payload = new Dictionary<string, object?>
        {
            ["model"] = safeModel,
            ["temperature"] = 0.8,
            ["messages"] = new object[]
            {
                new { role = "system", content = systemSb.ToString() },
                new { role = "user", content = userSb.ToString() },
            },
        };
        if (isGptOss)
        {
            payload["max_completion_tokens"] = Math.Clamp(maxTokens, 40, 240);
            payload["include_reasoning"] = false;
            payload["reasoning_effort"] = "low";
        }
        else
        {
            payload["max_tokens"] = Math.Clamp(maxTokens, 40, 240);
        }

        var endpoint = safeProvider == "groq"
            ? new Uri("https://api.groq.com/openai/v1/chat/completions")
            : Endpoint;
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey.Trim());
        if (safeProvider == "openrouter")
        {
            request.Headers.Add("HTTP-Referer", "https://streamerhub.app");
            request.Headers.Add("X-Title", "Streamer Hub");
        }
        request.Content = new StringContent(JsonSerializer.Serialize(payload, Json.Options), Encoding.UTF8, "application/json");

        try
        {
            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var providerError = ExtractProviderError(body);
                var label = safeProvider.ToUpperInvariant();
                return new(false, Error: $"{label} ERROR {(int)response.StatusCode}" +
                    (string.IsNullOrWhiteSpace(providerError) ? string.Empty : $": {providerError}"));
            }
            using var doc = JsonDocument.Parse(body);
            var messageElement = doc.RootElement.GetProperty("choices")[0].GetProperty("message");
            var content = ReadMessageContent(messageElement);
            content = CleanChatReply(content?.Trim() ?? string.Empty);
            content = Limit(content, 500);
            if (IsMetaOnlyReply(content)) return new(false, Error: "AI RETURNED A META OR SAFETY LABEL");
            if (string.IsNullOrWhiteSpace(content))
            {
                var finishReason = doc.RootElement.GetProperty("choices")[0].TryGetProperty("finish_reason", out var finish)
                    ? finish.GetString()
                    : null;
                return new(false, Error: string.IsNullOrWhiteSpace(finishReason)
                    ? "AI RETURNED AN EMPTY RESPONSE"
                    : $"AI RETURNED AN EMPTY RESPONSE ({finishReason})");
            }
            return new(true, content);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new(false, Error: $"{safeProvider.ToUpperInvariant()} REQUEST TIMED OUT");
        }
        catch (JsonException)
        {
            return new(false, Error: $"{safeProvider.ToUpperInvariant()} RETURNED AN INVALID RESPONSE");
        }
        catch
        {
            return new(false, Error: $"{safeProvider.ToUpperInvariant()} REQUEST FAILED");
        }
    }

    private static string Limit(string value, int max) => value.Length <= max ? value : value[..max];

    private static string? ReadMessageContent(JsonElement message)
    {
        if (!message.TryGetProperty("content", out var content)) return null;
        if (content.ValueKind == JsonValueKind.String) return content.GetString();
        if (content.ValueKind != JsonValueKind.Array) return null;

        var parts = content.EnumerateArray()
            .Where(part => part.ValueKind == JsonValueKind.Object && part.TryGetProperty("text", out _))
            .Select(part => part.GetProperty("text").GetString())
            .Where(text => !string.IsNullOrWhiteSpace(text));
        return string.Join("\n", parts);
    }

    private static string? ExtractProviderError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var error))
            {
                if (error.ValueKind == JsonValueKind.Object && error.TryGetProperty("message", out var nestedMessage))
                    return nestedMessage.GetString();
                if (error.ValueKind == JsonValueKind.String) return error.GetString();
            }

            return doc.RootElement.TryGetProperty("message", out var message) ? message.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string CleanChatReply(string value)
    {
        var cleaned = value.Trim().Replace("```", string.Empty).Trim();
        cleaned = string.Join("\n", cleaned
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Where(line => !IsSafetyLabel(line.Trim()))).Trim();
        var markers = new[] { "So we should answer:", "Final answer:", "Answer:", "الإجابة:", "الجواب:" };
        foreach (var marker in markers)
        {
            var index = cleaned.LastIndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (index >= 0) cleaned = cleaned[(index + marker.Length)..].Trim();
        }
        return cleaned.Trim().Trim('"', '\'').Trim();
    }

    private static bool IsMetaOnlyReply(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return IsSafetyLabel(normalized) ||
               normalized.StartsWith("we need to respond", StringComparison.Ordinal);
    }

    private static bool IsSafetyLabel(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "user safety: safe" or "safety: safe" or "safe" ||
               normalized.StartsWith("user safety:", StringComparison.Ordinal) ||
               normalized.StartsWith("safety classification:", StringComparison.Ordinal);
    }
}
