export interface SlashCommandDef {
  name: string;
  aliases: string[];
  usage: string;
  en: string;
  ar: string;
  /** The first argument is a viewer's name (offers name suggestions). */
  takesUser: boolean;
}

/** What the streamer can type into the chat box. Executed on the host (ChatCommandProcessor.cs). */
export const SLASH_COMMANDS: SlashCommandDef[] = [
  { name: 'timeout', aliases: ['to'], usage: '/timeout <user> [10m] [reason]', en: 'Time a viewer out', ar: 'إسكات مشاهد مؤقتاً', takesUser: true },
  { name: 'untimeout', aliases: [], usage: '/untimeout <user>', en: 'Remove a timeout', ar: 'إزالة الإسكات', takesUser: true },
  { name: 'ban', aliases: [], usage: '/ban <user> [reason]', en: 'Ban a viewer', ar: 'حظر مشاهد', takesUser: true },
  { name: 'unban', aliases: [], usage: '/unban <user>', en: 'Lift a ban', ar: 'رفع الحظر', takesUser: true },
  { name: 'clear', aliases: [], usage: '/clear', en: 'Clear the whole chat', ar: 'مسح الشات بالكامل', takesUser: false },
  { name: 'mod', aliases: [], usage: '/mod <user>', en: 'Make someone a moderator', ar: 'جعل شخص مشرفاً', takesUser: true },
  { name: 'unmod', aliases: [], usage: '/unmod <user>', en: 'Remove a moderator', ar: 'إزالة مشرف', takesUser: true },
  { name: 'vip', aliases: [], usage: '/vip <user>', en: 'Give VIP', ar: 'إعطاء VIP', takesUser: true },
  { name: 'unvip', aliases: [], usage: '/unvip <user>', en: 'Remove VIP', ar: 'إزالة VIP', takesUser: true },
  { name: 'shoutout', aliases: ['so'], usage: '/shoutout <user>', en: 'Shout out a channel', ar: 'شوت أوت لقناة', takesUser: true },
  { name: 'help', aliases: ['commands'], usage: '/help', en: 'List the commands', ar: 'عرض الأوامر', takesUser: false },
];

export interface Suggestion {
  type: 'command' | 'user' | 'emote';
  /** Shown in the list. */
  label: string;
  /** Put in the text box in place of what was typed. */
  insert: string;
  detail?: string;
  imageUrl?: string;
}

export interface AssistResult {
  suggestions: Suggestion[];
  /** The part of the text the chosen suggestion replaces. */
  replaceStart: number;
  replaceEnd: number;
}

export interface AssistContext {
  users: readonly string[];
  /** Emote name -> image url (third-party providers). */
  emotes: Readonly<Record<string, string>>;
  lang: 'en' | 'ar';
}

const MAX_SUGGESTIONS = 8;

function rank(names: string[], query: string): string[] {
  const q = query.toLowerCase();
  const starts = names.filter((n) => n.toLowerCase().startsWith(q));
  const contains = names.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
  return [...starts, ...contains];
}

function userSuggestions(prefix: string, ctx: AssistContext, withAt: boolean): Suggestion[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const user of ctx.users) {
    const key = user.toLowerCase();
    if (!user || seen.has(key)) continue;
    seen.add(key);
    unique.push(user);
  }
  return rank(unique, prefix)
    .slice(0, MAX_SUGGESTIONS)
    .map((user) => ({ type: 'user' as const, label: `@${user}`, insert: `${withAt ? '@' : ''}${user} ` }));
}

/**
 * What to offer for the text typed so far (caret at `caret`): slash commands while typing the command,
 * viewer names after a user-taking command or an @, and emotes after a colon (":kek").
 */
export function computeAssist(value: string, ctx: AssistContext, caret: number = value.length): AssistResult | null {
  const upToCaret = value.slice(0, caret);

  // 1. Slash commands
  if (upToCaret.startsWith('/') && !upToCaret.startsWith('//')) {
    const firstSpace = upToCaret.search(/\s/);
    if (firstSpace === -1) {
      const typed = upToCaret.slice(1).toLowerCase();
      const matches = SLASH_COMMANDS.filter((c) => c.name.startsWith(typed) || c.aliases.some((a) => a.startsWith(typed)));
      if (matches.length === 0) return null;
      return {
        replaceStart: 0,
        replaceEnd: caret,
        suggestions: matches.slice(0, MAX_SUGGESTIONS).map((c) => ({
          type: 'command' as const,
          label: c.usage,
          insert: c.takesUser ? `/${c.name} ` : `/${c.name}`,
          detail: ctx.lang === 'ar' ? c.ar : c.en,
        })),
      };
    }

    const name = upToCaret.slice(1, firstSpace).toLowerCase();
    const command = SLASH_COMMANDS.find((c) => c.name === name || c.aliases.includes(name));
    const rest = upToCaret.slice(firstSpace + 1);
    if (command?.takesUser && !/\s/.test(rest)) {
      const prefix = rest.replace(/^@+/, '');
      const suggestions = userSuggestions(prefix, ctx, false);
      if (suggestions.length === 0) return null;
      return { suggestions, replaceStart: firstSpace + 1, replaceEnd: caret };
    }
    return null;
  }

  // 2. @name and :emote in the word being typed
  const wordStart = Math.max(upToCaret.lastIndexOf(' '), upToCaret.lastIndexOf('\t')) + 1;
  const word = upToCaret.slice(wordStart);

  if (word.startsWith('@') && word.length >= 1) {
    const suggestions = userSuggestions(word.slice(1), ctx, true);
    if (suggestions.length === 0) return null;
    return { suggestions, replaceStart: wordStart, replaceEnd: caret };
  }

  if (word.startsWith(':') && word.length >= 3) {
    const query = word.slice(1);
    const names = rank(Object.keys(ctx.emotes), query).slice(0, MAX_SUGGESTIONS);
    if (names.length === 0) return null;
    return {
      replaceStart: wordStart,
      replaceEnd: caret,
      suggestions: names.map((name) => ({ type: 'emote' as const, label: name, insert: `${name} `, imageUrl: ctx.emotes[name] })),
    };
  }

  return null;
}

/** The text after choosing a suggestion, and where the caret goes. */
export function applySuggestion(value: string, result: AssistResult, suggestion: Suggestion): { value: string; caret: number } {
  const next = value.slice(0, result.replaceStart) + suggestion.insert + value.slice(result.replaceEnd);
  return { value: next, caret: result.replaceStart + suggestion.insert.length };
}

/** Recent distinct chatter names, newest first, for name suggestions. */
export function recentChatters(messages: ReadonlyArray<{ username: string }>, limit = 80): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = messages.length - 1; i >= 0 && out.length < limit; i--) {
    const name = messages[i].username;
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
