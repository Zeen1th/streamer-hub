import type { GenerateGamingQuestionPayload, GenerateGamingQuestionResponse } from '../rpc/contracts';
import { extractTargetUsername } from './sequenceRunner.ts';

export interface DuelExecutionSinks {
  sendChatMessage: (msg: string) => Promise<boolean>;
  smartModTimeout: (target: string, durationSeconds: number, reason: string) => Promise<{ ok: boolean; wasMod?: boolean; error?: string }>;
  generateTrivia?: (payload?: GenerateGamingQuestionPayload) => Promise<GenerateGamingQuestionResponse>;
  log?: (kind: string, msg: string) => void;
  delay?: (ms: number) => Promise<void>;
}

export interface StartDuelOptions {
  challenger: string;
  opponentRaw: string;
  mode: 'random' | 'ai_trivia';
  timeoutDuration?: number;
  timerSeconds?: number;
  broadcasterName?: string;
  language?: 'en' | 'ar' | 'auto';
  category?: string;
  customInstructions?: string;
  messageStart?: string;
  messageWin?: string;
  messageTimeout?: string;
  sinks: DuelExecutionSinks;
}

export interface ActiveTriviaDuel {
  id: string;
  challenger: string;
  opponent: string;
  question: string;
  answer: string;
  acceptableAnswers: string[];
  timeoutDuration: number;
  timerSeconds: number;
  expiresAt: number;
  messageWin?: string;
  messageTimeout?: string;
  sinks: DuelExecutionSinks;
  timerHandle: ReturnType<typeof setTimeout> | null;
}

export const DEFAULT_DUEL_MESSAGES = {
  randomStart: '⚔️ [Timeout Duel] @{challenger} has challenged @{opponent} to a 50/50 timeout duel!',
  randomWin: '💥 The coin has landed! @{loser} lost the duel against @{winner} and has been timed out for {duration}s! 💀',
  triviaStart: '⚔️ [Gaming Trivia Duel] @{challenger} vs @{opponent}! 🎮 Question: {question} | ⏱️ You have {timer}s to answer! First to answer wins. If neither answers, BOTH get timed out!',
  triviaWin: '🎉 Correct! @{winner} answered: "{answer}"! @{loser} lost the duel and gets timed out for {duration}s! 💀',
  triviaTimeout: "⏰ Time's up! Neither @{challenger} nor @{opponent} knew the answer! (Correct answer: {answer}). BOTH get timed out for {duration}s! 💀💀",
};

export function renderDuelMessage(template: string, tokens: Record<string, string | number | undefined>): string {
  if (!template) return '';
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const direct = tokens[key];
    if (direct !== undefined) return String(direct);
    const lowerKey = key.toLowerCase();
    const matchedEntry = Object.entries(tokens).find(([k]) => k.toLowerCase() === lowerKey);
    return matchedEntry && matchedEntry[1] !== undefined ? String(matchedEntry[1]) : match;
  });
}

export interface DuelChatMessageInput {
  username: string;
  displayName?: string;
  userLogin?: string;
  message: string;
}

export function normalizeUsername(str?: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '');
}

export function normalizeAnswer(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // Remove Arabic harakat/tashkeel and tatweel
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?'"!\u060C\u061F\\[\]<>]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripArabicDefiniteArticle(str: string): string {
  if (str.startsWith('ال') && str.length >= 4) {
    return str.slice(2);
  }
  return str;
}

