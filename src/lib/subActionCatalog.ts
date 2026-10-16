import type { SequenceStep, SequenceStepType } from '../rpc/contracts';

/*
 * The one list of sub-actions a streamer can add. The Add menu, the search box and the right-click menu all
 * render from it, so a new sub-action is added here once and shows up (grouped) everywhere.
 */

export type SubActionCategoryId = 'twitch' | 'moderation' | 'audio' | 'screen' | 'games' | 'flow' | 'counters' | 'notes';

export interface SubActionCategory {
  id: SubActionCategoryId;
  en: string;
  ar: string;
}

/** In the order they are shown. */
export const SUB_ACTION_CATEGORIES: SubActionCategory[] = [
  { id: 'twitch', en: 'Chat & Twitch', ar: 'الشات وتويتش' },
  { id: 'moderation', en: 'Moderation', ar: 'الإشراف' },
  { id: 'audio', en: 'Audio & Voice', ar: 'الصوت والكلام' },
  { id: 'screen', en: 'On Stream (OBS)', ar: 'على البث (OBS)' },
  { id: 'games', en: 'Games & Polls', ar: 'الألعاب والاستطلاعات' },
  { id: 'flow', en: 'Logic & Flow', ar: 'المنطق والتحكم' },
  { id: 'counters', en: 'Counters', ar: 'العدّادات' },
  { id: 'notes', en: 'Notes', ar: 'ملاحظات' },
];

interface Text {
  label: string;
  desc: string;
}

export interface SubActionEntry {
  /** Unique across entries (several entries can share a step type, e.g. the moderation ones). */
  id: string;
  type: SequenceStepType;
  category: SubActionCategoryId;
  /** Start values for the new step. */
  options?: Partial<SequenceStep>;
  en: Text;
  ar: Text;
  /** Extra words the search also matches. */
  keywords?: string;
}

