import alwaysShowDemo from '../assets/demos/always-show.webm';
import clipCreateDemo from '../assets/demos/clip-create.webm';
import counterSetDemo from '../assets/demos/counter-set.webm';
import duelDemo from '../assets/demos/duel.webm';
import ifBranchDemo from '../assets/demos/if-branch.webm';
import shoutoutClipDemo from '../assets/demos/shoutout-clip.webm';

/*
 * Short looping videos that show what a feature does, made from the real app (promo/capture + promo/demos, rendered
 * with HyperFrames). A feature with an entry here gets a "See how it works" button. Keys are step types, plus
 * `counter_set` and `always_show` for the two features that are not steps.
 */

export interface FeatureDemo {
  src: string;
  en: { title: string; body: string };
  ar: { title: string; body: string };
}

/** Left-to-right isolate, so a command like !clip keeps its order inside Arabic text. */
const ltr = (s: string) => `\u2066${s}\u2069`;

export const FEATURE_DEMOS: Record<string, FeatureDemo> = {
  clip_create: {
    src: clipCreateDemo,
    en: {
      title: 'Create a Clip for the Viewer',
      body: 'A viewer types !clip, the app clips the last moments of your stream, posts the link in chat and counts it for that viewer on the Clips leaderboard.',
    },
    ar: {
      title: 'إنشاء مقطع للمشاهد',
      body: `يكتب المشاهد ${ltr('!clip')} فيصنع التطبيق مقطعاً من آخر لحظات بثك، وينشر رابطه في الشات، ويُحسب للمشاهد في لوحة المقاطع.`,
    },
  },
  obs_clip: {
    src: shoutoutClipDemo,
    en: {
      title: 'Show a Clip from the Raider',
      body: 'Someone types !so @raider (or a raid comes in): the app welcomes the raider in chat and plays one of their clips on stream through the clip browser source.',
    },
    ar: {
      title: 'عرض مقطع من قناة الرايدر',
      body: `يكتب أحدهم ${ltr('!so @raider')} (أو يأتي رايد): يرحّب التطبيق بالرايدر في الشات ويعرض مقطعاً من قناته على البث عبر مصدر المقاطع في OBS.`,
    },
  },
  duel: {
    src: duelDemo,
    en: {
      title: 'Timeout Duel',
      body: 'A viewer challenges another with !duel @name. The coin decides (or a trivia question), the loser is timed out automatically, and the win counts on the Duels leaderboard.',
    },
    ar: {
      title: 'تحدي التايم آوت (المبارزة)',
      body: `يتحدى المشاهد غيره بـ ${ltr('!duel @name')}. العملة تحسم (أو سؤال)، والخاسر يُسكت تلقائياً، والفوز يُحسب في لوحة التحديات.`,
    },
  },
  if: {
    src: ifBranchDemo,
    en: {
      title: 'If / Else',
      body: 'After a game or a poll, If checks the result and runs one branch: Then when it is true, Else when it is not. Here a duel win gets a congratulation and a loss gets a consolation.',
    },
    ar: {
      title: 'إذا / وإلا',
      body: 'بعد لعبة أو استطلاع، تفحص «إذا» النتيجة وتنفّذ طريقاً واحداً: «إذا صحّ» عندما تتحقق و«وإلا» عندما لا تتحقق. هنا الفائز في المبارزة يُهنّأ والخاسر يُواسى.',
    },
  },
  counter_set: {
    src: counterSetDemo,
    en: {
      title: 'Set the counter from chat',
      body: 'The counter command adds one; with the set command on, a moderator types !set 6000 and the counter jumps straight to that number.',
    },
    ar: {
      title: 'ضبط العدّاد من الشات',
      body: `أمر العدّاد يزيده واحداً، ومع تفعيل أمر الضبط يكتب المشرف ${ltr('!set 6000')} فيقفز العدّاد إلى هذا الرقم مباشرة.`,
    },
  },
  always_show: {
    src: alwaysShowDemo,
    en: {
      title: 'Always show these messages',
      body: 'Nightbot stays hidden on the chat overlay, but a line you copy from chat and paste into this list still appears on stream.',
    },
    ar: {
      title: 'أظهر هذه الرسائل دائماً',
      body: 'يبقى Nightbot مخفياً في أوفرلاي الشات، لكن السطر الذي تنسخه من الشات وتلصقه في هذه القائمة يظهر على البث.',
    },
  },
};

export function demoFor(key: string | undefined): FeatureDemo | undefined {
  return key ? FEATURE_DEMOS[key] : undefined;
}