export const BILINGUAL_GAMING_SYNONYMS: Record<string, string[]> = {
  link: ['لينك', 'لنك'],
  zelda: ['زيلدا'],
  mario: ['ماريو'],
  luigi: ['لويجي'],
  bowser: ['باوزر'],
  peach: ['بيتش'],
  kratos: ['كريتوس', 'كرايتوس'],
  atreus: ['اتريوس', 'آتريوس'],
  geralt: ['جيرالت', 'قيرالت', 'جيرالت اوف ريفيا'],
  fromsoftware: ['فروم سوفتوير', 'فروم سوفت', 'fromsoft'],
  radagon: ['راداغون'],
  malenia: ['مالينيا'],
  marika: ['ماريكا'],
  rathalos: ['راثالوس'],
  palico: ['باليكو', 'فيلاين'],
  gunlance: ['غانلانس'],
  capcom: ['كابكوم'],
  hyrule: ['هايرول', 'هيرول'],
  triforce: ['ترايفورس', 'الترايفورس'],
  mastersword: ['ماستر سورد', 'ماسترسورد', 'سيف الماستر', 'سيفماستر'],
  korok: ['كوروغ', 'كوروكس', 'koroks'],
  arthur: ['ارثر', 'آرثر', 'ارثر مورغان', 'آرثر مورغان', 'arthur morgan'],
  michael: ['مايكل', 'مايكل دي سانتا'],
  trevor: ['تريفور'],
  franklin: ['فرانكلين'],
  masterchief: ['ماستر تشيف', 'ماسترتشيف'],
  cortana: ['كورتانا'],
  portal: ['بورتال'],
  rapture: ['رابتشر'],
  lara: ['لارا', 'لارا كروفت', 'لاراكروفت', 'lara croft'],
  tracer: ['تريسر'],
  spike: ['سبايك', 'السبايك'],
  fortnite: ['فورتنايت'],
  bustersword: ['باستر سورد', 'باسترسورد'],
  charmander: ['تشارمندر', 'شارمندر'],
  pikachu: ['بيكاتشو'],
  nightcity: ['نايت سيتي', 'نايتسيتي'],
  geo: ['جيو'],
  gordon: ['غوردون', 'غوردن', 'غوردون فريمان', 'gordon freeman'],
  tails: ['تيلز'],
  sonic: ['سونيك'],
  ubisoft: ['يوبيسوفت', 'يوبي سوفت'],
  wukong: ['ووكونغ', 'وكونغ'],
  kojima: ['كوجيما', 'هيديو كوجيما', 'هيديوكوجيما'],
  pathfinder: ['باثفايندر'],
  minecraft: ['ماينكرافت'],
  sekiro: ['سيكيرو'],
  bloodborne: ['بلودبورن'],
  eldenring: ['الدن رينغ', 'ايلدن رينغ', 'الدنرينغ'],
  darksouls: ['دارك سولز', 'داركسولز'],
  bloodechoes: ['بلود ايكوز', 'ايكوز', 'بلودايكوز'],
  kusabimaru: ['كوسابيمارو'],
  diamondpickaxe: ['بيكاكس الماس', 'بيكاكس دايموند', 'دايموند بيكاكس', 'بيكاكسالماس'],
};

function buildSynonymLookup(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [key, variants] of Object.entries(BILINGUAL_GAMING_SYNONYMS)) {
    const all = [key, ...variants].map(normalizeAnswer).filter(Boolean);
    const unique = Array.from(new Set(all));
    for (const item of unique) {
      const itemNoSpace = item.replace(/\s+/g, '');
      map.set(item, unique);
      map.set(itemNoSpace, unique);
    }
  }
  return map;
}

const SYNONYM_LOOKUP = buildSynonymLookup();

