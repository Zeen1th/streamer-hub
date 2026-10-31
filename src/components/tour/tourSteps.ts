import type { AppTab, SettingsSection } from '../../store/toolStore';

export interface TourStep {
  id: string;
  /** CSS selector of what to point at; none means a centred card. */
  target?: string;
  /** Page to open behind the card so the streamer sees what the step is about. */
  tab?: AppTab;
  section?: SettingsSection;
  en: { title: string; body: string };
  ar: { title: string; body: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'home',
    en: {
      title: 'Welcome to Streamer Hub 👋',
      body: 'A one-minute tour of the basics. Use Next (or the arrow keys) to move on, and Skip whenever you like.',
    },
    ar: {
      title: 'أهلاً بك في Streamer Hub 👋',
      body: 'جولة سريعة لمدة دقيقة على الأساسيات. استخدم التالي (أو الأسهم) للمتابعة، وتخطَّ متى شئت.',
    },
  },
  {
    id: 'twitch',
    target: '[data-od-id="profile-card"]',
    en: {
      title: 'Connect Twitch first',
      body: 'Click your profile here to log in with Twitch. Commands, overlays and stats only work while Twitch is connected.',
    },
    ar: {
      title: 'اربط تويتش أولاً',
      body: 'اضغط على ملفك هنا لتسجيل الدخول بتويتش. الأوامر والأوفرلاي والإحصائيات تعمل فقط وتويتش متصل.',
    },
  },
  {
    id: 'home',
    target: '[data-nav="home"]',
    tab: 'home',
    en: {
      title: 'Home',
      body: 'Your stream at a glance: Stream Pulse counts what happens while you are live, and the leaderboards rank your viewers. Press Customize to arrange the cards.',
    },
    ar: {
      title: 'الرئيسية',
      body: 'بثك بلمحة: Stream Pulse يحسب ما يحدث وأنت على الهواء، ولوحات المتصدرين ترتّب مشاهديك. اضغط تخصيص لترتيب البطاقات.',
    },
  },
  {
    id: 'commands',
    target: '[data-nav="commands"]',
    tab: 'commands',
    en: {
      title: 'Commands',
      body: 'Everything chat can trigger: counters (like !deaths), prepared replies, AI replies and sequences. A sequence chains actions such as a sound, a picture, a clip, a shoutout or a duel.',
    },
    ar: {
      title: 'الأوامر',
      body: 'كل ما يستطيع الشات تشغيله: العدّادات (مثل !deaths) والردود الجاهزة وردود الذكاء الاصطناعي والتسلسلات. التسلسل يربط إجراءات مثل صوت أو صورة أو مقطع أو شوت أوت أو مبارزة.',
    },
  },
  {
    id: 'overlay',
    target: '[data-nav="overlay"]',
    tab: 'overlay',
    en: {
      title: 'Chat Overlay',
      body: 'Style how your chat looks on stream, then copy its link into OBS as a Browser Source. You can have more than one overlay.',
    },
    ar: {
      title: 'أوفرلاي الشات',
      body: 'صمّم شكل الشات على البث، ثم انسخ رابطه إلى OBS كـ Browser Source. يمكنك إنشاء أكثر من أوفرلاي.',
    },
  },
  {
    id: 'obs-chat',
    target: '[data-nav="obs-chat"]',
    tab: 'obs-chat',
    en: {
      title: 'OBS Streamer Chat',
      body: 'A chat you add to OBS as a dock, so you can read and reply without leaving OBS.',
    },
    ar: {
      title: 'شات OBS للبث',
      body: 'شات تضيفه إلى OBS كـ Dock لتقرأ وترد دون مغادرة OBS.',
    },
  },
  {
    id: 'votes',
    target: '[data-nav="votes"]',
    tab: 'votes',
    en: {
      title: 'Live Votes',
      body: 'Run polls that chat votes in, with an overlay for OBS showing the results live.',
    },
    ar: {
      title: 'التصويت المباشر',
      body: 'شغّل استطلاعات يصوّت فيها الشات، مع أوفرلاي لـ OBS يعرض النتائج مباشرة.',
    },
  },
  {
    id: 'alerts',
    target: '[data-nav="alerts"]',
    tab: 'alerts',
    en: {
      title: 'Alert Studio',
      body: 'Shrinks your Twitch and StreamElements alert videos under the size limit while keeping them transparent.',
    },
    ar: {
      title: 'استوديو التنبيهات',
      body: 'يصغّر فيديوهات تنبيهات تويتش وستريم إليمنتس تحت الحد المسموح مع الحفاظ على الشفافية.',
    },
  },
  {
    id: 'activity',
    target: '[data-nav="activity"]',
    tab: 'activity',
    en: {
      title: 'Activity',
      body: 'Everything the app did: commands that ran, messages it sent and errors. Look here first when something does not work.',
    },
    ar: {
      title: 'النشاط',
      body: 'كل ما فعله التطبيق: الأوامر التي عملت والرسائل التي أرسلها والأخطاء. ابدأ من هنا عندما لا يعمل شيء.',
    },
  },
  {
    id: 'settings',
    target: '[data-nav="settings"]',
    tab: 'settings',
    section: 'general',
    en: {
      title: 'Settings',
      body: 'Connect OBS, add a bot account, set up AI, restore backups and share your commands with other streamers.',
    },
    ar: {
      title: 'الإعدادات',
      body: 'اربط OBS، وأضف حساب بوت، وجهّز الذكاء الاصطناعي، واسترجع النسخ الاحتياطية، وشارك أوامرك مع ستريمرز آخرين.',
    },
  },
  {
    id: 'done',
    tab: 'home',
    en: {
      title: 'You are all set 🎉',
      body: 'Start by connecting Twitch, then add your first command. You can take this tour again from Settings > Setup Guide.',
    },
    ar: {
      title: 'كل شيء جاهز 🎉',
      body: 'ابدأ بربط تويتش ثم أضف أول أمر لك. يمكنك إعادة هذه الجولة من الإعدادات > دليل الإعداد.',
    },
  },
];

export const TOUR_TEXT = {
  en: { next: 'Next', back: 'Back', skip: 'Skip tour', finish: 'Finish', of: '{n} of {total}' },
  ar: { next: 'التالي', back: 'السابق', skip: 'تخطَّ الجولة', finish: 'إنهاء', of: '{n} من {total}' },
} as const;
