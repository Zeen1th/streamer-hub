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
