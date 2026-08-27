import { CHAT_OVERLAY_AVATAR_FALLBACK, type NormalizedChatOverlayMessage } from '../../../lib/chatOverlay';

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
      isBroadcaster: false,
      isMod: false,
      isVip: true,
      isSubscriber: false,
      message: 'اليوم لعبت Sekiro وكانت صعبة مرة 100%',
      emotes: [],
      color: '#ec4899',
    }),
    build({
      id: 'sample-emote-only',
      username: 'emoteFan',
      userId: 'sample-5',
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
