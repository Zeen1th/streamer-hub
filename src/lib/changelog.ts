/**
 * What's New content shown after an update, bundled with the app so it works offline and in
 * the user's language. EVERY RELEASE MUST ADD AN ENTRY HERE (changelog.test.mjs enforces that the
 * entry for the package version exists and is bilingual).
 */
export interface ChangelogSection {
  /** New features and improvements. */
  added: string[];
  /** Bug fixes. */
  fixed: string[];
}

export interface ChangelogEntry {
  version: string;
  en: ChangelogSection;
  ar: ChangelogSection;
}

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.4.28',
    en: {
      added: [
        'Command profiles. A profile is a full set of commands (counters, replies, sequences and keybinds). Switch between them at any time from the profile picker on the Commands page, and add, duplicate, rename or delete profiles there. Logins, overlays and stats stay the same in every profile. Your current commands become your first profile, nothing is replaced.',
        'A ready-made Starter profile: !clip, !so with the raider clip on screen (and !so skip), a raid welcome, !duel, a death counter with !death and !deathset, !discord, !socials and !schedule replies to fill in, and a hydrate reminder every 30 minutes.',
        'One timeout step can now hit several viewers. In a Timeout or Smart Timeout step, set "Viewers per use" above 1 and a channel points redeem like "@a @b @c" times out each of them.',
        '!so skip stops the shoutout clip that is playing. In the Show Clip step you choose who can use it (the viewer who started it and mods, mods only, everyone, or nobody) and can change the command.',
        'Reset everything (Settings > System): a red button that puts the whole app back to default after three "are you sure" steps. A backup is made first, and your Twitch and OBS logins are kept.',
        'A guided tour of the basics for new users, and "See how it works" buttons with short videos on the more complicated features.',
      ],
      fixed: [
        'After a smart timeout, a lead moderator only gets the normal mod role back, because Twitch does not let apps give Lead back. The app now shows you a reminder with a button to open Twitch Roles Manager, instead of a log line nobody could read.',
        'Arabic text order in the leaderboard duel record and in sequence step summaries.',
      ],
    },
    ar: {
      added: [
        'ملفات الأوامر. الملف مجموعة كاملة من الأوامر (العدّادات والردود والمتسلسلات والاختصارات). بدّل بينها في أي وقت من قائمة الملفات في صفحة الأوامر، وأضف أو انسخ أو أعد تسمية أو احذف الملفات من هناك. تسجيلات الدخول والأوفرلاي والإحصائيات نفسها في كل الملفات. أوامرك الحالية تصبح ملفك الأول، ولا يُستبدل شيء.',
        'ملف "البداية" الجاهز: ‎!clip‎، و‎!so‎ مع عرض مقطع من قناة الرايدر (و‎!so skip‎)، وترحيب بالرايد، و‎!duel‎، وعدّاد موت مع ‎!death‎ و‎!deathset‎، وردود ‎!discord‎ و‎!socials‎ و‎!schedule‎ لتعبئتها، وتذكير بشرب الماء كل 30 دقيقة.',
        'خطوة تايم آوت واحدة يمكنها الآن إسكات عدة مشاهدين. في خطوة التايم آوت أو التايم آوت الذكي اجعل "عدد المشاهدين في كل مرة" أكثر من 1، فيُسكت استبدال نقاط القناة مثل "@a @b @c" كل واحد منهم.',
        '‎!so skip‎ يوقف مقطع الشوت أوت المعروض. في خطوة عرض المقطع تختار من يستطيع استخدامه (المشاهد الذي طلبه والمشرفون، أو المشرفون فقط، أو الجميع، أو لا أحد) ويمكنك تغيير الأمر.',
        'إعادة ضبط كل شيء (الإعدادات > النظام): زر أحمر يُرجع التطبيق كله للوضع الافتراضي بعد ثلاث خطوات "هل أنت متأكد". تُحفظ نسخة احتياطية أولاً، ويبقى تسجيل دخولك لتويتش وOBS.',
        'جولة إرشادية للأساسيات للمستخدمين الجدد، وأزرار "شاهد كيف يعمل" بفيديوهات قصيرة للميزات الأصعب.',
      ],
      fixed: [
        'بعد التايم آوت الذكي، يعود المشرف الرئيسي برتبة المشرف العادي فقط، لأن تويتش لا يسمح للتطبيقات بإرجاع الرتبة الرئيسية. يعرض التطبيق الآن تذكيراً مع زر يفتح مدير الأدوار في تويتش، بدل سطر في السجل لم يكن مفهوماً.',
        'ترتيب النص العربي في سجل التحديات في لوحة الصدارة وفي ملخصات خطوات المتسلسلات.',
      ],
    },
  },
  {
    version: '0.4.27',
    en: {
      added: [
        'Chat overlay filters can now let single messages through. The new "Always show these messages" list (Chat Overlay > Filters) takes a message you copy from chat and paste in. That message is shown even when its sender is hidden, so Nightbot can stay hidden while one of its lines still appears. The text must match exactly (capitals and extra spaces do not matter), or end with * to match the start of a message.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'يمكن الآن لفلاتر أوفرلاي الشات أن تسمح برسائل محددة. قائمة "أظهر هذه الرسائل دائماً" الجديدة (أوفرلاي الشات > الفلاتر) تأخذ رسالة تنسخها من الشات وتلصقها. تظهر هذه الرسالة حتى لو كان مرسلها مخفياً، فيبقى Nightbot مخفياً بينما يظهر سطر واحد منه. يجب أن يتطابق النص تماماً (الأحرف الكبيرة والمسافات الزائدة لا تهم)، أو يُنهى بـ * ليطابق بداية الرسالة.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.26',
    en: {
      added: [],
      fixed: [
        'Stream Pulse now follows your real stream. The On air time starts when Twitch says you went live (not when you open the app), shows a dash while you are offline, and nothing is counted in Stream Pulse or the leaderboards while the channel is offline. A new live stream starts a fresh "this stream" automatically.',
        'The streamer is fully removed from the leaderboards (the "Include me" option is gone), together with the app bot account and known bots. What the app itself says in chat is no longer counted as messages.',
        'The clips leaderboard was wrong: a clip made through a chat command was credited to a made-up "streamer" user instead of the viewer who asked for it. Clips now count for the right viewer. Duel wins and losses also land on the viewer\'s own row instead of a second row under their display name.',
        'A sequence started by a chat command now gets only what follows the command as {input} (it used to get the whole message, command included, when the trigger was set up in the Triggers list), and it works for every command of a trigger that has more than one.',
      ],
    },
    ar: {
      added: [],
      fixed: [
        'أصبح Stream Pulse يتبع بثك الحقيقي. وقت "على الهواء" يبدأ عندما تقول تويتش إنك بدأت البث (وليس عند فتح التطبيق)، ويظهر شرطة عندما تكون غير مباشر، ولا يُحتسب شيء في Stream Pulse أو لوحات المتصدرين والقناة غير مباشرة. وكل بث جديد يبدأ "هذا البث" من الصفر تلقائياً.',
        'أُزيل الستريمر تماماً من لوحات المتصدرين (اختفى خيار "أضفني")، ومعه حساب البوت الخاص بالتطبيق والبوتات المعروفة. وما ينشره التطبيق نفسه في الشات لم يعد يُحسب كرسائل.',
        'كانت لوحة المقاطع خاطئة: المقطع الذي يُصنع بأمر شات كان يُنسب إلى مستخدم وهمي اسمه "streamer" بدل المشاهد الذي طلبه. الآن تُحسب المقاطع للمشاهد الصحيح. كما أن انتصارات وخسائر المبارزات تذهب إلى صف المشاهد نفسه بدل صف ثانٍ باسم العرض.',
        'التسلسل الذي يبدأ بأمر شات صار يحصل على ما بعد الأمر فقط في {input} (كان يحصل على الرسالة كاملة مع الأمر عندما يكون المشغّل في قائمة المشغّلات)، ويعمل ذلك مع كل أمر من المشغّل الذي له أكثر من أمر.',
      ],
    },
  },
  {
    version: '0.4.25',
    en: {
      added: [
        'You can now share your commands and settings. Settings > System & Window Behavior has a new "Share commands and settings" card. Export saves your counters, replies, sequences and chat overlay looks to a file you can give to another streamer. Import adds a file someone gave you. Nothing private is in the file: no Twitch or OBS login, no counter numbers, no keybinds.',
        'Importing is safe for what you already have. Nothing of yours is changed or replaced, a backup of your current settings is made first (you can bring it back from Settings > Backups), things you already have are skipped, and imported replies and sequences arrive switched off so you can check them before they start answering in chat. If an imported counter uses a command you already use, you are told which one.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'يمكنك الآن مشاركة أوامرك وإعداداتك. في الإعدادات > النظام والنافذة بطاقة جديدة "مشاركة الأوامر والإعدادات". التصدير يحفظ عدّاداتك وردودك وتسلسلاتك وأشكال أوفرلاي الشات في ملف تعطيه لستريمر آخر. والاستيراد يضيف ملفاً أعطاك إياه أحد. لا يوجد في الملف أي شيء خاص: لا تسجيل دخول تويتش أو OBS ولا أرقام العدّادات ولا اختصارات لوحة المفاتيح.',
        'الاستيراد آمن على ما لديك. لا يتغيّر ولا يُستبدل أي شيء عندك، وتُؤخذ نسخة احتياطية من إعداداتك الحالية أولاً (ويمكنك إرجاعها من الإعدادات > النسخ الاحتياطية)، ويُتخطى ما لديك أصلاً، وتصل الردود والتسلسلات المستوردة مُوقَفة لتراجعها قبل أن تبدأ بالرد في الشات. وإذا استخدم عدّاد مستورد أمراً تستخدمه أصلاً فستعرف أيّ أمر.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.24',
    en: {
      added: [
        'A chat trigger can now have more than one command. In the Twitch Chat trigger of a sequence, use "Add another command" so for example !so and !shoutout both start the same action. Existing triggers keep their command.',
      ],
      fixed: [
        'Smart timeout no longer posts "[Moderation] Restored moderator privileges for ..." in chat when it gives moderator back. It is only noted in the app log now.',
        'Trivia duels no longer read their own chat lines (such as the question) as a player answering, which could end a duel with the wrong winner announced.',
      ],
    },
    ar: {
      added: [
        'يمكن الآن أن يكون لمشغّل الشات أكثر من أمر. في مشغّل شات تويتش داخل التسلسل اضغط "أضف أمراً آخر" ليشغّل مثلاً !so و !shoutout الإجراء نفسه. المشغّلات الحالية تحتفظ بأمرها.',
      ],
      fixed: [
        'لم يعد الإسكات الذكي ينشر "[Moderation] Restored moderator privileges for ..." في الشات عند إعادة الإشراف. يُسجَّل في سجل التطبيق فقط.',
        'لم تعد مبارزات الأسئلة تعتبر رسائل التطبيق نفسه في الشات (مثل السؤال) إجابة من لاعب، وهذا كان قد ينهي المبارزة بإعلان فائز خاطئ.',
      ],
    },
  },
  {
    version: '0.4.23',
    en: {
      added: [
        'The clip command now tells chat when a clip is made, instead of working silently. The "Create a Clip for the Viewer" step posts a message with the clip link as soon as it exists, for example "@viewer clipped that! Clip #3: link". You can rewrite the message (use {username}, {clip_url} and {clip_count}) or turn it off in the step. The Clip Command preset is now just this one step. Commands you already built that post the link with their own chat step keep working and do not post twice.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'أمر المقطع الآن يخبر الشات عند إنشاء المقطع بدل أن يعمل بصمت. خطوة "إنشاء مقطع للمشاهد" تنشر رسالة فيها رابط المقطع فور إنشائه، مثل "@مشاهد صنع مقطعاً! المقطع رقم 3: الرابط". ويمكنك تعديل الرسالة (استخدم {username} و {clip_url} و {clip_count}) أو إيقافها من الخطوة. وقالب أمر المقطع أصبح هذه الخطوة وحدها. والأوامر التي بنيتها سابقاً وتنشر الرابط بخطوة شات خاصة تبقى تعمل ولا تنشر مرتين.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.22',
    en: {
      added: [
        'A counter\'s settings are now all inside the counter. Open a counter and a new "Writes to" section holds the OBS text file, the Twitch stream title and the keyboard shortcut, instead of a hidden "More settings" in the side panel.',
        'You can now choose exactly what the counter writes to its OBS text file. Type your own text, for example "The deaths counter are: {counter}", with clickable pieces ({count} or {counter} for the number, {name} for the counter\'s name, {username} for the last person who changed it), ready-made examples, and a live preview of what will be written. A new line in the box is a new line in the file. The stream title text accepts the same pieces. Counters you already have keep their current text.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'أصبحت كل إعدادات العدّاد داخل العدّاد نفسه. افتح أي عدّاد وستجد قسماً جديداً "يكتب إلى" يضم الملف النصي لـ OBS وعنوان البث على تويتش واختصار لوحة المفاتيح، بدل "المزيد من الإعدادات" المخفية في اللوحة الجانبية.',
        'يمكنك الآن اختيار ما يكتبه العدّاد في ملفه النصي بالضبط. اكتب نصك الخاص، مثلاً "عدّاد الوفيات هو: {counter}"، مع أجزاء قابلة للضغط ({count} أو {counter} للرقم، و {name} لاسم العدّاد، و {username} لآخر شخص غيّره)، وأمثلة جاهزة، ومعاينة مباشرة لما سيُكتب. السطر الجديد في الصندوق سطر جديد في الملف. ونص عنوان البث يقبل الأجزاء نفسها. العدّادات الموجودة عندك تحتفظ بنصها الحالي.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.21',
    en: {
      added: [
        'Counters can now be set to an exact number from chat. In a counter\'s Actions page there is a new "Set to a number" command: turn it on, pick the word (for example !set), and typing !set 6000 makes the counter exactly 6000. It is off by default and limited to mods, and you can change who may use it and add a cooldown. Only whole numbers work (Arabic digits like ٦٠٠٠ and 6,000 are fine); anything else is ignored.',
      ],
      fixed: [
        'Ctrl+Z (undo) and Ctrl+Y (redo) did nothing while the keyboard was on the Arabic layout. They now work on any layout, and so do the Ctrl + / Ctrl - / Ctrl 0 zoom shortcuts and undo in the chat overlay editor and the reply box.',
      ],
    },
    ar: {
      added: [
        'يمكن الآن تعيين العدّاد إلى رقم محدد من الشات. في صفحة إجراءات العدّاد أمر جديد "تعيين إلى رقم": فعّله واختر الكلمة (مثلاً !set)، وكتابة !set 6000 تجعل العدّاد 6000 بالضبط. هو متوقف افتراضياً ومخصص للمشرفين، ويمكنك تغيير من يستطيع استخدامه وإضافة وقت انتظار. تعمل الأرقام الصحيحة فقط (والأرقام العربية مثل ٦٠٠٠ و 6,000 مقبولة)، وأي شيء آخر يُتجاهل.',
      ],
      fixed: [
        'كان Ctrl+Z (تراجع) و Ctrl+Y (إعادة) لا يعملان عندما تكون لوحة المفاتيح على اللغة العربية. الآن يعملان على أي لغة، وكذلك اختصارات التكبير Ctrl + / Ctrl - / Ctrl 0 والتراجع في محرر أوفرلاي الشات وصندوق الرد.',
      ],
    },
  },
  {
    version: '0.4.20',
    en: {
      added: [
        'The clip command can now be customized: the clip title (use {username} to put the viewer\'s name in it, so you can tell who made each clip on Twitch), the clip length from 5 to 60 seconds, and an option to include your stream delay. The Test button now reports clearly what happened.',
      ],
      fixed: [
        'The clip command did nothing visible while you were live: the clip was made on Twitch, but the app gave up waiting after 8 seconds and treated it as a failure, so no link was posted and the viewer was not credited. It now waits long enough, posts the link, and counts the clip for the viewer.',
      ],
    },
    ar: {
      added: [
        'أصبح أمر المقطع قابلاً للتخصيص: عنوان المقطع (استخدم {username} لوضع اسم المشاهد فيه لتعرف من صنع كل مقطع في تويتش)، وطول المقطع من 5 إلى 60 ثانية، وخيار لتضمين تأخير البث. وزر التجربة يوضح الآن ما حدث بدقة.',
      ],
      fixed: [
        'أمر المقطع لم يكن يُظهر شيئاً أثناء البث المباشر: كان المقطع يُصنع في تويتش لكن التطبيق يتوقف عن الانتظار بعد 8 ثوانٍ ويعتبره فشلاً، فلا يُنشر الرابط ولا يُحسب المقطع للمشاهد. الآن ينتظر المدة الكافية وينشر الرابط ويحسب المقطع للمشاهد.',
      ],
    },
  },
  {
    version: '0.4.19',
    en: {
      added: [
        'Clips now have their own OBS browser source (Clip Overlay), separate from the pictures and GIFs source. Add http://127.0.0.1:49178/clip-overlay.html as a Browser Source in OBS (1920 x 1080) and turn on "Control audio via OBS" to hear clips. You can now place and layer clips independently, for example above your chat. The URL is in Settings > OBS and in the clip sub-action editor. Until you add it, clips keep playing on the pictures and GIFs source, so nothing you set up breaks.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'أصبح للمقاطع مصدر متصفح خاص بها في OBS (أوفرلاي المقاطع)، منفصل عن مصدر الصور والـ GIF. أضف الرابط http://127.0.0.1:49178/clip-overlay.html كـ Browser Source في OBS بدقة 1920 × 1080 وفعّل "Control audio via OBS" لسماع المقاطع. يمكنك الآن ترتيب المقاطع ووضعها بشكل مستقل، مثلاً فوق الشات. الرابط في الإعدادات > OBS وفي نافذة إجراء المقطع. وإلى أن تضيفه تستمر المقاطع بالعمل على مصدر الصور والـ GIF، فلا ينكسر شيء مما أعددته.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.18',
    en: {
      added: [],
      fixed: [
        'Pictures and GIFs showed up twice in OBS when you had both the chat overlay and the image overlay added: once on the image overlay and again on top of the chat overlay. Now they appear only on the image overlay. If you have no image overlay in OBS, they still show on the chat overlay as before.',
      ],
    },
    ar: {
      added: [],
      fixed: [
        'كانت الصور والـ GIF تظهر مرتين في OBS إذا أضفت أوفرلاي الشات وأوفرلاي الصور معاً: مرة على أوفرلاي الصور ومرة فوق أوفرلاي الشات. الآن تظهر على أوفرلاي الصور فقط. وإذا لم يكن لديك أوفرلاي صور في OBS فتظهر على أوفرلاي الشات كما كانت.',
      ],
    },
  },
  {
    version: '0.4.17',
    en: {
      added: [
        'OBS overlays now update themselves. After an app update, OBS used to keep showing the old chat overlay until you refreshed the source by hand, so new fixes did not appear. Now every overlay page (chat, OBS chat dock, votes, pictures and clips) reloads on its own when the app has a new version. One last manual refresh is needed after this update (in OBS: right-click the source > Properties > Refresh cache of current page, or press Reload OBS in the app); from then on it is automatic.',
        'The settings side panels start wider by default (Commands and Chat). If you already dragged one to your own width, that width is kept.',
      ],
      fixed: [
        'With the app in Arabic, dragging the chat settings panel to the left made it narrower instead of wider. Dragging now always follows the arrow: pulling toward the middle makes it wider.',
      ],
    },
    ar: {
      added: [
        'أوفرلاي OBS يتحدّث الآن تلقائياً. بعد تحديث التطبيق كان OBS يبقى يعرض الأوفرلاي القديم حتى تحدّث المصدر يدوياً، فلا تظهر الإصلاحات الجديدة. الآن كل صفحات الأوفرلاي (الشات، شات OBS، التصويت، الصور والمقاطع) تعيد التحميل وحدها عندما يكون للتطبيق إصدار جديد. تحتاج تحديثاً يدوياً أخيراً بعد هذا التحديث (في OBS: كليك يمين على المصدر > Properties > Refresh cache of current page، أو اضغط Reload OBS في التطبيق)، وبعدها يصبح تلقائياً.',
        'اللوحات الجانبية للإعدادات (الأوامر والشات) تبدأ الآن أعرض بشكل افتراضي. وإذا كنت قد سحبت إحداها إلى عرضك الخاص فيبقى كما هو.',
      ],
      fixed: [
        'عندما يكون التطبيق بالعربية كان سحب لوحة إعدادات الشات إلى اليسار يجعلها أضيق بدل أن تصبح أعرض. الآن السحب يتبع اتجاه يدك دائماً: السحب نحو المنتصف يجعلها أعرض.',
      ],
    },
  },
  {
    version: '0.4.16',
    en: {
      added: [
        'Sub-actions are easier to find: the Add menu, the search box and the right-click menu now share one list, grouped into Chat & Twitch, Moderation, Audio & Voice, On Stream (OBS), Games & Polls, Logic & Flow, Counters and Notes, with short clear names. Every action is now in every menu, including Timeout, Clear chat and Ban/Mod/VIP.',
        'Chat overlay settings are organized into tabs (Presets, Layout & Motion, Bubble, Name & Avatar, Text & Emotes, Filters, OBS) instead of one long page. Clicking a part of the preview jumps to its tab.',
        'New setting in Name & Avatar: Space Between Avatar and Name. Overlays you already made keep their current spacing until you change it.',
      ],
      fixed: [
        'On a right-to-left chat overlay, the colon after a name written in English was placed next to the avatar instead of next to the message. It now always sits on the message side, for English and Arabic names, in both directions.',
      ],
    },
    ar: {
      added: [
        'أصبح العثور على الإجراءات الفرعية أسهل: قائمة الإضافة وصندوق البحث وقائمة الزر الأيمن تستخدم الآن قائمة واحدة مقسمة إلى: الشات وتويتش، الإشراف، الصوت والكلام، على البث (OBS)، الألعاب والاستطلاعات، المنطق والتحكم، العدّادات، والملاحظات، بأسماء قصيرة وواضحة. وكل إجراء موجود الآن في كل القوائم، بما فيها الإسكات ومسح الشات والحظر والمشرف وVIP.',
        'إعدادات أوفرلاي الشات مقسمة إلى تبويبات (تصاميم جاهزة، التخطيط والحركة، الصندوق، الاسم والصورة، النص والإيموتات، الفلاتر، OBS) بدل صفحة طويلة واحدة. والضغط على جزء من المعاينة ينقلك إلى تبويبه.',
        'إعداد جديد في الاسم والصورة: المسافة بين الصورة والاسم. الأوفرلاي الذي صنعته سابقاً يحتفظ بمسافته الحالية حتى تغيّرها.',
      ],
      fixed: [
        'في أوفرلاي الشات من اليمين إلى اليسار كانت النقطتان بعد الاسم المكتوب بالإنجليزية تظهران بجانب الصورة بدل الرسالة. الآن تظهران دائماً في جهة الرسالة، للأسماء الإنجليزية والعربية وفي الاتجاهين.',
      ],
    },
  },
  {
    version: '0.4.15',
    en: {
      added: [
        'Clip command: a new sub-action, "Twitch: Create a Clip for the Viewer", clips your live stream when a viewer uses a command like !clip and credits the clip to that viewer. Twitch always files a clip under your own account, so Streamer Hub keeps the count: Home now has a Clips tab on the Leaderboard (Top clippers), and the Live Feed shows who made a clip. A later chat step can post the link with {clip_url} and the viewer\'s total with {clip_count}. Studio > Presets > Clip Command Preset builds it for you; add the !clip trigger and a cooldown.',
        'Connect Twitch once again after updating so Twitch allows clipping. The clip command tells you if this is still needed.',
        'GitHub release pages now show the same What\'s New text as the app.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'أمر المقطع: إجراء فرعي جديد اسمه "تويتش: إنشاء مقطع للمشاهد" يصنع مقطعاً من بثك المباشر عندما يستخدم مشاهد أمراً مثل !clip وينسب المقطع لذلك المشاهد. تويتش يحفظ كل مقطع على حسابك أنت، لذلك يحتفظ Streamer Hub بالعدد: في الرئيسية تبويب جديد "المقاطع" في لوحة المتصدرين (أكثر صنّاع المقاطع)، والأحداث المباشرة تُظهر من صنع مقطعاً. ويمكن لرسالة شات لاحقة نشر الرابط بـ {clip_url} وعدد مقاطع المشاهد بـ {clip_count}. من الاستوديو > القوالب > قالب أمر المقطع يُبنى لك؛ أضف المحفّز !clip ووقت انتظار.',
        'اربط تويتش مرة أخرى بعد التحديث ليسمح تويتش بإنشاء المقاطع. أمر المقطع يخبرك إن كان ذلك ما زال مطلوباً.',
        'صفحات الإصدارات على GitHub تعرض الآن نفس نص "ما الجديد" الموجود في التطبيق.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.14',
    en: {
      added: [
        'Show a clip from the raider: a new sub-action, "OBS: Show a Clip from the Raider", plays a clip from the raider (or from the channel named in a !so command) on your stream. It uses the same OBS browser source as pictures and GIFs. You choose which clip (most viewed, random or newest) and from how far back, plus position, size, animation, volume and a caption under the clip. It plays in up to 1080p with sound, and a switch lets it play for the clip\'s own length. A Test button plays a clip from any channel so you can set it up before going live.',
      ],
      fixed: [
        'Prepared and AI reply commands no longer show an "!" in front of the trigger unless you typed one.',
        'Text fields now follow the language you type. A message that starts in Arabic stays right-to-left even when it contains English words or {mention}, and English stays left-to-right.',
        'Pictures and GIFs on the standalone image browser source are now placed and sized correctly.',
      ],
    },
    ar: {
      added: [
        'عرض مقطع من قناة الرايدر: إجراء فرعي جديد اسمه "OBS: عرض مقطع من قناة الرايدر" يشغّل مقطعاً من قناة الرايدر (أو من القناة المذكورة في أمر !so) على البث. يستخدم نفس مصدر المتصفح في OBS الخاص بالصور والـ GIF. تختار أي مقطع (الأكثر مشاهدة أو عشوائي أو الأحدث) ومن أي فترة، مع المكان والحجم والحركة ومستوى الصوت وعنوان تحت المقطع. يُعرض بجودة تصل إلى 1080p مع الصوت، وخيار يجعله يعمل حسب طول المقطع نفسه. زر التجربة يشغّل مقطعاً من أي قناة لتضبطه قبل البث.',
      ],
      fixed: [
        'ردود الأوامر الجاهزة وردود الذكاء الاصطناعي لم تعد تُظهر علامة "!" قبل الكلمة إلا إذا كتبتها أنت.',
        'حقول النص تتبع الآن لغة الكتابة. الرسالة التي تبدأ بالعربية تبقى من اليمين إلى اليسار حتى لو احتوت كلمات إنجليزية أو {mention}، والإنجليزية تبقى من اليسار إلى اليمين.',
        'الصور والـ GIF في مصدر المتصفح المستقل للصور تظهر الآن في مكانها وبحجمها الصحيح.',
      ],
    },
  },
  {
    version: '0.4.13',
    en: {
      added: [
        'Backups: Settings > System & Window Behavior now has a Backups card. Pick an earlier copy of your commands, counters, replies and settings and restore it with one click. The app restarts to load it, and what you had before is kept so you can undo the restore.',
        'Your settings are now protected. They are written safely to the disk, the last good copy is always kept, and an automatic backup is taken every few hours (the last 8 are kept). If the settings file is ever damaged or missing when the app starts, the last good copy is restored automatically and a notice tells you what happened.',
      ],
      fixed: [
        'Settings could be wiped after a crash or power loss (for example while removing a display driver), because a damaged settings file was silently replaced with an empty one. It is now kept aside and your last good copy is restored instead.',
      ],
    },
    ar: {
      added: [
        'النسخ الاحتياطية: في الإعدادات > سلوك النظام والنوافذ بطاقة جديدة للنسخ الاحتياطية. اختر نسخة أقدم من أوامرك وعداداتك وردودك وإعداداتك واستعدها بضغطة واحدة. يُعاد تشغيل التطبيق لتحميلها، وما كان لديك قبلها يُحفظ حتى تتمكن من التراجع عن الاستعادة.',
        'إعداداتك الآن محمية. تُكتب على القرص بأمان، ويُحتفظ دائماً بآخر نسخة سليمة، وتؤخذ نسخة احتياطية تلقائية كل عدة ساعات (تُحفظ آخر 8). وإذا كان ملف الإعدادات تالفاً أو مفقوداً عند تشغيل التطبيق تُستعاد آخر نسخة سليمة تلقائياً ويظهر إشعار يشرح ما حدث.',
      ],
      fixed: [
        'كانت الإعدادات قد تُمسح بعد انهيار أو انقطاع الكهرباء (مثلاً أثناء حذف تعريف كرت الشاشة) لأن الملف التالف كان يُستبدل بصمت بملف فارغ. الآن يُحفظ الملف التالف جانباً وتُستعاد آخر نسخة سليمة بدلاً منه.',
      ],
    },
  },
  {
    version: '0.4.12',
    en: {
      added: [
        'A brand new Home: a dashboard you build yourself. Press Customize to drag cards into any order, pick each card width, and add or remove widgets. The three profiles now load a ready made layout.',
        'New Home widgets: Stream Pulse (time on air, messages, chatters, follows, raids, gifts, with tiles you can pick and reorder), Chat Activity (messages per minute), Live Feed (follows, raids, gifts, redemptions and duels as they happen), Quick Run (fire any sequence in one click) and a Stream Checklist.',
        'Leaderboards on Home: top chatters, duelists, gifters and reward redeemers, for this stream or all time, with a button to post the top 5 to your chat. Bots are hidden and you can choose to include yourself. Counting starts from this update.',
        'A second look: the Fluent theme (Settings > Appearance). Windows 11 style see-through layers on a deep navy window, rounded corners and Segoe UI. On Windows 11 the window itself uses the Mica backdrop. Dark and Light are unchanged, and the logo at the top left of the title bar is gone.',
        'Shield for the Moderation step: Smart Timeout, Timeout and Ban can now skip protected viewers (by name, moderators, VIPs or subscribers) and optionally say so in chat.',
        'Duel shield, reworked: a shielded viewer now plays the duel for real. If they lose they are not timed out and chat gets a shield message; if they win, everything works as usual. This also covers the trivia timer running out.',
      ],
      fixed: [
        'Command names written in Arabic now line up on the left, like English ones, in the commands table.',
      ],
    },
    ar: {
      added: [
        'صفحة رئيسية جديدة كلياً: لوحة تبنيها بنفسك. اضغط تخصيص لسحب البطاقات بأي ترتيب، واختيار عرض كل بطاقة، وإضافة العناصر أو حذفها. والملفات الثلاثة تحمّل الآن تخطيطاً جاهزاً.',
        'عناصر جديدة في الرئيسية: البث (وقت البث والرسائل والمتحدثون والمتابعات والريدات والهدايا، مع بطاقات تختارها وتعيد ترتيبها)، ونشاط الشات (الرسائل في الدقيقة)، والأحداث المباشرة (المتابعات والريدات والهدايا والمكافآت والتحديات لحظة حدوثها)، والتشغيل السريع (شغّل أي سلسلة بضغطة)، وقائمة قبل البث.',
        'لوحات المتصدرين في الرئيسية: أكثر المتحدثين والمتحدّين والمُهدين والمستبدلين للمكافآت، لهذا البث أو لكل الأوقات، مع زر لنشر أفضل 5 في الشات. البوتات مخفية ويمكنك إضافة نفسك. العدّ يبدأ من هذا التحديث.',
        'مظهر ثانٍ: ثيم Fluent (الإعدادات > المظهر). طبقات شفافة بأسلوب ويندوز 11 على نافذة كحلية داكنة، وزوايا مستديرة وخط Segoe UI. وفي ويندوز 11 تستخدم النافذة نفسها خلفية Mica. الداكن والفاتح كما هما، وشعار أعلى يسار شريط العنوان أُزيل.',
        'درع لخطوة الإشراف: الإسكات الذكي والإسكات والحظر يمكنها الآن تخطي المشاهدين المحميين (بالاسم أو المشرفون أو VIP أو المشتركون) والإعلان عن ذلك في الشات اختيارياً.',
        'درع التحديات بشكل جديد: صاحب الدرع يلعب التحدي فعلاً. إذا خسر لا يُسكت ويصل الشات رسالة الدرع، وإذا فاز يستمر كل شيء طبيعياً. وهذا يشمل انتهاء وقت سؤال التريفيا.',
      ],
      fixed: [
        'أسماء الأوامر المكتوبة بالعربية تصطف الآن على اليسار مثل الإنجليزية في جدول الأوامر.',
      ],
    },
  },
  {
    version: '0.4.11',
    en: {
      added: [
        'Undo and redo: press Ctrl+Z to undo and Ctrl+Y (or Ctrl+Shift+Z) to redo changes to your sequences, replies and counters on the Commands tab, including deleting something by mistake. Undo and Redo buttons sit next to Delete.',
        'Slash commands in the streamer chat box (OBS dock and Chat tab): /timeout, /untimeout, /ban, /unban, /clear, /mod, /unmod, /vip, /unvip, /shoutout and /help, with suggestions as you type.',
        'Emote suggestions and an emote picker in the chat box, and @name suggestions from recent chatters.',
        '7TV global emotes, and BTTV, FFZ and 7TV emotes now show in the in-app Chat tab as well as the overlay and the OBS dock.',
        'Gifted subs are pinned at the top of the OBS dock and the Chat tab, with bundles shown once.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'تراجع وإعادة: اضغط Ctrl+Z للتراجع وCtrl+Y (أو Ctrl+Shift+Z) للإعادة في تعديلات السلاسل والردود والعدادات في تبويب الأوامر، بما في ذلك حذف شيء بالخطأ. وأزرار تراجع وإعادة بجانب زر الحذف.',
        'أوامر بالشرطة المائلة في صندوق شات الستريمر (دوك OBS وتبويب الشات): /timeout و/untimeout و/ban و/unban و/clear و/mod و/unmod و/vip و/unvip و/shoutout و/help مع اقتراحات أثناء الكتابة.',
        'اقتراحات إيموجي ومنتقي إيموجي في صندوق الشات، واقتراحات @الأسماء من آخر المتحدثين.',
        'إيموجيات 7TV العامة، وإيموجيات BTTV وFFZ و7TV تظهر الآن في تبويب الشات داخل التطبيق إلى جانب الأوفرلاي ودوك OBS.',
        'الاشتراكات المهداة تُثبَّت في أعلى دوك OBS وتبويب الشات، والحزم تظهر مرة واحدة.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.10',
    en: {
      added: [
        'Repeating timers: a sequence can now run itself every X minutes, like Nightbot timers (socials, reminders). It waits for chat to be active first, and you can put Wait steps between messages so chat is never flooded. Try Presets > Timed chat messages.',
        'Run Another Sequence: a sub-action that runs a different sequence, so you can build reusable sequences. The old Run Command step now really starts the sequence with that chat trigger.',
        'Protected viewers can now have their own custom reply, set per viewer in the duel steps.',
        'Click the version number in the title bar any time to read What is New again.',
      ],
      fixed: [
        'UI scaling now uses real page zoom, and the scale slider no longer jumps around while you drag it.',
        'Long menus in the sequence studio (Add sub-action and others) now scroll, so every item can be reached at any UI scale.',
      ],
    },
    ar: {
      added: [
        'مؤقتات متكررة: يمكن للسلسلة الآن أن تعمل وحدها كل عدة دقائق مثل مؤقتات Nightbot (روابط التواصل والتذكيرات). تنتظر نشاط الشات أولاً، ويمكنك وضع خطوات انتظار بين الرسائل حتى لا يُغرق الشات. جرّب الإعدادات الجاهزة > رسائل شات دورية.',
        'تشغيل سلسلة أخرى: خطوة فرعية تشغّل سلسلة مختلفة لتبني سلاسل قابلة لإعادة الاستخدام. وخطوة تشغيل أمر القديمة صارت تشغّل فعلاً السلسلة ذات أمر الشات هذا.',
        'يمكن الآن أن يكون للمشاهدين المحميين رد خاص بكل واحد منهم من خطوات التحدي.',
        'اضغط على رقم الإصدار في الشريط العلوي في أي وقت لقراءة ما الجديد مرة أخرى.',
      ],
      fixed: [
        'تكبير الواجهة يستخدم الآن تكبير الصفحة الحقيقي، ولم يعد شريط الحجم يقفز أثناء سحبه.',
        'القوائم الطويلة في استوديو السلاسل (إضافة خطوة فرعية وغيرها) صارت قابلة للتمرير فيمكن الوصول لكل عنصر مهما كان حجم الواجهة.',
      ],
    },
  },
  {
    version: '0.4.9',
    en: {
      added: [
        'Automatic updates: Streamer Hub can now update itself. Right after you open the app it installs after a short countdown you can cancel, and an update found while you are live waits until the next launch. Turn it off in Settings > System > Updates.',
        "A What's New window appears after every update, in your language, so you always see what changed.",
      ],
      fixed: [],
    },
    ar: {
      added: [
        'تحديث تلقائي: يستطيع Streamer Hub الآن تحديث نفسه. بعد فتح التطبيق مباشرة يُثبَّت التحديث بعد عدّ تنازلي قصير يمكنك إلغاؤه، وما يُكتشف أثناء بثك ينتظر التشغيل القادم. يمكنك إيقافه من الإعدادات > النظام > التحديثات.',
        'تظهر نافذة "ما الجديد" بعد كل تحديث وبلغتك، لتعرف دائماً ما الذي تغيّر.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.8',
    en: {
      added: [
        'If / Else steps in sequences: run different sub-actions depending on who won a mini game or what a poll decided. The If sits right under its game.',
        'Protected viewers: choose who cannot be challenged to a Timeout Duel (or cannot challenge the streamer), with your own reply message.',
        'Cleaner commands list: clear names, a Type column with trigger icons, and a slimmer inspector panel.',
        'Live Votes and Alert Studio are now buttons in the top bar.',
        'Bigger window on first launch and a 110% default interface size.',
        '{streak} can now be read out loud in text-to-speech.',
      ],
      fixed: [
        'Alert Studio now opens one Save window per export, where you can rename the file.',
        'Timeout Duel no longer targets the streamer; use the Streamer 1v1 step for that.',
      ],
    },
    ar: {
      added: [
        'خطوات إذا / وإلا في السلاسل: نفّذ خطوات مختلفة حسب من فاز في اللعبة أو ما نتيجة الاستطلاع. تظهر الخطوة تحت اللعبة مباشرة.',
        'مشاهدون محميون: اختر من لا يمكن تحديه في تحدي التايم آوت (أو من لا يستطيع تحدي الستريمر) مع رد من تحديدك.',
        'قائمة أوامر أوضح: أسماء واضحة وعمود للنوع مع أيقونات التفعيل ولوحة تفاصيل أخف.',
        'التصويت المباشر واستوديو التنبيهات أصبحا أزراراً في الشريط العلوي.',
        'نافذة أكبر عند التشغيل لأول مرة وحجم واجهة افتراضي 110%.',
        'يمكن الآن قراءة {streak} صوتياً في تحويل النص إلى كلام.',
      ],
      fixed: [
        'استوديو التنبيهات يفتح الآن نافذة حفظ واحدة لكل تصدير ويمكنك تغيير اسم الملف.',
        'تحدي التايم آوت لم يعد يستهدف الستريمر؛ استخدم خطوة تحدي الستريمر 1v1 لذلك.',
      ],
    },
  },
  {
    version: '0.4.7',
    en: {
      added: [
        'Alert Studio can compress to a target size while exporting, in one step.',
        'Choose the output resolution of your exported video.',
        'Tweak and export again without importing the video again.',
        'Temporary files are deleted by default; keep them or pick their folder in Alert Studio.',
      ],
      fixed: [],
    },
    ar: {
      added: [
        'يمكن لاستوديو التنبيهات ضغط الفيديو إلى حجم محدد أثناء التصدير في خطوة واحدة.',
        'اختر دقة الفيديو المُصدَّر.',
        'عدّل وصدّر مرة أخرى بدون إعادة استيراد الفيديو.',
        'تُحذف الملفات المؤقتة افتراضياً؛ احتفظ بها أو اختر مجلدها من استوديو التنبيهات.',
      ],
      fixed: [],
    },
  },
  {
    version: '0.4.6',
    en: {
      added: [
        'Luma Key: new Color Key type, choke, matte gamma and opacity controls.',
        'Lossless rotation, custom video bitrate and saveable editing presets.',
        'Larger preview with a clearer checkerboard.',
      ],
      fixed: ['The video preview can now be scrubbed forward and backward.'],
    },
    ar: {
      added: [
        'كي السطوع: نوع جديد لكي اللون مع التحكم بالتقليص ومنحنى الماسك والشفافية.',
        'تدوير بدون فقد جودة ومعدل بت مخصص وإعدادات تعديل قابلة للحفظ.',
        'معاينة أكبر مع شبكة شطرنج أوضح.',
      ],
      fixed: ['يمكن الآن تحريك مؤشر الفيديو للأمام والخلف في المعاينة.'],
    },
  },
];

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** Entries newer than `lastSeen`, up to and including `current`, newest first. */
export function changelogSince(lastSeen: string, current: string, entries: ChangelogEntry[] = CHANGELOG): ChangelogEntry[] {
  return entries
    .filter((e) => compareVersions(e.version, lastSeen) > 0 && compareVersions(e.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version;
