import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/cn';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import { useVoteStore } from '../../../store/voteStore';
import { calculatePercentages, DEFAULT_OPTION_COLORS } from '../../../lib/voteRules';
import { VoteScene } from '../../../overlay/VoteScene';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';

interface AiPreviewOption {
  label: string;
  imageUrl?: string;
  color?: string;
}

export function VotesView() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const poll = useVoteStore((s) => s.poll);
  const overlayUrl = useVoteStore((s) => s.overlayUrl);
  const recentActivity = useVoteStore((s) => s.recentActivity);
  const isSaving = useVoteStore((s) => s.isSaving);

  const setTitle = useVoteStore((s) => s.setTitle);
  const addOption = useVoteStore((s) => s.addOption);
  const removeOption = useVoteStore((s) => s.removeOption);
  const updateOption = useVoteStore((s) => s.updateOption);
  const setAllowChatVotes = useVoteStore((s) => s.setAllowChatVotes);
  const setAllowChangeVote = useVoteStore((s) => s.setAllowChangeVote);
  const setDurationSeconds = useVoteStore((s) => s.setDurationSeconds);
  const setPollFromAi = useVoteStore((s) => s.setPollFromAi);
  const startPoll = useVoteStore((s) => s.startPoll);
  const endPoll = useVoteStore((s) => s.endPoll);
  const resetVotes = useVoteStore((s) => s.resetVotes);
  const incrementManual = useVoteStore((s) => s.incrementManual);
  const decrementManual = useVoteStore((s) => s.decrementManual);

  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [customDurationInput, setCustomDurationInput] = useState(
    poll.durationSeconds > 0 ? String(poll.durationSeconds) : ''
  );

  // Sync custom input when poll.durationSeconds changes externally
  useEffect(() => {
    if (poll.durationSeconds > 0) {
      setCustomDurationInput(String(poll.durationSeconds));
    } else {
      setCustomDurationInput('');
    }
  }, [poll.durationSeconds]);

  // Option Image Modal State
  const [editingImageOptionId, setEditingImageOptionId] = useState<string | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('');

  // AI Wizard Modal State
  const [isAiWizardOpen, setIsAiWizardOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiOptionCount, setAiOptionCount] = useState(4);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<{
    title: string;
    options: AiPreviewOption[];
  } | null>(null);

  // Live countdown timer for active polls with duration
  useEffect(() => {
    if (!poll.isActive || poll.isEnded || !poll.durationSeconds || !poll.startedAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - (poll.startedAt || 0)) / 1000);
      const remaining = Math.max(0, poll.durationSeconds - elapsed);
      setSecondsRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [poll.isActive, poll.isEnded, poll.durationSeconds, poll.startedAt]);

  const percentages = useMemo(
    () => calculatePercentages(poll.options, poll.totalVotes),
    [poll.options, poll.totalVotes],
  );

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const openImageEditor = (optionId: string, currentUrl?: string) => {
    setEditingImageOptionId(optionId);
    setImageUrlDraft(currentUrl || '');
  };

  const handleSaveOptionImage = () => {
    if (editingImageOptionId) {
      updateOption(editingImageOptionId, {
        imageUrl: imageUrlDraft.trim() || undefined,
      });
      setEditingImageOptionId(null);
      setImageUrlDraft('');
    }
  };

  const handleBrowseOptionImage = async () => {
    try {
      const res = await rpc.invoke(Channels.DialogOpenFile, {
        filter: 'Images (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif',
        title: t(lang, 'votes.browseImage'),
      });
      if (res && res.path) {
        setImageUrlDraft(res.path);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerateAi = async (customTopic?: string) => {
    const topicToUse = customTopic ?? aiTopic;
    if (!topicToUse.trim()) return;

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const res = await rpc.invoke(Channels.VotesGenerateAi, {
        topic: topicToUse.trim(),
        instructions: aiInstructions.trim() || undefined,
        optionCount: aiOptionCount,
        language: lang,
      });

      if (res && res.ok && res.title && res.options && res.options.length > 0) {
        setAiPreview({
          title: res.title,
          options: res.options.map((opt, i) => ({
            label: opt.label,
            imageUrl: opt.imageUrl,
            color: opt.color || DEFAULT_OPTION_COLORS[i % DEFAULT_OPTION_COLORS.length],
          })),
        });
      } else {
        setAiError(res?.error || t(lang, 'votes.aiError'));
      }
    } catch (err) {
      setAiError(String(err));
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleApplyAiPoll = () => {
    if (!aiPreview) return;
    setPollFromAi(aiPreview.title, aiPreview.options);
    setIsAiWizardOpen(false);
    setAiPreview(null);
    setAiTopic('');
    setAiInstructions('');
  };

  const presetTopics = [
    { key: 'openWorld', text: t(lang, 'votes.aiPresets.openWorld') },
    { key: 'horror', text: t(lang, 'votes.aiPresets.horror') },
    { key: 'fps', text: t(lang, 'votes.aiPresets.fps') },
    { key: 'souls', text: t(lang, 'votes.aiPresets.souls') },
    { key: 'cozy', text: t(lang, 'votes.aiPresets.cozy') },
    { key: 'goty', text: t(lang, 'votes.aiPresets.goty') },
    { key: 'nextGame', text: t(lang, 'votes.aiPresets.nextGame') },
  ];

  const statusBadge = useMemo(() => {
    if (poll.isActive && !poll.isEnded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          {t(lang, 'votes.active')}
        </span>
      );
    }
    if (poll.isEnded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-white/10 text-white/70 border border-white/15">
          {t(lang, 'votes.ended')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
        {t(lang, 'votes.idle')}
      </span>
    );
  }, [poll.isActive, poll.isEnded, lang]);

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[#1a2228] text-[#f0f3fa]"
    >
      {/* Top Header Bar */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.08] px-6 bg-[#1a2228]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-bold text-white tracking-tight">
                {t(lang, 'votes.title')}
              </h1>
              {statusBadge}
              {isSaving && (
                <span className="text-[11px] text-[#9aa3af] font-mono animate-pulse">
                  {t(lang, 'votes.saving')}
                </span>
              )}
              {secondsRemaining !== null && secondsRemaining > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <Clock size={12} />
                  {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[#9aa3af]">
              {t(lang, 'votes.subtitle')}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* AI Poll Wizard Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsAiWizardOpen(true);
              setAiError(null);
            }}
            className="gap-1.5 border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
          >
            <Sparkles size={14} className="text-purple-400" />
            <span className="font-semibold">{t(lang, 'votes.aiWizard')}</span>
          </Button>

          {poll.isActive && !poll.isEnded ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void endPoll()}
              className="gap-1.5"
            >
              <Square size={13} className="fill-current" />
              {t(lang, 'votes.end')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void startPoll()}
              className="gap-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500/40"
            >
              <Play size={13} className="fill-current" />
              {t(lang, 'votes.start')}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => void resetVotes()}
            className="gap-1.5"
            title={t(lang, 'votes.reset')}
          >
            <RotateCcw size={13} />
            {t(lang, 'votes.reset')}
          </Button>

          <div className="h-4 w-px bg-white/[0.1] mx-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
            className="gap-1.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
            title={t(lang, 'votes.copyUrl')}
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? t(lang, 'votes.copied') : t(lang, 'votes.copyUrl')}
          </Button>

          <a
            href={overlayUrl}
            target="_blank"
            rel="noreferrer"
            className="grid size-[30px] place-items-center rounded-[4px] border border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white hover:bg-white/[0.08] transition-colors"
            title={t(lang, 'votes.openOverlay')}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Main Two-Column View Area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Form & Choices */}
        <div className="flex w-[55%] flex-col overflow-y-auto border-e border-white/[0.08] p-6 space-y-6 custom-scrollbar">
          {/* Question / Title Section */}
          <section className="rounded-xl border border-white/[0.08] bg-[#23282e]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[12px] font-semibold text-[#cbd3e6] uppercase tracking-wider">
                {t(lang, 'votes.pollTitle')}
              </label>
              <button
                type="button"
                onClick={() => setIsAiWizardOpen(true)}
                className="inline-flex items-center gap-1 text-[11.5px] text-purple-300 hover:text-purple-200 hover:underline transition-colors"
              >
                <Wand2 size={12} className="text-purple-400" />
                {t(lang, 'votes.aiWizard')}
              </button>
            </div>
            <input
              type="text"
              value={poll.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(lang, 'votes.pollTitlePlaceholder')}
              className="w-full rounded-lg border border-white/[0.12] bg-[#1a2228] px-3.5 py-2.5 text-[14px] font-medium text-white placeholder-[#636b80] focus:border-cyan-500/80 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
            />
          </section>

          {/* Choices & Options Section */}
          <section className="rounded-xl border border-white/[0.08] bg-[#23282e]/80 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[13px] font-semibold text-white tracking-tight">
                  {t(lang, 'votes.options')}
                </h2>
                <p className="text-[11px] text-[#9aa3af]">
                  {t(lang, 'votes.chatHint')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption()}
                className="gap-1.5 border-white/[0.12] text-xs hover:border-cyan-500/40"
              >
                <Plus size={13} className="text-cyan-400" />
                {t(lang, 'votes.addOption')}
              </Button>
            </div>

            {/* List of Choice Rows */}
            <div className="space-y-2.5">
              {poll.options.map((opt, index) => (
                <div
                  key={opt.id}
                  className="group flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#1a2228] p-2.5 transition-colors hover:border-white/[0.15]"
                >
                  {/* Color Indicator */}
                  <div
                    className="size-3.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: opt.color || DEFAULT_OPTION_COLORS[index % DEFAULT_OPTION_COLORS.length] }}
                    title={t(lang, 'votes.optionLabel')}
                  />

                  {/* Chat Key Badge */}
                  <div className="flex items-center justify-center font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-cyan-300 shrink-0">
                    #{opt.key}
                  </div>

                  {/* Option Image Thumbnail or Add Image Button */}
                  <div className="relative shrink-0">
                    {opt.imageUrl ? (
                      <div
                        onClick={() => openImageEditor(opt.id, opt.imageUrl)}
                        className="group/img relative size-9 cursor-pointer overflow-hidden rounded-md border border-white/[0.18] bg-black/40 hover:border-cyan-400/70 transition-all shadow-xs"
                        title={t(lang, 'votes.editImage')}
                      >
                        <img
                          src={opt.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <ImageIcon size={13} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openImageEditor(opt.id)}
                        className="grid size-9 place-items-center rounded-md border border-dashed border-white/[0.16] bg-white/[0.02] text-[#868F9D] hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                        title={t(lang, 'votes.addImage')}
                      >
                        <ImageIcon size={14} />
                      </button>
                    )}
                  </div>

                  {/* Option Label Input */}
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                    placeholder={`${t(lang, 'votes.choicePlaceholder')} ${index + 1}`}
                    className="min-w-0 flex-1 rounded bg-transparent px-2 py-1 text-[13px] font-medium text-white placeholder-[#636b80] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />

                  {/* Current Votes Badge */}
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[12px] font-semibold text-white/90 bg-white/[0.05] px-2 py-1 rounded border border-white/[0.08]">
                    <span>{opt.votes}</span>
                    <span className="text-[10px] text-[#9aa3af]">({percentages[opt.id] ?? 0}%)</span>
                  </div>

                  {/* Manual Streamer Increment/Decrement Buttons (+1 / -1) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => decrementManual(opt.id)}
                      disabled={opt.votes <= 0}
                      className="grid size-7 place-items-center rounded border border-white/[0.08] bg-white/[0.04] text-[#9aa3af] hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      title={t(lang, 'votes.minusVote')}
                      aria-label="Decrement vote"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => incrementManual(opt.id)}
                      className="grid size-7 place-items-center rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors font-mono font-bold text-xs"
                      title={t(lang, 'votes.plusVote')}
                      aria-label="Increment vote"
                    >
                      +1
                    </button>
                  </div>

                  {/* Delete Option (min 2 required) */}
                  {poll.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="grid size-7 place-items-center rounded text-[#868F9D] hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title={t(lang, 'votes.deleteChoice')}
                      aria-label="Delete Choice"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Rules & Settings Section */}
          <section className="rounded-xl border border-white/[0.08] bg-[#23282e]/80 p-4 shadow-sm space-y-4">
            <h2 className="text-[13px] font-semibold text-white tracking-tight">
              {t(lang, 'votes.settings')}
            </h2>

            {/* Chat Votes Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-[12.5px] font-medium text-white">
                  {t(lang, 'votes.allowChat')}
                </p>
                <p className="text-[11px] text-[#9aa3af]">
                  {t(lang, 'votes.allowChatHint')}
                </p>
              </div>
              <Switch
                checked={poll.allowChatVotes}
                onChange={setAllowChatVotes}
                label={t(lang, 'votes.allowChat')}
              />
            </div>

            {/* Change Vote Toggle */}
            <div className="flex items-center justify-between py-1 border-t border-white/[0.06] pt-3">
              <div>
                <p className="text-[12.5px] font-medium text-white">
                  {t(lang, 'votes.allowChange')}
                </p>
                <p className="text-[11px] text-[#9aa3af]">
                  {t(lang, 'votes.allowChangeHint')}
                </p>
              </div>
              <Switch
                checked={poll.allowChangeVote}
                onChange={setAllowChangeVote}
                label={t(lang, 'votes.allowChange')}
              />
            </div>

            {/* Duration Selector */}
            <div className="flex flex-col gap-2.5 py-1 border-t border-white/[0.06] pt-3">
              <div>
                <p className="text-[12.5px] font-medium text-white">
                  {t(lang, 'votes.duration')}
                </p>
                <p className="text-[11px] text-[#9aa3af]">
                  {t(lang, 'votes.durationHint')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {[0, 30, 60, 120, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setDurationSeconds(sec);
                        setCustomDurationInput(sec === 0 ? '' : String(sec));
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded text-[11px] font-mono transition-colors',
                        poll.durationSeconds === sec
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'bg-white/[0.04] text-[#9aa3af] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white',
                      )}
                    >
                      {sec === 0 ? t(lang, 'votes.manual') : `${sec}${t(lang, 'votes.secondsShort')}`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ms-1">
                  <span className="text-[11px] font-medium text-[#9aa3af]">
                    {t(lang, 'votes.custom')}:
                  </span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={0}
                      max={7200}
                      value={customDurationInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomDurationInput(val);
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0) {
                          setDurationSeconds(num);
                        } else if (val === '') {
                          setDurationSeconds(0);
                        }
                      }}
                      placeholder="45"
                      className={cn(
                        'w-16 rounded border px-2 py-1 text-center font-mono text-[11.5px] text-white transition-colors focus:outline-none',
                        ![0, 30, 60, 120, 300].includes(poll.durationSeconds)
                          ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30 font-bold'
                          : 'border-white/[0.12] bg-[#1a2228] text-white hover:border-white/[0.2]',
                      )}
                    />
                    <span className="ms-1.5 font-mono text-[11px] text-[#9aa3af]">
                      {t(lang, 'votes.secondsShort')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Live Visualizer & Feed */}
        <div className="flex w-[45%] flex-col overflow-y-auto p-6 space-y-6 bg-[#171d22]/50 custom-scrollbar">
          {/* Live Preview Card */}
          <section className="rounded-xl border border-white/[0.08] bg-[#23282e]/90 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-cyan-400" />
                <h3 className="text-[13px] font-bold text-white tracking-tight">
                  {t(lang, 'votes.preview')}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-[#9aa3af]">
                <Users size={13} />
                <span>{poll.totalVotes} {t(lang, 'votes.totalVotes').toLowerCase()}</span>
              </div>
            </div>

            {/* Widget Simulated Container - renders VoteScene live WYSIWYG */}
            <VoteScene poll={poll} fadeWhenInactive={false} />
          </section>

          {/* Recent Votes Feed */}
          <section className="flex-1 rounded-xl border border-white/[0.08] bg-[#23282e]/90 p-4 shadow-sm">
            <h3 className="text-[12.5px] font-semibold text-white tracking-tight mb-3">
              {t(lang, 'votes.recentVotes')}
            </h3>

            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-[#636b80]">
                {t(lang, 'votes.noActivity')}
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pe-1">
                {recentActivity.map((activity, idx) => (
                  <div
                    key={`${activity.timestamp}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-[#1a2228] px-3 py-2 border border-white/[0.05] text-[12px]"
                  >
                    <span className="font-medium text-cyan-300 truncate max-w-[140px]">
                      @{activity.username}
                    </span>
                    <div className="flex items-center gap-1.5 text-[#cbd3e6]">
                      <span className="text-[#9aa3af]">{t(lang, 'votes.voted')}</span>
                      <span className="font-semibold text-white truncate max-w-[120px]">
                        {activity.optionLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Option Image Modal / Popover */}
      {editingImageOptionId !== null && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingImageOptionId(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-md rounded-xl border border-white/[0.12] bg-[#23282e] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-[14px]">
                <ImageIcon size={16} className="text-cyan-400" />
                <span>{t(lang, 'votes.editImage')}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingImageOptionId(null)}
                className="rounded p-1 text-[#868F9D] hover:text-white hover:bg-white/[0.08]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11.5px] font-medium text-[#9aa3af] mb-1.5">
                  {t(lang, 'votes.imageUrlPrompt')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={imageUrlDraft}
                    onChange={(e) => setImageUrlDraft(e.target.value)}
                    placeholder={t(lang, 'votes.imageUrlPlaceholder')}
                    className="flex-1 rounded-lg border border-white/[0.12] bg-[#1a2228] px-3 py-2 text-[12.5px] text-white placeholder-[#636b80] focus:border-cyan-500/80 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseOptionImage}
                    className="gap-1.5 shrink-0 border-white/[0.12]"
                    title={t(lang, 'votes.browseImage')}
                  >
                    <FolderOpen size={14} className="text-cyan-400" />
                    <span>{t(lang, 'votes.browseImage')}</span>
                  </Button>
                </div>
              </div>

              {/* Thumbnail Preview in Modal */}
              {imageUrlDraft && (
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#1a2228] p-2.5">
                  <div className="size-14 rounded-md overflow-hidden border border-white/[0.15] bg-black/40 shrink-0">
                    <img
                      src={imageUrlDraft}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-[11px] text-[#9aa3af] truncate">
                    <span className="font-mono text-white/90 block truncate">{imageUrlDraft}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrlDraft('')}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/10 shrink-0"
                    title={t(lang, 'votes.removeImage')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              {imageUrlDraft && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImageUrlDraft('');
                    updateOption(editingImageOptionId, { imageUrl: undefined });
                    setEditingImageOptionId(null);
                  }}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                >
                  {t(lang, 'votes.removeImage')}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingImageOptionId(null)}
                className="text-xs"
              >
                {t(lang, 'common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveOptionImage}
                className="text-xs bg-cyan-600 hover:bg-cyan-500"
              >
                {t(lang, 'votes.saving').replace('…', '')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Poll & Game Wizard Modal */}
      {isAiWizardOpen && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isAiGenerating) setIsAiWizardOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-purple-500/30 bg-[#23282e] shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 bg-gradient-to-r from-purple-950/40 via-[#23282e] to-cyan-950/40">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white tracking-tight">
                    {t(lang, 'votes.aiTitle')}
                  </h3>
                  <p className="text-[11.5px] text-[#9aa3af]">
                    {t(lang, 'votes.aiDesc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isAiGenerating && setIsAiWizardOpen(false)}
                disabled={isAiGenerating}
                className="rounded-lg p-1.5 text-[#868F9D] hover:text-white hover:bg-white/[0.08] disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {/* Preset Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-[#868F9D] uppercase tracking-wider mb-2">
                  {t(lang, 'votes.aiPresets')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presetTopics.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setAiTopic(preset.text);
                        void handleGenerateAi(preset.text);
                      }}
                      className={cn(
                        'rounded-full px-3 py-1 text-[11.5px] font-medium border transition-all',
                        aiTopic === preset.text
                          ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                          : 'border-white/[0.1] bg-white/[0.03] text-[#cbd3e6] hover:border-purple-400/50 hover:bg-purple-500/10 hover:text-white',
                      )}
                    >
                      {preset.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Input */}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-semibold text-[#cbd3e6]">
                  {t(lang, 'votes.aiTopic')} <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleGenerateAi();
                  }}
                  placeholder={t(lang, 'votes.aiTopicPlaceholder')}
                  className="w-full rounded-xl border border-white/[0.12] bg-[#1a2228] px-3.5 py-2.5 text-[13.5px] text-white placeholder-[#636b80] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-colors"
                />
              </div>

              {/* Instructions & Option Count Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[#cbd3e6]">
                    {t(lang, 'votes.aiInstructions')}
                  </label>
                  <input
                    type="text"
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder={t(lang, 'votes.aiInstructionsPlaceholder')}
                    className="w-full rounded-xl border border-white/[0.12] bg-[#1a2228] px-3.5 py-2 text-[12.5px] text-white placeholder-[#636b80] focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[#cbd3e6]">
                    {t(lang, 'votes.aiOptionCount')}
                  </label>
                  <div className="flex gap-1">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setAiOptionCount(num)}
                        className={cn(
                          'flex-1 py-2 rounded-lg font-mono text-[12px] font-bold border transition-colors',
                          aiOptionCount === num
                            ? 'bg-purple-500/25 border-purple-500/60 text-purple-200'
                            : 'bg-[#1a2228] border-white/[0.1] text-[#9aa3af] hover:text-white hover:bg-white/[0.05]',
                        )}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate Trigger Button */}
              <div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleGenerateAi()}
                  disabled={!aiTopic.trim() || isAiGenerating}
                  className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-purple-600/20 disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t(lang, 'votes.aiGenerating')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>{t(lang, 'votes.aiGenerate')}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Error Alert */}
              {aiError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-[12.5px] text-rose-300">
                  {aiError}
                </div>
              )}

              {/* Live AI Preview Section */}
              {aiPreview && (
                <div className="space-y-4 pt-2 border-t border-white/[0.08] animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1.5">
                      {t(lang, 'votes.pollTitle')}
                    </label>
                    <input
                      type="text"
                      value={aiPreview.title}
                      onChange={(e) =>
                        setAiPreview({ ...aiPreview, title: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/[0.15] bg-[#1a2228] px-3.5 py-2 text-[14px] font-bold text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9aa3af]">
                      {t(lang, 'votes.options')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {aiPreview.options.map((opt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-[#1a2228] p-3 shadow-sm hover:border-purple-500/40 transition-colors"
                        >
                          {/* Steam/Retrieved Artwork Preview */}
                          <div className="relative size-12 rounded-lg overflow-hidden border border-white/[0.15] bg-black/50 shrink-0">
                            {opt.imageUrl ? (
                              <img
                                src={opt.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[#636b80]">
                                <ImageIcon size={16} />
                              </div>
                            )}
                          </div>

                          {/* Editable Label */}
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-[10px] text-purple-300 font-bold block mb-0.5">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const newOpts = [...aiPreview.options];
                                newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                                setAiPreview({ ...aiPreview, options: newOpts });
                              }}
                              className="w-full rounded bg-transparent px-1 py-0.5 text-[12.5px] font-semibold text-white focus:bg-white/[0.08] focus:outline-none"
                            />
                          </div>

                          {/* Delete Option from Preview (if > 2) */}
                          {aiPreview.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAiPreview({
                                  ...aiPreview,
                                  options: aiPreview.options.filter((_, i) => i !== idx),
                                });
                              }}
                              className="text-[#636b80] hover:text-rose-400 p-1 rounded"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] px-6 py-4 bg-[#1a2228]/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAiWizardOpen(false)}
                disabled={isAiGenerating}
              >
                {t(lang, 'common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyAiPoll}
                disabled={!aiPreview || isAiGenerating}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-40"
              >
                <Check size={14} />
                <span>{t(lang, 'votes.aiApply')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
