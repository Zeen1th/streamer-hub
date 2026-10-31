import type { ActionTrigger, AutoReply, CommandProfileData, CommandSequence, Counter, SequenceStep } from '../rpc/contracts';
import {
  DEFAULT_CLIP_ANNOUNCE_MESSAGE,
  DEFAULT_CLIP_FAIL_MESSAGE,
  DEFAULT_CLIP_LENGTH_SECONDS,
  DEFAULT_CLIP_TITLE,
} from './sequenceRunner.ts';
import { TIMER_DEFAULT_INTERVAL_MINUTES, TIMER_DEFAULT_MIN_CHAT_MESSAGES } from './sequenceTimers.ts';

/*
 * The Starter profile: a ready-made set of commands for a streamer who has none yet. It is built in the app language at the
 * moment it is created. The shapes below are the ones the stores create (sequenceStore.defaultStepForType and the duel
 * preset, counterStore.addCounter, autoReplyStore.add), written out here so this file stays free of the stores and can be
 * tested on its own.
 */

export type StarterLanguage = 'en' | 'ar';

interface StarterText {
  name: string;
  deathCounter: string;
  clipName: string;
  soName: string;
  soChat: string;
  raidName: string;
  raidChat: string;
  duelName: string;
  hydrateName: string;
  hydrateChat: string;
  discord: string;
  socials: string;
  schedule: string;
}

const TEXT: Record<StarterLanguage, StarterText> = {
  en: {
    name: 'Starter',
    deathCounter: 'Deaths',
    clipName: '!clip: clip that moment',
    soName: '!so: shout out a streamer',
    soChat: 'Go check out @{target}! They are worth a follow: twitch.tv/{target} 💜',
    raidName: 'Raid welcome',
    raidChat: '🎉 Welcome raiders from @{raider}! Thank you for the raid with {viewers} viewers! 💜',
    duelName: '!duel: timeout duel',
    hydrateName: 'Hydrate reminder',
    hydrateChat: '💧 Hydrate check! Time for a sip of water, chat.',
    discord: 'Join the Discord: (put your link here)',
    socials: 'Follow me everywhere: (put your links here)',
    schedule: 'Stream schedule: (put your schedule here)',
  },
  ar: {
    name: 'البداية',
    deathCounter: 'الوفيات',
    clipName: 'اقتطاع مقطع',
    soName: 'ترشيح ستريمر',
    soChat: 'تفضلوا زوروا @{target}! يستاهل المتابعة: twitch.tv/{target} 💜',
    raidName: 'ترحيب بالغارة',
    raidChat: '🎉 أهلاً بالقادمين من قناة @{raider}! شكراً على الغارة بـ {viewers} مشاهد! 💜',
    duelName: 'مبارزة تايم أوت',
    hydrateName: 'تذكير بشرب الماء',
    hydrateChat: '💧 وقت شرب الماء يا شات! جرعة ماء وكملوا.',
    discord: 'انضموا لديسكورد القناة: (ضع الرابط هنا)',
    socials: 'تابعوني على كل المنصات: (ضع روابطك هنا)',
    schedule: 'جدول البث: (ضع جدولك هنا)',
  },
};

const id = () => crypto.randomUUID();

const chatTrigger = (command: string): ActionTrigger => ({ id: id(), type: 'twitch_chat', enabled: true, chatCommand: command, matchMode: 'startsWith' });

const sequence = (name: string, command: string | null, cooldownSeconds: number, triggers: ActionTrigger[], steps: SequenceStep[]): CommandSequence => ({
  id: id(),
  enabled: true,
  name,
  triggerType: 'chat',
  rewardTitle: '',
  rewardId: '',
  chatTrigger: command ?? '',
  cooldownSeconds,
  triggers,
  steps,
});

const showClipStep = (channel: string): SequenceStep => ({
  id: id(),
  type: 'obs_clip',
  clipChannel: channel,
  clipSelection: 'top',
  clipPeriod: 'month',
  clipMaxSeconds: 30,
  clipUseClipLength: false,
  clipVolume: 0.7,
  clipPosition: 'center',
  clipAnimation: 'zoom',
  clipSize: 50,
  clipShowCaption: true,
  clipCaption: 'Go follow {channel}!',
  clipWaitForEnd: false,
  // clipSkipCommand and clipSkipWho are left unset: "!so skip" for the requester and mods, the built-in default
});

const chatStep = (message: string): SequenceStep => ({ id: id(), type: 'chat', chatMessage: message });

