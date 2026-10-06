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
