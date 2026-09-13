import { CHAT_OVERLAY_AVATAR_FALLBACK, type NormalizedChatOverlayMessage } from '../../../lib/chatOverlay';

function makeSampleAvatar(bg1: string, bg2: string, letter: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g_${letter}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g_${letter})"/><text x="50" y="54" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="44" fill="#ffffff">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Sample = Omit<NormalizedChatOverlayMessage, 'avatarUrl' | 'timestamp'> & { avatarUrl?: string };

function build(sample: Sample): NormalizedChatOverlayMessage {
  return {
    timestamp: '',
    ...sample,
    avatarUrl: sample.avatarUrl || CHAT_OVERLAY_AVATAR_FALLBACK,
  };
}

/**
 * The frozen message set shown while editing.
 *
 * These are deliberately the cases that break layouts - long wrapping text,
 * right-to-left script, mixed direction, emote-only, a missing avatar, and a
 * one-word message. Designing against a set of tidy short messages is how you
 * ship an overlay that falls apart the moment real chat arrives.
 */
export function editSampleMessages(lang: 'en' | 'ar'): NormalizedChatOverlayMessage[] {
  const ar = lang === 'ar';
  return [
    build({
      id: 'sample-broadcaster',
      username: 'zeen1_th',
      userId: 'sample-1',
      avatarUrl: makeSampleAvatar('#f43f5e', '#be123c', 'Z'),
      isBroadcaster: true,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: ar ? 'يا هلا بالجميع، نبدأ البث الحين' : 'Alright everyone, we are live!',
      emotes: [],
      color: '#f43f5e',
    }),
    build({
      id: 'sample-long',
      username: 'VeryLongUsernameHere',
      userId: 'sample-2',
      avatarUrl: makeSampleAvatar('#0284c7', '#0369a1', 'V'),
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: true,
      message:
        'This is a deliberately long message so you can see exactly how wrapping behaves at your current width, font size, and padding before you go live.',
      emotes: [],
      color: '#38bdf8',
    }),
    build({
      id: 'sample-rtl',
      username: 'basil_ar',
      userId: 'sample-3',
      avatarUrl: makeSampleAvatar('#16a34a', '#15803d', 'B'),
      isBroadcaster: false,
      isMod: true,
      isVip: false,
      isSubscriber: false,
      message: 'السلام عليكم ورحمة الله وبركاته، البث اليوم رهيب',
      emotes: [],
      color: '#22c55e',
    }),
    build({
      id: 'sample-mixed',
      username: 'mixed_dir',
      userId: 'sample-4',
      avatarUrl: makeSampleAvatar('#d946ef', '#c026d3', 'M'),
      isBroadcaster: false,
      isMod: false,
      isVip: true,
      isSubscriber: false,
      message: 'هل Crimson Fatalis اصعب boss في التاريخ؟',
      emotes: [],
      color: '#ec4899',
    }),
    build({
      id: 'sample-emote-only',
      username: 'emoteFan',
      userId: 'sample-5',
      avatarUrl: makeSampleAvatar('#8b5cf6', '#7c3aed', 'E'),
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      // Kappa is emote id 25 and has been stable on Twitch's CDN for years.
      message: 'Kappa Kappa',
      emotes: [
        { id: '25', start: 0, end: 4 },
        { id: '25', start: 6, end: 10 },
      ],
      color: '',
    }),
    build({
      id: 'sample-no-avatar',
      username: 'newViewer',
      userId: 'sample-6',
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: ar ? 'أول رسالة لي هنا' : 'First time chatting here!',
      emotes: [],
      color: '',
    }),
    build({
      id: 'sample-short',
      username: 'lurker',
      userId: 'sample-7',
      avatarUrl: makeSampleAvatar('#f59e0b', '#d97706', 'L'),
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: 'W',
      emotes: [],
      color: '',
    }),
  ];
}