function deathCounter(name: string): Counter {
  const slug = 'death';
  return {
    id: id(),
    name,
    count: 0,
    commands: {
      increase: { commandName: slug, permission: 'mod', cooldownSeconds: 10 },
      decrease: { commandName: `${slug}down`, permission: 'mod', cooldownSeconds: 10 },
      reset: { commandName: `${slug}reset`, permission: 'mod', cooldownSeconds: 0 },
      set: { enabled: true, commandName: `${slug}set`, permission: 'mod', cooldownSeconds: 0 },
    },
    obs: { enabled: false, filePath: '', template: `${name}: {count}` },
    titleEnabled: false,
    titleTemplate: `{title} | ${name}: {count}`,
  };
}

function preparedReply(command: string, response: string): AutoReply {
  return {
    id: id(),
    triggers: [command],
    response,
    enabled: true,
    responseEnabled: true,
    cooldownSeconds: 30,
    userCooldownSeconds: 0,
    titleActionEnabled: false,
    titleTemplate: '',
    titleStart: 1,
    titleCount: 1,
    titleIncreaseCommand: '',
    titleDecreaseCommand: '',
    themeActionEnabled: false,
    themeActionMode: 'dark',
    titleCounters: [{ id: 'count1', start: 1, count: 1 }],
    minimumRank: 'everyone',
    aiUserCooldownSeconds: 60,
    matchMode: 'exact',
    responseMode: 'static',
    aiInstructions: '',
    agentName: '',
    agentRole: '',
    agentContext: '',
    aiModel: 'llama-3.1-8b-instant',
    aiProvider: 'groq',
    aiMaxTokens: 120,
    aiFallback: '',
    aiUserRestriction: 'none',
    aiTargetUsers: [],
    aiWebSearch: true,
    channelPointsRewardId: '',
    channelPointsRewardTitle: '',
  };
}

/** The Starter profile in the given language. Ids are new on every call; the host gives the profile its own id. */
export function buildStarterProfile(language: StarterLanguage): CommandProfileData {
  const text = TEXT[language === 'ar' ? 'ar' : 'en'];

  const clip = sequence(text.clipName, '!clip', 30, [chatTrigger('!clip')], [
    {
      id: id(),
      type: 'clip_create',
      clipCreateFailMessage: DEFAULT_CLIP_FAIL_MESSAGE,
      clipTitle: DEFAULT_CLIP_TITLE,
      clipAnnounceMessage: DEFAULT_CLIP_ANNOUNCE_MESSAGE,
      clipLengthSeconds: DEFAULT_CLIP_LENGTH_SECONDS,
      clipHasDelay: false,
    },
  ]);

  const shoutout = sequence(text.soName, '!so', 10, [chatTrigger('!so')], [chatStep(text.soChat), showClipStep('{target}')]);

  const raid = sequence(
    text.raidName,
    null,
    10,
    [{ id: id(), type: 'twitch_raid', enabled: true, minViewers: 1 }],
    [chatStep(text.raidChat), showClipStep('{raider}')],
  );

  const duel = sequence(text.duelName, '!duel', 15, [chatTrigger('!duel')], [
    {
      id: id(),
      type: 'duel',
      duelMode: 'ai_trivia',
      duelOpponent: '{input}',
      duelTimeoutDuration: 60,
      duelTimerSeconds: 30,
      duelChallengerWinChance: 50,
      duelBroadcasterMuteSource: '',
      duelLanguage: 'auto',
      duelCategory: 'general',
      duelInstructions: 'Keep questions simple and focused on popular games like Souls games, Zelda, and Monster Hunter. The answer must be clear, well-known, and 1 to 3 words.',
    },
  ]);

  const hydrate = sequence(
    text.hydrateName,
    null,
    0,
    [{ id: id(), type: 'timer', enabled: true, intervalMinutes: TIMER_DEFAULT_INTERVAL_MINUTES, minChatMessages: TIMER_DEFAULT_MIN_CHAT_MESSAGES }],
    [chatStep(text.hydrateChat)],
  );

  return {
    name: text.name,
    counters: [deathCounter(text.deathCounter)],
    autoReplies: [
      preparedReply('!discord', text.discord),
      preparedReply('!socials', text.socials),
      preparedReply('!schedule', text.schedule),
    ],
    sequences: [clip, shoutout, raid, duel, hydrate],
    keybinds: [],
  };
}