/** In the order they are shown inside their category: the most used first. */
export const SUB_ACTIONS: SubActionEntry[] = [
  // Chat & Twitch
  {
    id: 'chat',
    type: 'chat',
    category: 'twitch',
    options: { chatMessage: 'Drinking water! Thanks {username} 🥤' },
    en: { label: 'Send chat message', desc: 'Post a message to your Twitch chat' },
    ar: { label: 'إرسال رسالة في الشات', desc: 'نشر رسالة في شات تويتش' },
    keywords: 'say reply text message',
  },
  {
    id: 'shoutout',
    type: 'moderation',
    category: 'twitch',
    options: { moderationAction: 'shoutout', targetUser: '{raider}' },
    en: { label: 'Shoutout a channel', desc: 'Send an official Twitch shoutout (/shoutout)' },
    ar: { label: 'شوت أوت لقناة', desc: 'إرسال شوت أوت رسمي من تويتش (/shoutout)' },
    keywords: 'so raid raider',
  },
  {
    id: 'clip_create',
    type: 'clip_create',
    category: 'twitch',
    en: { label: 'Create a clip for the viewer', desc: 'Clips the live stream and credits the viewer who used the command' },
    ar: { label: 'إنشاء مقطع للمشاهد', desc: 'يصنع مقطعاً من البث وينسبه لمن استخدم الأمر' },
    keywords: 'clip clipper record',
  },

  // Moderation
  {
    id: 'smart_timeout',
    type: 'moderation',
    category: 'moderation',
    options: { moderationAction: 'smart_timeout', targetUser: '{target}', durationSeconds: 60 },
    en: { label: 'Smart timeout', desc: 'Times out anyone, mods and lead mods too (re-mods them after)' },
    ar: { label: 'إسكات ذكي', desc: 'يُسكت أي شخص حتى المشرفين ثم يعيد رتبتهم تلقائياً' },
    keywords: 'mute ban punish',
  },
  {
    id: 'timeout',
    type: 'moderation',
    category: 'moderation',
    options: { moderationAction: 'timeout', targetUser: '{target}', durationSeconds: 60 },
    en: { label: 'Timeout a viewer', desc: 'Time out a viewer for a number of seconds' },
    ar: { label: 'إسكات مشاهد', desc: 'إسكات المشاهد لعدد من الثواني' },
    keywords: 'mute',
  },
  {
    id: 'clear_chat',
    type: 'moderation',
    category: 'moderation',
    options: { moderationAction: 'clear_chat' },
    en: { label: 'Clear chat', desc: 'Clear every message in the chat room' },
    ar: { label: 'مسح الشات', desc: 'مسح كل الرسائل في غرفة الشات' },
    keywords: 'delete wipe',
  },
  {
    id: 'moderation',
    type: 'moderation',
    category: 'moderation',
    en: { label: 'Ban, mod, VIP and more', desc: 'Ban, unban, mod, unmod, VIP and unVIP a viewer' },
    ar: { label: 'حظر، مشرف، VIP وغيرها', desc: 'حظر، رفع الحظر، إضافة أو إزالة مشرف أو VIP' },
    keywords: 'ban unban mod unmod vip unvip',
  },

  // Audio & Voice
  {
    id: 'sound',
    type: 'sound',
    category: 'audio',
    en: { label: 'Play a sound effect', desc: 'Play a sound file (.mp3, .wav) with volume control' },
    ar: { label: 'تشغيل مؤثر صوتي', desc: 'تشغيل ملف صوتي (.mp3, .wav) مع التحكم بالصوت' },
    keywords: 'sfx audio mp3 wav',
  },
  {
    id: 'tts',
    type: 'tts',
    category: 'audio',
    en: { label: 'Read text aloud (TTS)', desc: 'Speak any text, including chat tokens' },
    ar: { label: 'قراءة نص صوتياً (TTS)', desc: 'نطق أي نص مع متغيرات الشات' },
    keywords: 'speech voice speak text-to-speech',
  },
  {
    id: 'mic_mute',
    type: 'mic_mute',
    category: 'audio',
    en: { label: 'Mute your mic for a while', desc: 'Mute the default microphone, then unmute safely' },
    ar: { label: 'كتم مايكك مؤقتاً', desc: 'كتم الميكروفون الافتراضي ثم إعادته تلقائياً' },
    keywords: 'microphone silence',
  },

  // On Stream (OBS)
  {
    id: 'obs_image',
    type: 'obs_image',
    category: 'screen',
    en: { label: 'Show a picture or GIF', desc: 'Pop a picture, meme or GIF up on stream' },
    ar: { label: 'عرض صورة أو GIF', desc: 'إظهار صورة أو ميم أو GIF على البث' },
    keywords: 'image meme overlay alert',
  },
  {
    id: 'obs_clip',
    type: 'obs_clip',
    category: 'screen',
    en: { label: 'Show a clip from the raider', desc: 'Play a clip from the raider or the !so channel on stream' },
    ar: { label: 'عرض مقطع من قناة الرايدر', desc: 'تشغيل مقطع من قناة الرايدر أو قناة !so على البث' },
    keywords: 'clip video raid shoutout',
  },
  {
    id: 'obs_text',
    type: 'obs_text',
    category: 'screen',
    en: { label: 'Write a text file for OBS', desc: 'Update a text file that an OBS text source reads' },
    ar: { label: 'كتابة ملف نصي لـ OBS', desc: 'تحديث ملف نصي يقرأه مصدر نص في OBS' },
    keywords: 'file latest follower label',
  },

  // Games & Polls
  {
    id: 'duel',
    type: 'duel',
    category: 'games',
    options: { duelMode: 'ai_trivia', duelOpponent: '{input}', duelTimeoutDuration: 60, duelTimerSeconds: 30 },
    en: { label: 'Timeout duel (viewer vs viewer)', desc: '50/50 coin flip or AI trivia; the loser is timed out' },
    ar: { label: 'تحدي تايم آوت (مشاهد ضد مشاهد)', desc: 'قرعة 50/50 أو سؤال بالذكاء الاصطناعي والخاسر يُسكت' },
    keywords: 'game showdown trivia',
  },
  {
    id: 'duel_streamer',
    type: 'duel_streamer',
    category: 'games',
    options: { duelMode: 'ai_trivia', duelOpponent: '{broadcaster}', duelTimeoutDuration: 60, duelTimerSeconds: 30 },
    en: { label: 'Streamer 1v1 duel', desc: 'A viewer challenges you: lose and your mic is muted' },
    ar: { label: 'تحدي الستريمر 1v1', desc: 'مشاهد يتحداك: إذا خسرت يُكتم مايكك' },
    keywords: 'game challenge mic',
  },
  {
    id: 'poll',
    type: 'poll',
    category: 'games',
    en: { label: 'Live poll', desc: 'Start, end or reset a live vote on screen' },
    ar: { label: 'استطلاع مباشر', desc: 'بدء أو إنهاء أو تصفير تصويت مباشر على الشاشة' },
    keywords: 'vote voting',
  },

  // Logic & Flow
  {
    id: 'if',
    type: 'if',
    category: 'flow',
    en: { label: 'If / Else (game or poll result)', desc: 'Run different steps depending on who won or what the poll said' },
    ar: { label: 'إذا / وإلا (نتيجة لعبة أو استطلاع)', desc: 'خطوات مختلفة حسب الفائز أو نتيجة الاستطلاع' },
    keywords: 'condition branch logic',
  },
  {
    id: 'wait',
    type: 'wait',
    category: 'flow',
    options: { waitDuration: 2, waitUnit: 'seconds' },
    en: { label: 'Wait', desc: 'Pause for a number of seconds or minutes' },
    ar: { label: 'انتظار', desc: 'إيقاف مؤقت لعدد من الثواني أو الدقائق' },
    keywords: 'delay pause sleep',
  },
  {
    id: 'run_sequence',
    type: 'run_sequence',
    category: 'flow',
    en: { label: 'Run another sequence', desc: 'Call another sequence so you can reuse it' },
    ar: { label: 'تشغيل سلسلة أخرى', desc: 'استدعاء سلسلة أخرى لإعادة استخدامها' },
    keywords: 'call reuse nested',
  },
  {
    id: 'command',
    type: 'command',
    category: 'flow',
    en: { label: 'Run a command', desc: 'Trigger another command by its chat trigger' },
    ar: { label: 'تشغيل أمر', desc: 'تشغيل أمر آخر عبر كلمته في الشات' },
    keywords: 'trigger sub-command',
  },

  // Counters
  {
    id: 'counter',
    type: 'counter',
    category: 'counters',
    en: { label: 'Change a counter', desc: 'Add to, subtract from or reset a counter' },
    ar: { label: 'تعديل عدّاد', desc: 'زيادة أو إنقاص أو تصفير عدّاد' },
    keywords: 'count deaths increase decrease reset',
  },

  // Notes
  {
    id: 'comment',
    type: 'comment',
    category: 'notes',
    options: { commentText: '** This is a comment! **' },
    en: { label: 'Comment / note', desc: 'A note to organize your steps; it does nothing when run' },
    ar: { label: 'تعليق / ملاحظة', desc: 'ملاحظة لتنظيم الخطوات ولا تنفّذ شيئاً' },
    keywords: 'note divider',
  },
];

export interface SubActionGroup {
  category: SubActionCategory;
  items: SubActionEntry[];
}

/**
 * The entries that match `query` (in either language, on label, description, keywords or category name),
 * grouped by category in display order. An empty query returns everything; empty groups are dropped.
 */
export function groupSubActions(query: string): SubActionGroup[] {
  const needle = query.trim().toLowerCase();
  const groups: SubActionGroup[] = [];
  for (const category of SUB_ACTION_CATEGORIES) {
    const items = SUB_ACTIONS.filter((entry) => {
      if (entry.category !== category.id) return false;
      if (!needle) return true;
      const haystack = [entry.en.label, entry.en.desc, entry.ar.label, entry.ar.desc, entry.keywords ?? '', category.en, category.ar]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    if (items.length) groups.push({ category, items });
  }
  return groups;
}