export function isAnswerMatch(guess: string, primaryAnswer: string, acceptable: string[]): boolean {
  const normGuess = normalizeAnswer(guess);
  if (!normGuess) return false;
  const noSpaceGuess = normGuess.replace(/\s+/g, '');
  const unPrefixedGuess = stripArabicDefiniteArticle(normGuess);
  const unPrefixedNoSpaceGuess = unPrefixedGuess.replace(/\s+/g, '');

  const rawCandidates = [primaryAnswer, ...(acceptable || [])].filter(Boolean);
  const candidatesSet = new Set<string>();

  for (const raw of rawCandidates) {
    const norm = normalizeAnswer(raw);
    if (!norm) continue;
    candidatesSet.add(norm);

    // Expand Arabic definite article
    const unPrefixed = stripArabicDefiniteArticle(norm);
    if (unPrefixed !== norm) candidatesSet.add(unPrefixed);

    // Expand synonyms
    const syns = SYNONYM_LOOKUP.get(norm) || SYNONYM_LOOKUP.get(norm.replace(/\s+/g, ''));
    if (syns) {
      for (const s of syns) candidatesSet.add(s);
    }
    if (unPrefixed !== norm) {
      const unPrefixedSyns = SYNONYM_LOOKUP.get(unPrefixed) || SYNONYM_LOOKUP.get(unPrefixed.replace(/\s+/g, ''));
      if (unPrefixedSyns) {
        for (const s of unPrefixedSyns) candidatesSet.add(s);
      }
    }
  }

  for (const cand of candidatesSet) {
    const noSpaceCand = cand.replace(/\s+/g, '');

    // Exact match (with or without spaces, with or without 'ال')
    if (
      normGuess === cand ||
      noSpaceGuess === noSpaceCand ||
      unPrefixedGuess === cand ||
      unPrefixedNoSpaceGuess === noSpaceCand
    ) {
      return true;
    }

    // Substring match for candidates of reasonable length
    if (cand.length >= 3) {
      if (
        normGuess.includes(cand) ||
        noSpaceGuess.includes(noSpaceCand) ||
        unPrefixedGuess.includes(cand) ||
        unPrefixedNoSpaceGuess.includes(noSpaceCand)
      ) {
        return true;
      }

      if (cand.length <= 6 && (cand.includes(normGuess) || noSpaceCand.includes(noSpaceGuess))) {
        if (normGuess.length >= 3) return true;
      }
    }
  }

  return false;
}

class DuelGameManager {
  private activeDuel: ActiveTriviaDuel | null = null;
  private isStarting: boolean = false;
  private lastDuelFinishedAt: number = 0;
  private recentQuestions: string[] = [];
  private recentAnswers: string[] = [];

  constructor() {
    this.loadPersistedRecent();
  }

