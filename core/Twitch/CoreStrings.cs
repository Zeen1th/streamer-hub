namespace StreamerHub.Core.Twitch;

public static class CoreStrings
{
    private static readonly Dictionary<string, string> En = new()
    {
        ["core-started"] = "CORE STARTED",
        ["state-prefix"] = "TWITCH STATE: ",
        ["state-connecting"] = "CONNECTING",
        ["state-connected"] = "CONNECTED",
        ["state-reconnecting"] = "RECONNECTING",
        ["state-authfailed"] = "AUTH FAILED",
        ["state-stopped"] = "STOPPED",
        ["state-disconnected"] = "DISCONNECTED",
        ["chat-joined"] = "CHAT JOINED #{0} — COMMANDS ARE LIVE",
        ["notice"] = "TWITCH NOTICE",
        ["messages-flowing"] = "CHAT MESSAGES FLOWING",
        ["connect-failed"] = "TWITCH CHAT CONNECT FAILED",
        ["auth-failed"] = "TWITCH SAYS: LOGIN AUTHENTICATION FAILED",
        ["login-in-progress"] = "TWITCH LOGIN ALREADY IN PROGRESS",
        ["opening-login"] = "OPENING TWITCH LOGIN IN YOUR BROWSER…",
        ["port-busy"] = "PORT 8787 IS IN USE — CLOSE OTHER STREAMER HUB INSTANCES",
        ["login-not-completed"] = "TWITCH LOGIN NOT COMPLETED",
        ["exchange-failed"] = "TWITCH AUTH EXCHANGE FAILED · ",
        ["linked"] = "TWITCH LINKED · STORING LOGIN…",
        ["login-forgotten"] = "TWITCH LOGIN FORGOTTEN",
        ["clientid-missing"] = "TWITCH CLIENT ID NOT CONFIGURED — ADD IT IN APP SETTINGS",
        ["refresh-failed"] = "TWITCH TOKEN REFRESH FAILED — CLICK THE TWITCH CHIP TO RECONNECT",
        ["token-invalid"] = "TWITCH TOKEN INVALID — CLICK THE TWITCH CHIP TO RECONNECT",
        ["chat-relayed"] = "CHAT RELAYED · ",
    };

    private static readonly Dictionary<string, string> Ar = new()
    {
        ["core-started"] = "بدأت النواة",
        ["state-prefix"] = "حالة تويتش: ",
        ["state-connecting"] = "جارٍ الاتصال",
        ["state-connected"] = "متصل",
        ["state-reconnecting"] = "إعادة اتصال",
        ["state-authfailed"] = "فشل المصادقة",
        ["state-stopped"] = "متوقف",
        ["state-disconnected"] = "غير متصل",
        ["chat-joined"] = "انضممت إلى دردشة #{0} — الأوامر تعمل الآن",
        ["notice"] = "تنبيه تويتش",
        ["messages-flowing"] = "رسائل الدردشة تتدفق",
        ["connect-failed"] = "فشل الاتصال بدردشة تويتش",
        ["auth-failed"] = "تويتش: فشلت المصادقة",
        ["login-in-progress"] = "تسجيل الدخول جارٍ بالفعل",
        ["opening-login"] = "جارٍ فتح تسجيل الدخول في متصفحك…",
        ["port-busy"] = "المنفذ 8787 مشغول — أغلق أي نسخة أخرى من التطبيق",
        ["login-not-completed"] = "لم يكتمل تسجيل الدخول",
        ["exchange-failed"] = "فشل تبادل المصادقة · ",
        ["linked"] = "تم الربط مع تويتش · جارٍ حفظ الدخول…",
        ["login-forgotten"] = "أُزيل تسجيل دخول تويتش",
        ["clientid-missing"] = "معرّف العميل غير مضبوط — أضفه في الإعدادات",
        ["refresh-failed"] = "فشل تجديد الرمز — انقر على شارة تويتش لإعادة الاتصال",
        ["token-invalid"] = "الرمز غير صالح — انقر على شارة تويتش لإعادة الاتصال",
        ["chat-relayed"] = "تم تمرير الدردشة · ",
    };

    public static string L(string language, string key)
    {
        var table = language == "ar" ? Ar : En;
        return table.TryGetValue(key, out var value) ? value : key;
    }

    public static string LF(string language, string key, string arg0)
    {
        var template = L(language, key);
        return template.Contains("{0}", StringComparison.Ordinal) ? template.Replace("{0}", arg0) : template + " " + arg0;
    }

    public static string StateName(string language, TwitchState state) => state switch
    {
        TwitchState.Connecting => L(language, "state-connecting"),
        TwitchState.Connected => L(language, "state-connected"),
        TwitchState.Reconnecting => L(language, "state-reconnecting"),
        TwitchState.AuthFailed => L(language, "state-authfailed"),
        TwitchState.Stopped => L(language, "state-stopped"),
        _ => L(language, "state-disconnected"),
    };
}
