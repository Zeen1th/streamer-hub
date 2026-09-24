using System.Text.Json;
using System.Text.RegularExpressions;

namespace StreamerHub.Core.AI;

public static class LiveInfoHelper
{
    private static readonly HttpClient Http = new()
    {
        Timeout = TimeSpan.FromSeconds(3)
    };

    static LiveInfoHelper()
    {
        Http.DefaultRequestHeaders.Add("User-Agent", "StreamerHub/1.0 (Twitch Streamer Assistant; Live Data Fetcher)");
    }

    public static async Task<string?> TryFetchLiveContextAsync(string message, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(message)) return null;

        try
        {
            var weatherCtx = await TryFetchWeatherAsync(message, ct).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(weatherCtx)) return weatherCtx;

            var searchCtx = await TryFetchWebSearchAsync(message, ct).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(searchCtx)) return searchCtx;
        }
        catch
        {
            // Fail-safe: never fail AI reply if external live lookup fails
        }

        return null;
    }

    private static async Task<string?> TryFetchWeatherAsync(string message, CancellationToken ct)
    {
        var city = ExtractCity(message);
        if (string.IsNullOrWhiteSpace(city)) return null;

        var geoCity = city.Trim().Equals("Hail", StringComparison.OrdinalIgnoreCase) ? "Ha'il" : city;
        var geoUrl = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(geoCity)}&count=5&language=ar&format=json";
        using var geoRes = await Http.GetAsync(geoUrl, ct).ConfigureAwait(false);
        if (!geoRes.IsSuccessStatusCode) return null;

        var geoBody = await geoRes.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var geoDoc = JsonDocument.Parse(geoBody);
        if (!geoDoc.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
            return null;

        var first = results[0];
        long maxPop = -1;
        foreach (var item in results.EnumerateArray())
        {
            var pop = item.TryGetProperty("population", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt64() : 0;
            var cc = item.TryGetProperty("country_code", out var cCode) ? cCode.GetString() : null;
            if (string.Equals(cc, "SA", StringComparison.OrdinalIgnoreCase))
            {
                first = item;
                break;
            }
            if (pop > maxPop)
            {
                maxPop = pop;
                first = item;
            }
        }
        var name = first.GetProperty("name").GetString() ?? city;
        var country = first.TryGetProperty("country", out var c) ? c.GetString() ?? string.Empty : string.Empty;
        var lat = first.GetProperty("latitude").GetDouble();
        var lon = first.GetProperty("longitude").GetDouble();

        var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto";
        using var weatherRes = await Http.GetAsync(weatherUrl, ct).ConfigureAwait(false);
        if (!weatherRes.IsSuccessStatusCode) return null;

        var weatherBody = await weatherRes.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var wDoc = JsonDocument.Parse(weatherBody);
        if (!wDoc.RootElement.TryGetProperty("current", out var current)) return null;

        var temp = current.GetProperty("temperature_2m").GetDouble();
        var hum = current.GetProperty("relative_humidity_2m").GetInt32();
        var wind = current.GetProperty("wind_speed_10m").GetDouble();
        var code = current.GetProperty("weather_code").GetInt32();
        var (condAr, condEn) = GetWeatherCondition(code);

        return $"[معلومات الطقس الحية اللحظية الآن / Real-Time Live Weather Data]:\n" +
               $"- المدينة / Location: {name} {(string.IsNullOrWhiteSpace(country) ? string.Empty : $"({country})")}\n" +
               $"- درجة الحرارة / Temperature: {temp:F1}°C ({temp * 9 / 5 + 32:F1}°F)\n" +
               $"- حالة الطقس / Condition: {condAr} ({condEn})\n" +
               $"- نسبة الرطوبة / Humidity: {hum}%\n" +
               $"- سرعة الرياح / Wind Speed: {wind:F1} km/h";
    }

    private static async Task<string?> TryFetchWebSearchAsync(string message, CancellationToken ct)
    {
        var query = ExtractSearchQuery(message);
        if (string.IsNullOrWhiteSpace(query)) return null;

        // 1. Try DuckDuckGo Lite via POST
        try
        {
            using var ddgReq = new HttpRequestMessage(HttpMethod.Post, "https://lite.duckduckgo.com/lite/")
            {
                Content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("q", query) })
            };
            using var ddgRes = await Http.SendAsync(ddgReq, ct).ConfigureAwait(false);
            if (ddgRes.IsSuccessStatusCode)
            {
                var html = await ddgRes.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                var matches = Regex.Matches(html, @"class=['""]result-snippet['""][^>]*>([\s\S]*?)<\/td>", RegexOptions.IgnoreCase);
                if (matches.Count > 0)
                {
                    var snippets = new List<string>();
                    for (int i = 0; i < Math.Min(2, matches.Count); i++)
                    {
                        var text = Regex.Replace(matches[i].Groups[1].Value, @"<[^>]+>", " ");
                        text = System.Net.WebUtility.HtmlDecode(text).Trim();
                        text = Regex.Replace(text, @"\s+", " ");
                        if (!string.IsNullOrWhiteSpace(text) && text.Length > 15)
                        {
                            snippets.Add(text);
                        }
                    }

                    if (snippets.Count > 0)
                    {
                        return $"[نتائج البحث الحي من الإنترنت / Real-Time Live Web Search]:\n" +
                               $"- استعلام البحث / Query: {query}\n" +
                               $"- الملخص / Summary:\n- " + string.Join("\n- ", snippets);
                    }
                }
            }
        }
        catch
        {
            // Fall through to Wikipedia
        }

        // 2. Wikipedia Instant Knowledge Fallback
        try
        {
            var isArabic = Regex.IsMatch(query, @"[\u0600-\u06FF]");
            var lang = isArabic ? "ar" : "en";
            var wikiUrl = $"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={Uri.EscapeDataString(query)}&utf8=&format=json&srlimit=2";
            using var wikiRes = await Http.GetAsync(wikiUrl, ct).ConfigureAwait(false);
            if (wikiRes.IsSuccessStatusCode)
            {
                var wikiBody = await wikiRes.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                using var doc = JsonDocument.Parse(wikiBody);
                if (doc.RootElement.TryGetProperty("query", out var qElem) &&
                    qElem.TryGetProperty("search", out var searchList) &&
                    searchList.GetArrayLength() > 0)
                {
                    var wikiSnippets = new List<string>();
                    foreach (var item in searchList.EnumerateArray())
                    {
                        var title = item.TryGetProperty("title", out var t) ? t.GetString() : null;
                        var rawSnippet = item.TryGetProperty("snippet", out var s) ? s.GetString() : null;
                        if (!string.IsNullOrWhiteSpace(rawSnippet))
                        {
                            var text = Regex.Replace(rawSnippet, @"<[^>]+>", " ");
                            text = System.Net.WebUtility.HtmlDecode(text).Trim();
                            text = Regex.Replace(text, @"\s+", " ");
                            if (!string.IsNullOrWhiteSpace(text) && text.Length > 15)
                            {
                                wikiSnippets.Add(string.IsNullOrWhiteSpace(title) ? text : $"{title}: {text}");
                            }
                        }
                    }

                    if (wikiSnippets.Count > 0)
                    {
                        return $"[نتائج البحث المعرفي المباشر / Real-Time Knowledge Search]:\n" +
                               $"- استعلام البحث / Query: {query}\n" +
                               $"- الملخص / Summary:\n- " + string.Join("\n- ", wikiSnippets);
                    }
                }
            }
        }
        catch
        {
            // Live search failed safely
        }

        return null;
    }

    private static string? ExtractCity(string message)
    {
        var patterns = new[]
        {
            @"(?:درجة\s+الحرارة|حرارة|الطقس|الجو|كم\s+درجة)\s+(?:في|بـ|ب)\s+([^\s؟?,\.!]+)",
            @"(?:كيف\s+الجو|كيف\s+الطقس)\s+(?:في|بـ|ب)?\s*([^\s؟?,\.!]+)",
            @"(?:weather|temperature|temp)\s+(?:in|of|for|at)\s+([a-zA-Z\s]+?)(?:\?|\.|\!|\s+today|\s+now|\s+right now|$)",
            @"(?:how(?:'s| is) the weather in)\s+([a-zA-Z\s]+?)(?:\?|\.|\!|\s+today|\s+now|\s+right now|$)"
        };

        foreach (var p in patterns)
        {
            var match = Regex.Match(message, p, RegexOptions.IgnoreCase);
            if (match.Success && match.Groups[1].Value.Trim().Length > 0)
            {
                var city = match.Groups[1].Value.Trim();
                city = Regex.Replace(city, @"(?i)(اليوم|الان|الآن|حاليا|حالياً|right now|today|now)$", "").Trim();
                city = city.Trim('؟', '?', '.', '!', ',', '؛');
                if (city.Length >= 2) return city;
            }
        }

        return null;
    }

    private static string? ExtractSearchQuery(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return null;

        // 1. Strip persona callouts: "اروديس", "يا اروديس", "@bot", etc.
        var cleaned = Regex.Replace(message.Trim(), @"^(@\w+|اروديس|أروديس|يا\s+اروديس|يا\s+أروديس|يا\s+بوت|بوت|arrodes)\s*[,:،\-]?\s*", "", RegexOptions.IgnoreCase).Trim();

        // 2. Ignore pure conversational greetings and opinion inquiries
        var ignorePatterns = new[]
        {
            @"^(كيفك|كيف\s+حالك|شلونك|اخبارك|أخبارك|علومك|how\s+are\s+you|how\s+r\s+u|what's\s+up|sup|hello|hi|هلا|مرحبا|سلام)\s*[؟?\s!.]*$",
            @"(?:وش\s*رأيك|وش\s*رايك|ما\s*رأيك|ما\s*رايك|ايش\s*رايك|ايش\s*رأيك|what\s+do\s+you\s+think)"
        };
        foreach (var pattern in ignorePatterns)
        {
            if (Regex.IsMatch(cleaned, pattern, RegexOptions.IgnoreCase)) return null;
        }

        // 3. Explicit search command
        var explicitMatch = Regex.Match(cleaned, @"(?:ابحث\s+عن|ابحث\s+لي\s+عن|دور\s+على|دور\s+لي\s+على|search\s+for|search\s+web\s+for|google|lookup)\s+(.+)", RegexOptions.IgnoreCase);
        if (explicitMatch.Success && explicitMatch.Groups[1].Value.Trim().Length >= 3)
        {
            return explicitMatch.Groups[1].Value.Trim().Trim('؟', '?', '.', '!', ',', '؛');
        }

        // 4. Common information lookup patterns
        var infoPatterns = new[]
        {
            @"(?:كم\s+سعر|سعر|price\s+of|current\s+price\s+of)\s+(.+)",
            @"(?:من\s+فاز|مين\s+فاز|نتيجة\s+مباراة|who\s+won)\s+(.+)",
            @"(?:متى\s+ينزل|متى\s+تنزل|متى\s+موعد|متى\s+تاريخ|موعد\s+نزول|when\s+will|when\s+does|release\s+date\s+of)\s+(.+)",
            @"(?:من\s+هو|من\s+هي|مين\s+هو|مين\s+هي|who\s+is|who\s+was)\s+(.+)",
            @"(?:آخر\s+أخبار|اخر\s+اخبار|وش\s+جديد|ما\s+جديد|latest\s+news\s+about|news\s+on)\s+(.+)",
            @"(?:ما\s+هي\s+عاصمة|ما\s+عاصمة|what\s+is\s+the\s+capital\s+of)\s+(.+)"
        };
        foreach (var pattern in infoPatterns)
        {
            var match = Regex.Match(cleaned, pattern, RegexOptions.IgnoreCase);
            if (match.Success && match.Groups[1].Value.Trim().Length >= 2)
            {
                return cleaned.Trim('؟', '?', '.', '!', ',', '؛');
            }
        }

        // 5. If it ends with ? / ؟ and has at least 3 words
        if (Regex.IsMatch(cleaned, @"[?؟]$"))
        {
            var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length >= 3)
            {
                return cleaned.Trim('؟', '?', '.', '!', ',', '؛');
            }
        }

        return null;
    }

    private static (string Ar, string En) GetWeatherCondition(int code) => code switch
    {
        0 => ("صحو (صافي)", "Clear sky"),
        1 => ("صحو غالباً", "Mainly clear"),
        2 => ("غائم جزئياً", "Partly cloudy"),
        3 => ("غائم", "Overcast"),
        45 or 48 => ("ضباب", "Fog"),
        51 or 53 or 55 => ("رذاذ مطر خفيف", "Drizzle"),
        61 or 63 or 65 => ("أمطار", "Rain"),
        71 or 73 or 75 => ("ثلوج", "Snow"),
        77 => ("حبات ثلجية", "Snow grains"),
        80 or 81 or 82 => ("زخات مطر", "Rain showers"),
        85 or 86 => ("زخات ثلوج", "Snow showers"),
        95 or 96 or 99 => ("عواصف رعدية", "Thunderstorm"),
        _ => ("معتدل", "Moderate")
    };
}