  private loadPersistedRecent(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawQ = window.localStorage.getItem('streamerhub_recent_duel_questions');
        if (rawQ) {
          const parsed = JSON.parse(rawQ);
          if (Array.isArray(parsed)) this.recentQuestions = parsed.map(String);
        }
        const rawA = window.localStorage.getItem('streamerhub_recent_duel_answers');
        if (rawA) {
          const parsed = JSON.parse(rawA);
          if (Array.isArray(parsed)) this.recentAnswers = parsed.map(String);
        }
      } catch {}
    }
  }

  private savePersistedRecent(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('streamerhub_recent_duel_questions', JSON.stringify(this.recentQuestions.slice(-50)));
        window.localStorage.setItem('streamerhub_recent_duel_answers', JSON.stringify(this.recentAnswers.slice(-50)));
      } catch {}
    }
  }

  public getActiveDuel(): ActiveTriviaDuel | null {
    return this.activeDuel;
  }

  public getRecentQuestions(): string[] {
    return [...this.recentQuestions];
  }

  public getRecentAnswers(): string[] {
    return [...this.recentAnswers];
  }

  public getLastDuelFinishedAt(): number {
    return this.lastDuelFinishedAt;
  }

  public recordRecentQuestion(question: string, answer?: string): void {
    if (!question) return;
    const cleanQ = question.trim();
    this.recentQuestions = this.recentQuestions.filter(
      (q) => q.toLowerCase() !== cleanQ.toLowerCase(),
    );
    this.recentQuestions.push(cleanQ);
    while (this.recentQuestions.length > 50) {
      this.recentQuestions.shift();
    }

    if (answer) {
      const cleanA = answer.trim();
      this.recentAnswers = this.recentAnswers.filter(
        (a) => a.toLowerCase() !== cleanA.toLowerCase(),
      );
      this.recentAnswers.push(cleanA);
      while (this.recentAnswers.length > 50) {
        this.recentAnswers.shift();
      }
    }

    this.savePersistedRecent();
  }

  public clearRecentQuestions(): void {
    this.recentQuestions = [];
    this.recentAnswers = [];
    this.savePersistedRecent();
  }

  public reset(): void {
    if (this.activeDuel?.timerHandle) {
      clearTimeout(this.activeDuel.timerHandle);
    }
    this.activeDuel = null;
    this.isStarting = false;
    this.lastDuelFinishedAt = 0;
  }

  public async startDuel(options: StartDuelOptions): Promise<{ ok: boolean; error?: string }> {
    const { challenger, opponentRaw, mode, sinks } = options;
    const timeoutDuration = Math.max(5, options.timeoutDuration ?? 60);
    const timerSeconds = Math.max(10, options.timerSeconds ?? 30);
    const log = sinks.log ?? (() => {});
    const delay = sinks.delay ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

    const cleanChallenger = (challenger || '').trim().replace(/^@+/, '');
    const cleanOpponent = extractTargetUsername(opponentRaw || '');

    if (!cleanOpponent) {
      await sinks.sendChatMessage(`⚠️ [Duel] You must mention a viewer to challenge! (Usage: !duel @username)`);
      return { ok: false, error: 'EMPTY_OPPONENT' };
    }

    if (normalizeUsername(cleanChallenger) === normalizeUsername(cleanOpponent)) {
      await sinks.sendChatMessage(`⚠️ [Duel] @${cleanChallenger}, you cannot challenge yourself!`);
      return { ok: false, error: 'CANNOT_CHALLENGE_SELF' };
    }

    if (options.broadcasterName && normalizeUsername(cleanOpponent) === normalizeUsername(options.broadcasterName)) {
      await sinks.sendChatMessage(`⚠️ [Duel] Cannot challenge the channel broadcaster!`);
      return { ok: false, error: 'CANNOT_CHALLENGE_BROADCASTER' };
    }

    if (this.isStarting || this.activeDuel) {
      log('trigger', `[Duel] Blocked duplicate duel start (already active or starting)`);
      if (this.activeDuel) {
        await sinks.sendChatMessage(
          `⚠️ [Duel] A duel is already in progress between @${this.activeDuel.challenger} and @${this.activeDuel.opponent}! Please wait until it completes.`,
        );
      }
      return { ok: false, error: 'DUEL_ALREADY_IN_PROGRESS' };
    }

    this.isStarting = true;
    try {
      log('trigger', `[Duel] Starting ${mode} duel: @${cleanChallenger} vs @${cleanOpponent} (Timeout: ${timeoutDuration}s)`);

    // --- Choice 1: Random (50/50 Coin Flip) ---
    if (mode === 'random') {
      const startTpl = options.messageStart?.trim() || DEFAULT_DUEL_MESSAGES.randomStart;
      await sinks.sendChatMessage(
        renderDuelMessage(startTpl, {
          challenger: cleanChallenger,
          opponent: cleanOpponent,
          duration: timeoutDuration,
        }),
      );
      await delay(1800);

      const challengerLoses = Math.random() < 0.5;
      const loser = challengerLoses ? cleanChallenger : cleanOpponent;
      const winner = challengerLoses ? cleanOpponent : cleanChallenger;

      const winTpl = options.messageWin?.trim() || DEFAULT_DUEL_MESSAGES.randomWin;
      await sinks.sendChatMessage(
        renderDuelMessage(winTpl, {
          challenger: cleanChallenger,
          opponent: cleanOpponent,
          winner,
          loser,
          duration: timeoutDuration,
        }),
      );

      const timeoutResult = await sinks.smartModTimeout(
        loser,
        timeoutDuration,
        `Lost 50/50 timeout duel against ${winner}`,
      );

      if (!timeoutResult.ok) {
        log('obs-error', `[Duel] Failed to timeout @${loser}: ${timeoutResult.error}`);
      }

      this.lastDuelFinishedAt = Date.now();
      return { ok: true };
    }

    // --- Choice 2: AI Gaming Trivia Duel ---
    let question = 'Who is the main protagonist of God of War?';
    let answer = 'Kratos';
    let acceptableAnswers = ['kratos', 'كرايتوس', 'كريتوس'];

    if (sinks.generateTrivia) {
      try {
        const res = await sinks.generateTrivia({
          language: options.language || 'auto',
          category: options.category,
          customInstructions: options.customInstructions,
          recentQuestions: this.getRecentQuestions(),
        });
        if (res.ok && res.question && res.answer) {
          question = res.question;
          answer = res.answer;
          acceptableAnswers = res.acceptableAnswers || [res.answer];
          this.recordRecentQuestion(question, answer);
        }
      } catch (err) {
        log('system', `[Duel] Trivia question generation fallback: ${err}`);
      }
    }

    const duelId = crypto.randomUUID();
    const expiresAt = Date.now() + timerSeconds * 1000;

    const timerHandle = setTimeout(async () => {
      await this.handleTimeoutExpiration(duelId);
    }, timerSeconds * 1000);

    this.activeDuel = {
      id: duelId,
      challenger: cleanChallenger,
      opponent: cleanOpponent,
      question,
      answer,
      acceptableAnswers,
      timeoutDuration,
      timerSeconds,
      expiresAt,
      messageWin: options.messageWin,
      messageTimeout: options.messageTimeout,
      sinks,
      timerHandle,
    };

    const startTpl = options.messageStart?.trim() || DEFAULT_DUEL_MESSAGES.triviaStart;
    await sinks.sendChatMessage(
      renderDuelMessage(startTpl, {
        challenger: cleanChallenger,
        opponent: cleanOpponent,
        question,
        timer: timerSeconds,
        duration: timeoutDuration,
      }),
    );

    return { ok: true };
    } finally {
      this.isStarting = false;
    }
  }

  public async handleChatMessage(message: DuelChatMessageInput): Promise<boolean> {
    if (!this.activeDuel) return false;

    const senderIdentities = [message.username, message.displayName, message.userLogin]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(normalizeUsername)
      .filter(Boolean);

    const challengerNorm = normalizeUsername(this.activeDuel.challenger);
    const opponentNorm = normalizeUsername(this.activeDuel.opponent);

    const isChallenger = senderIdentities.includes(challengerNorm);
    const isOpponent = senderIdentities.includes(opponentNorm);

    // Check if the message is from either player
    if (!isChallenger && !isOpponent) {
      return false;
    }

    const duel = this.activeDuel;
    const isCorrect = isAnswerMatch(message.message, duel.answer, duel.acceptableAnswers);

    if (!isCorrect) {
      return false; // Wrong answer, keep listening until timer expires
    }

    // Correct answer!
    if (duel.timerHandle) {
      clearTimeout(duel.timerHandle);
    }
    this.activeDuel = null;
    this.lastDuelFinishedAt = Date.now();

    const winner = isChallenger ? duel.challenger : duel.opponent;
    const loser = isChallenger ? duel.opponent : duel.challenger;

    const winTpl = duel.messageWin?.trim() || DEFAULT_DUEL_MESSAGES.triviaWin;
    await duel.sinks.sendChatMessage(
      renderDuelMessage(winTpl, {
        challenger: duel.challenger,
        opponent: duel.opponent,
        winner,
        loser,
        answer: message.message.trim(),
        correctAnswer: duel.answer,
        question: duel.question,
        duration: duel.timeoutDuration,
        timer: duel.timerSeconds,
      }),
    );

    await duel.sinks.smartModTimeout(
      loser,
      duel.timeoutDuration,
      `Lost trivia duel against ${winner} (Answer: ${duel.answer})`,
    );

    return true;
  }

  private async handleTimeoutExpiration(duelId: string): Promise<void> {
    if (!this.activeDuel || this.activeDuel.id !== duelId) return;

    const duel = this.activeDuel;
    this.activeDuel = null;
    this.lastDuelFinishedAt = Date.now();

    const timeoutTpl = duel.messageTimeout?.trim() || DEFAULT_DUEL_MESSAGES.triviaTimeout;
    await duel.sinks.sendChatMessage(
      renderDuelMessage(timeoutTpl, {
        challenger: duel.challenger,
        opponent: duel.opponent,
        answer: duel.answer,
        question: duel.question,
        duration: duel.timeoutDuration,
        timer: duel.timerSeconds,
      }),
    );

    // Timeout both players
    await duel.sinks.smartModTimeout(
      duel.challenger,
      duel.timeoutDuration,
      `Failed trivia duel against ${duel.opponent} (Time expired, answer was ${duel.answer})`,
    );

    await duel.sinks.smartModTimeout(
      duel.opponent,
      duel.timeoutDuration,
      `Failed trivia duel against ${duel.challenger} (Time expired, answer was ${duel.answer})`,
    );
  }
}

export const duelGameManager = new DuelGameManager();
