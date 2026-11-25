import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Coins, CornerDownRight, Heart, MessageSquare, Redo2, Undo2, Copy, Layers, Minus, Pencil, Play, Plus, RotateCcw, Search, Sparkles, Tally5, Timer, Trash2, TriangleAlert, Tv, Users, X, Zap, type LucideIcon } from 'lucide-react';
import type { CommandSequence, CounterAction, PermissionLevel, SequenceStep } from '../../rpc/contracts';
import { SUB_ACTIONS } from '../../lib/subActionCatalog';
import { triggerChatCommands } from '../../lib/triggerCommands';
import { formatTimerInterval, TIMER_DEFAULT_INTERVAL_MINUTES } from '../../lib/sequenceTimers';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import {
  clampInspectorWidth,
  clampMenuPosition,
  DEFAULT_INSPECTOR_WIDTH,
  filterCommands,
  MAX_INSPECTOR_WIDTH,
  MIN_INSPECTOR_WIDTH,
  projectCommands,
  selectionAfterClick,
  type CommandGroup,
  type CommandRow,
} from '../../lib/commandProjection';
import { renderTemplate } from '../../lib/counterRules';
import { formatTime } from '../../lib/format';
import { t } from '../../i18n/translations';
import { useAutoReplyStore } from '../../store/autoReplyStore';
import { useSequenceStore } from '../../store/sequenceStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useCounterStore } from '../../store/counterStore';
import { useLogStore, type LogEntry } from '../../store/logStore';
import { useSettingsStore } from '../../store/settingsStore';
import { undoManager, useUndoStore } from '../../store/undoStore';
import { useToolStore } from '../../store/toolStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Switch } from '../ui/Switch';
import { Slider } from '../ui/Slider';
import { CounterActionsGridView } from './CounterActionsGridView';
import { AiReplyStudioView } from './AiReplyStudioView';
import { ReplyStudioView } from './ReplyStudioView';
import { SequenceStudioView } from './SequenceStudioView';
import { ProfilePicker } from './ProfilePicker';
import { AddCommandModal, type CommandCreationType } from './AddCommandModal';

const RANKS: PermissionLevel[] = ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'];

function StreamTitleBar({ lang }: { lang: 'en' | 'ar' }) {
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const setLiveStreamTitle = useCounterStore((s) => s.setLiveStreamTitle);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [obsFilePath, setObsFilePath] = useState<string | null>(null);

  const fetchLiveTitle = () => {
    if (!twitchConnected) return;
    rpc.invoke(Channels.TwitchGetTitle)
      .then((res) => {
        if (res.ok && res.title !== undefined) {
          setLiveTitle(res.title ?? '');
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchLiveTitle();
    const interval = setInterval(fetchLiveTitle, 15000);
    return () => clearInterval(interval);
  }, [twitchConnected]);

  useEffect(() => {
    const handleTitleChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail !== undefined) {
        setLiveTitle(customEvent.detail);
      }
    };
    window.addEventListener('twitch-title-changed', handleTitleChanged);
    return () => window.removeEventListener('twitch-title-changed', handleTitleChanged);
  }, []);

  useEffect(() => {
    rpc.invoke(Channels.TwitchGetTitleFilePath)
      .then((res) => {
        if (res?.path) setObsFilePath(res.path);
      })
      .catch(() => undefined);
  }, []);

  const handleCopyObsFilePath = () => {
    if (!obsFilePath) return;
    void navigator.clipboard.writeText(obsFilePath);
    setStatusMsg(t(lang, 'workspace.obsTitleFileCopied'));
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleStartEdit = () => {
    setDraftTitle(liveTitle || '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!draftTitle.trim()) return;
    setBusy(true);
    const ok = await setLiveStreamTitle(draftTitle.trim());
    setBusy(false);
    if (ok) {
      setLiveTitle(draftTitle.trim());
      setEditing(false);
      setStatusMsg(t(lang, 'workspace.titleUpdated'));
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave();
    else if (e.key === 'Escape') setEditing(false);
  };

  if (!twitchConnected) return null;

  return (
    <div className="flex items-center gap-1.5 font-sans text-[11px]">
      {statusMsg && (
        <span className="font-mono text-[10px] text-accent-text">{statusMsg}</span>
      )}
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            dir="auto"
            className="h-[26px] w-[260px] text-[11px]"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={busy}
            placeholder={t(lang, 'workspace.liveTwitchTitle')}
          />
          <Button size="sm" onClick={handleSave} disabled={busy || !draftTitle.trim()} title={t(lang, 'workspace.updateTitle')}>
            <Check size={11} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy} title="Cancel">
            <X size={11} />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleStartEdit}
            className="flex h-[26px] max-w-[280px] items-center gap-1.5 rounded-[4px] border border-[#2e3740] bg-[#22282f] px-2 text-[11px] text-[#cbd3e6] hover:border-[#3d4856] hover:bg-[#283038] hover:text-white transition-colors"
            title={t(lang, 'workspace.editStreamTitle')}
          >
            <Tv size={12} className="shrink-0 text-accent-text" />
            <span className="truncate">{liveTitle || t(lang, 'workspace.liveTwitchTitle')}</span>
            <Pencil size={10} className="shrink-0 text-muted ms-1" />
          </button>
          {obsFilePath && (
            <button
              type="button"
              onClick={handleCopyObsFilePath}
              className="flex h-[26px] items-center gap-1 rounded-[4px] border border-[#2e3740] bg-[#22282f] px-1.5 text-[10px] text-[#8c96ae] hover:border-[#3d4856] hover:bg-[#283038] hover:text-white transition-colors"
              title={`${t(lang, 'workspace.obsTitleFile')}: ${obsFilePath} (${t(lang, 'workspace.obsTitleFileHint')})`}
            >
              <Copy size={10} className="shrink-0 text-accent-text" />
              <span className="truncate max-w-[80px]">title.txt</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CommandsView() {
  const counters = useCounterStore((s) => s.counters);
  const counterLastTriggeredAt = useCounterStore((s) => s.lastTriggerAt);
  const obsStatus = useCounterStore((s) => s.obsStatus);
  const replies = useAutoReplyStore((s) => s.rules);
  const replyLastTriggeredAt = useAutoReplyStore((s) => s.lastTriggeredAt);
  const sequences = useSequenceStore((s) => s.sequences);
  const sequenceLastTriggeredAt = useSequenceStore((s) => s.lastTriggeredAt);
  const group = useToolStore((s) => s.group);
  const query = useToolStore((s) => s.query);
  const selected = useToolStore((s) => s.selected);
  const setSelected = useToolStore((s) => s.setSelected);
  const setQuery = useToolStore((s) => s.setQuery);
  const inspectorWidth = useToolStore((s) => s.inspectorWidth);
  const logBarVisible = useToolStore((s) => s.logBarVisible);
  const canUndo = useUndoStore((s) => s.canUndo);
  const canRedo = useUndoStore((s) => s.canRedo);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [activeCounterDetailId, setActiveCounterDetailId] = useState<string | null>(null);
  const [activeReplyDetailId, setActiveReplyDetailId] = useState<string | null>(null);
  const [activeAiReplyDetailId, setActiveAiReplyDetailId] = useState<string | null>(null);
  const [activeSequenceDetailId, setActiveSequenceDetailId] = useState<string | null>(null);

  useEffect(() => {
    setActiveCounterDetailId(null);
    setActiveReplyDetailId(null);
    setActiveAiReplyDetailId(null);
    setActiveSequenceDetailId(null);
  }, [group]);

  const activeCounter = activeCounterDetailId
    ? counters.find((c) => c.id === activeCounterDetailId) ?? null
    : null;
  const activeReply = activeReplyDetailId
    ? replies.find((r) => r.id === activeReplyDetailId && r.responseMode !== 'ai') ?? null
    : null;
  const activeAiReply = activeAiReplyDetailId
    ? replies.find((r) => r.id === activeAiReplyDetailId && r.responseMode === 'ai') ?? null
    : null;
  const activeSequence = activeSequenceDetailId
    ? sequences.find((s) => s.id === activeSequenceDetailId) ?? null
    : null;

  useEffect(() => {
    const container = workspaceRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          const current = useToolStore.getState().inspectorWidth;
          const clamped = clampInspectorWidth(current, width);
          if (clamped !== current) {
            useToolStore.getState().setInspectorWidth(clamped);
          }
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(
    () =>
      projectCommands({
        counters,
        replies,
        sequences,
        counterLastTriggeredAt,
        replyLastTriggeredAt,
        sequenceLastTriggeredAt,
        obsErrors: obsStatus,
      }),
    [counters, replies, sequences, counterLastTriggeredAt, replyLastTriggeredAt, sequenceLastTriggeredAt, obsStatus],
  );
  const visibleRows = useMemo(() => filterCommands(rows, group, query), [rows, group, query]);
  const selectedRows = rows.filter((row) => selected.includes(row.id));

  useEffect(() => {
    const valid = selected.filter((id) => rows.some((row) => row.id === id));
    if (valid.length !== selected.length) setSelected(valid);
  }, [rows, selected, setSelected]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const createCommand = () => {
    setIsAddModalOpen(true);
  };

  const handleSelectCommandType = (type: CommandCreationType) => {
    setIsAddModalOpen(false);

    if (type === 'counter') {
      useCounterStore.getState().addCounter();
      const id = useCounterStore.getState().selectedId;
      if (id) {
        if (group !== 'all' && group !== 'counters') {
          useToolStore.getState().setGroup('all');
        }
        setSelected([`counter:${id}`]);
      }
      return;
    }

    if (type === 'reply') {
      const id = useAutoReplyStore.getState().add();
      useAutoReplyStore.getState().update(id, { responseMode: 'static', responseEnabled: true });
      if (group !== 'all' && group !== 'replies') {
        useToolStore.getState().setGroup('all');
      }
      setSelected([`reply:${id}`]);
      return;
    }

    if (type === 'ai') {
      const id = useAutoReplyStore.getState().add();
      const isAr = lang === 'ar';
      useAutoReplyStore.getState().update(id, {
        responseMode: 'ai',
        responseEnabled: true,
        agentName: isAr ? 'أروديس' : 'Arrodes',
        agentRole: isAr ? 'مرآة سحرية فضية عليمة بالأسرار من LOTM تملك بحراً من المعلومات وتجيب بذكاء وغموض' : 'All-knowing magic silver mirror from LOTM that holds endless secrets and answers questions with mysterious wit',
        agentContext: isAr ? 'الهوية: مرآة أروديس السحرية الفضية من رواية سيد الغموض (LOTM). تملك علماً واسعاً بالأسرار والمعلومات، ومخلصة تماماً لسيدها العظيم (الستريمر).' : 'Identity: Arrodes, the mysterious magic silver mirror from Lord of the Mysteries (LOTM). It possesses immense knowledge of the universe, secrets, and stream facts. It is completely devoted to the Supreme Master (the streamer).',
        aiInstructions: isAr ? 'أنت أروديس (المرآة السحرية العليمة من LOTM). قدّم إجابات دقيقة وغنية بالمعلومات لـ {username} في أقل من 25 كلمة بنبرة مرآة غامضة ومخلصة للستريمر.' : 'You are Arrodes, the omniscient magic mirror. Answer {username} accurately with insightful knowledge in under 25 words. Maintain a respectful, devoted tone to the streamer and a mysterious mirror vibe.',
      });
      if (group !== 'all' && group !== 'ai') {
        useToolStore.getState().setGroup('all');
      }
      setSelected([`reply:${id}`]);
      return;
    }

    if (type === 'sequence') {
      const id = useSequenceStore.getState().add();
      if (group !== 'all' && group !== 'sequences') {
        useToolStore.getState().setGroup('all');
      }
      setSelected([`sequence:${id}`]);
      return;
    }
  };

  const duplicateSelected = () => {
    const row = selectedRows[0];
    if (!row) return;
    if (row.sourceKind === 'reply') {
      const source = replies.find((item) => item.id === row.sourceId);
      if (!source) return;
      const id = useAutoReplyStore.getState().add();
      const { id: _ignored, ...copy } = source;
      useAutoReplyStore.getState().update(id, { ...copy, triggers: source.triggers.map((value) => value) });
      setSelected([`reply:${id}`]);
      return;
    }
    if (row.sourceKind === 'sequence') {
      const source = sequences.find((item) => item.id === row.sourceId);
      if (!source) return;
      const id = useSequenceStore.getState().add();
      const { id: _ignored, ...copy } = source;
      useSequenceStore.getState().update(id, {
        ...copy,
        name: `${source.name} copy`,
        steps: source.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      });
      setSelected([`sequence:${id}`]);
      return;
    }
    const source = counters.find((item) => item.id === row.sourceId);
    if (!source) return;
    const store = useCounterStore.getState();
    store.addCounter();
    const id = useCounterStore.getState().selectedId;
    if (!id) return;
    store.updateName(id, `${source.name} copy`);
    (['increase', 'decrease', 'reset'] as CounterAction[]).forEach((action) => store.updateCommand(id, action, source.commands[action]));
    if (source.commands.set) store.updateSetCommand(id, source.commands.set);
    store.updateObs(id, source.obs);
    store.updateTitle(id, { titleEnabled: source.titleEnabled, titleTemplate: source.titleTemplate });
    setSelected([`counter:${id}`]);
  };

  const deleteSelected = () => {
    const countersToDelete = new Set(selectedRows.filter((row) => row.sourceKind === 'counter').map((row) => row.sourceId));
    const repliesToDelete = new Set(selectedRows.filter((row) => row.sourceKind === 'reply').map((row) => row.sourceId));
    const sequencesToDelete = new Set(selectedRows.filter((row) => row.sourceKind === 'sequence').map((row) => row.sourceId));
    countersToDelete.forEach((id) => useCounterStore.getState().removeCounter(id));
    repliesToDelete.forEach((id) => useAutoReplyStore.getState().remove(id));
    sequencesToDelete.forEach((id) => useSequenceStore.getState().remove(id));
    setSelected([]);
    if (activeCounterDetailId && countersToDelete.has(activeCounterDetailId)) {
      setActiveCounterDetailId(null);
    }
    if (activeReplyDetailId && repliesToDelete.has(activeReplyDetailId)) {
      setActiveReplyDetailId(null);
    }
    if (activeAiReplyDetailId && repliesToDelete.has(activeAiReplyDetailId)) {
      setActiveAiReplyDetailId(null);
    }
    if (activeSequenceDetailId && sequencesToDelete.has(activeSequenceDetailId)) {
      setActiveSequenceDetailId(null);
    }
  };

  const disableSelected = () => {
    selectedRows.filter((row) => row.sourceKind === 'reply').forEach((row) => useAutoReplyStore.getState().update(row.sourceId, { enabled: false }));
    selectedRows.filter((row) => row.sourceKind === 'sequence').forEach((row) => useSequenceStore.getState().update(row.sourceId, { enabled: false }));
  };

  const closeAllStudios = () => {
    setActiveCounterDetailId(null);
    setActiveReplyDetailId(null);
    setActiveAiReplyDetailId(null);
    setActiveSequenceDetailId(null);
  };

  const hasActiveStudio = Boolean(activeCounter || activeReply || activeAiReply || activeSequence);

  const inspectorRow = selectedRows[0] ?? (
    activeCounterDetailId ? rows.find((r) => r.sourceKind === 'counter' && r.sourceId === activeCounterDetailId) :
    activeReplyDetailId ? rows.find((r) => r.sourceKind === 'reply' && r.sourceId === activeReplyDetailId) :
    activeAiReplyDetailId ? rows.find((r) => r.sourceKind === 'reply' && r.sourceId === activeAiReplyDetailId) :
    activeSequenceDetailId ? rows.find((r) => r.sourceKind === 'sequence' && r.sourceId === activeSequenceDetailId) :
    null
  ) ?? null;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-transparent" aria-label={t(lang, 'workspace.commands')}>
      {/* Page header, as in the approved concept: title and profile, then search and one clear New button.
          Studios bring their own Back header, so this hides while one is open. */}
      {!hasActiveStudio && (
        <header className="commands-header flex shrink-0 flex-wrap items-center gap-3 px-5 pb-1 pt-5">
          <h1 className="font-sans text-[26px] font-semibold leading-8 tracking-tight text-ink">{t(lang, 'workspace.commands')}</h1>
          <ProfilePicker lang={lang} />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {/* Quiet until needed: copy and delete appear with a selection, undo and redo once there is something to undo */}
            {(selectedRows.length > 0 || canUndo || canRedo) && (
              <div className="flex items-center" role="group" aria-label={t(lang, 'workspace.edit')}>
                {selectedRows.length > 0 && (
                  <>
                    <Button size="sm" variant="ghost" onClick={duplicateSelected} title={t(lang, 'workspace.duplicate')} aria-label={t(lang, 'workspace.duplicate')}><Copy size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={deleteSelected} title={t(lang, 'workspace.delete')} aria-label={t(lang, 'workspace.delete')}><Trash2 size={14} /></Button>
                  </>
                )}
                {canUndo && <Button size="sm" variant="ghost" onClick={() => undoManager.undo()} title={`${t(lang, 'undo.button')} (Ctrl+Z)`} aria-label={t(lang, 'undo.button')}><Undo2 size={14} /></Button>}
                {canRedo && <Button size="sm" variant="ghost" onClick={() => undoManager.redo()} title={`${t(lang, 'redo.button')} (Ctrl+Y)`} aria-label={t(lang, 'redo.button')}><Redo2 size={14} /></Button>}
              </div>
            )}
            {selectedRows.length > 1 && (
              <Button size="sm" variant="outline" disabled={!selectedRows.some((row) => (row.sourceKind === 'reply' || row.sourceKind === 'sequence') && row.enabled)} onClick={disableSelected}>
                {t(lang, 'workspace.disableAll')} ({selectedRows.length})
              </Button>
            )}
            <label className="relative w-[230px]">
              <span className="sr-only">{t(lang, 'workspace.filter')}</span>
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-[32px] pe-8 text-[13px]" placeholder={t(lang, 'workspace.filter')} />
              <Search aria-hidden size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-muted" />
            </label>
            <button
              type="button"
              onClick={createCommand}
              className="flex h-[32px] items-center gap-2 rounded-[4px] border border-white/[0.08] bg-accent px-3.5 font-sans text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Plus size={14} aria-hidden />
              {t(lang, 'workspace.newCommand')}
            </button>
          </div>
        </header>
      )}
      <div
        ref={workspaceRef}
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: hasActiveStudio ? 'minmax(0, 1fr)' : `minmax(0,1fr) ${inspectorWidth}px`,
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          {activeCounter ? (
            <CounterActionsGridView
              counter={activeCounter}
              onBack={() => setActiveCounterDetailId(null)}
              lang={lang}
            />
          ) : activeReply ? (
            <ReplyStudioView
              rule={activeReply}
              onBack={() => setActiveReplyDetailId(null)}
              onSwitchToAi={() => {
                setActiveReplyDetailId(null);
                setActiveAiReplyDetailId(activeReply.id);
              }}
              lang={lang}
            />
          ) : activeAiReply ? (
            <AiReplyStudioView
              rule={activeAiReply}
              onBack={() => setActiveAiReplyDetailId(null)}
              onSwitchToNormal={() => {
                setActiveAiReplyDetailId(null);
                setActiveReplyDetailId(activeAiReply.id);
              }}
              lang={lang}
            />
          ) : activeSequence ? (
            <SequenceStudioView
              sequence={activeSequence}
              onBack={() => setActiveSequenceDetailId(null)}
              lang={lang}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <CommandTypeTabs rows={rows} lang={lang} />
              {group === 'ai' && <AiGlobalCooldownBar lang={lang} />}
              <CommandTable
                rows={visibleRows}
                allRows={rows}
                onNewCommand={() => setIsAddModalOpen(true)}
                onConfigureActions={(counterId) => {
                  closeAllStudios();
                  setActiveCounterDetailId(counterId);
                  setSelected([`counter:${counterId}`]);
                }}
                onConfigureReply={(ruleId) => {
                  closeAllStudios();
                  setActiveReplyDetailId(ruleId);
                  setSelected([`reply:${ruleId}`]);
                }}
                onConfigureAiReply={(ruleId) => {
                  closeAllStudios();
                  setActiveAiReplyDetailId(ruleId);
                  setSelected([`reply:${ruleId}`]);
                }}
                onConfigureSequence={(sequenceId) => {
                  closeAllStudios();
                  setActiveSequenceDetailId(sequenceId);
                  setSelected([`sequence:${sequenceId}`]);
                }}
              />
            </div>
          )}
          {logBarVisible && <DockedLog />}
        </div>
        {!hasActiveStudio && (
          <CommandInspector
            row={inspectorRow}
            workspaceRef={workspaceRef}
            onCloseStudio={closeAllStudios}
            onConfigureActions={(counterId) => {
              closeAllStudios();
              setActiveCounterDetailId(counterId);
              setSelected([`counter:${counterId}`]);
            }}
            onConfigureReply={(ruleId) => {
              closeAllStudios();
              setActiveReplyDetailId(ruleId);
              setSelected([`reply:${ruleId}`]);
            }}
            onConfigureAiReply={(ruleId) => {
              closeAllStudios();
              setActiveAiReplyDetailId(ruleId);
              setSelected([`reply:${ruleId}`]);
            }}
            onConfigureSequence={(sequenceId) => {
              closeAllStudios();
              setActiveSequenceDetailId(sequenceId);
              setSelected([`sequence:${sequenceId}`]);
            }}
          />
        )}
      </div>

      <AddCommandModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelect={handleSelectCommandType}
        lang={lang}
      />
    </section>
  );
}

function AiGlobalCooldownBar({ lang }: { lang: 'en' | 'ar' }) {
  const globalSettings = useAutoReplyStore((s) => s.globalSettings);
  const updateGlobalSettings = useAutoReplyStore((s) => s.updateGlobalSettings);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3b2d54] bg-[#241c30]/90 px-3 py-1.5 backdrop-blur-xs shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-300">
          <Sparkles size={11} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-bold text-purple-200">
            {t(lang, 'commands.aiGlobalCooldownBar')}
          </span>
          <span className="hidden sm:inline-block text-[10px] text-muted">
            • {t(lang, 'commands.aiGlobalCooldownBarHint')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        {/* Global AI Cooldown Input */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-purple-200/80 font-medium">
            {t(lang, 'aiStudio.globalAiCooldownShort')}:
          </span>
          <div className="flex items-center gap-1">
            <Input
              dir="ltr"
              type="number"
              min={0}
              max={3600}
              value={globalSettings.globalAiCooldownSeconds || 0}
              onChange={(e) =>
                updateGlobalSettings({
                  globalAiCooldownSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
                })
              }
              className="h-6 w-14 text-center font-mono text-[11px] bg-surface/80 border-[#4a3b68]"
            />
            <span className="font-mono text-[10.5px] text-muted">s</span>
          </div>
        </div>

        {/* Global AI User Cooldown Input */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-purple-200/80 font-medium">
            {t(lang, 'aiStudio.globalAiUserCooldownShort')}:
          </span>
          <div className="flex items-center gap-1">
            <Input
              dir="ltr"
              type="number"
              min={0}
              max={3600}
              value={globalSettings.globalAiUserCooldownSeconds ?? 60}
              onChange={(e) =>
                updateGlobalSettings({
                  globalAiUserCooldownSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
                })
              }
              className="h-6 w-14 text-center font-mono text-[11px] bg-surface/80 border-[#4a3b68]"
            />
            <span className="font-mono text-[10.5px] text-muted">s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandTable({
  rows,
  allRows,
  onConfigureActions,
  onConfigureReply,
  onConfigureAiReply,
  onConfigureSequence,
  onNewCommand,
}: {
  rows: CommandRow[];
  allRows: CommandRow[];
  onConfigureActions?: (counterId: string) => void;
  onConfigureReply?: (ruleId: string) => void;
  onConfigureAiReply?: (ruleId: string) => void;
  onConfigureSequence?: (sequenceId: string) => void;
  onNewCommand?: () => void;
}) {
  const selected = useToolStore((s) => s.selected);
  const setSelected = useToolStore((s) => s.setSelected);
  const setMenu = useToolStore((s) => s.setMenu);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const select = (row: CommandRow, modified: boolean) => setSelected(selectionAfterClick(selected, row.id, modified));
  if (allRows.length === 0) return <EmptyCommands onNewCommand={onNewCommand} />;
  return (
    <div className="app-scroll min-h-0 flex-1 bg-[#23282e] px-5 pb-6 pt-3" tabIndex={0}>
      <ul className="flex flex-col gap-1" aria-label={t(lang, 'workspace.commands')}>
        {rows.map((row) => {
          const active = selected.includes(row.id);
          return (
            <CommandCard
              key={row.id}
              row={row}
              active={active}
              onClick={(event) => {
                select(row, event.ctrlKey || event.metaKey || event.shiftKey);
              }}
              onEdit={() => {
                if (row.sourceKind === 'counter') onConfigureActions?.(row.sourceId);
                else if (row.group === 'ai') onConfigureAiReply?.(row.sourceId);
                else if (row.sourceKind === 'sequence') onConfigureSequence?.(row.sourceId);
                else onConfigureReply?.(row.sourceId);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (!active) setSelected([row.id]);
                setMenu({ ...clampMenuPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight), rowId: row.id });
              }}
            />
          );
        })}
      </ul>
      <CommandContextMenu
        rows={allRows}
        onConfigureActions={onConfigureActions}
        onConfigureReply={onConfigureReply}
        onConfigureAiReply={onConfigureAiReply}
        onConfigureSequence={onConfigureSequence}
      />
    </div>
  );
}

/** The line under a command's name: the chat words or triggers that start it. */
function triggerLine(row: CommandRow): string {
  if (row.sourceKind === 'counter') return (row.subCommands ?? [row.command]).filter(Boolean).map((c) => (c.startsWith('!') ? c : `!${c}`)).join('  ');
  if (row.sourceKind === 'reply') return row.command === row.name ? '' : row.command;
  return row.command;
}

/** One command as a card: what it is, what starts it, who can use it, and an on/off switch. */
function CommandCard({
  row,
  active,
  onClick,
  onEdit,
  onContextMenu,
}: {
  row: CommandRow;
  active: boolean;
  onClick: (event: React.MouseEvent) => void;
  onEdit: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}) {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const isCounter = row.sourceKind === 'counter';
  const isAi = row.group === 'ai';
  const isSequence = row.sourceKind === 'sequence';
  const trigger = triggerLine(row);
  const kind = isCounter
    ? t(lang, 'workspace.type.counter')
    : isAi
      ? t(lang, 'workspace.type.ai')
      : isSequence
        ? `${t(lang, 'workspace.type.sequence')} · ${t(lang, 'workspace.stepsCount', { n: row.sequenceStepCount ?? 0 })}`
        : t(lang, 'workspace.type.reply');

  const setEnabled = (enabled: boolean) => {
    if (row.sourceKind === 'reply') useAutoReplyStore.getState().update(row.sourceId, { enabled });
    else if (row.sourceKind === 'sequence') useSequenceStore.getState().update(row.sourceId, { enabled });
  };

  return (
    <li
      tabIndex={0}
      aria-selected={active}
      onClick={onClick}
      onDoubleClick={onEdit}
      onContextMenu={onContextMenu}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onEdit();
      }}
      className={`command-card group flex cursor-pointer flex-col rounded-[6px] border px-4 py-2.5 transition-colors ${
        active ? 'border-accent/45 bg-accent/10' : 'border-white/[0.07] bg-[#2a3036] hover:bg-[#2f363d]'
      } ${row.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex min-h-[40px] items-center gap-4">
        <div className="flex w-[34%] min-w-0 flex-col">
          <span dir="auto" className="truncate font-sans text-[14px] font-semibold text-ink">
            {row.name || t(lang, 'workspace.untitled')}
          </span>
          {trigger && (
            <span dir="ltr" className="truncate text-start font-mono text-[12px] text-accent-text">
              {trigger}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-muted">
          <span className="truncate">{kind}</span>
          {isSequence && (row.triggerKinds?.length ?? 0) === 0 && (
            row.isCalled ? (
              <span title={t(lang, 'workspace.calledByOthers')} className="inline-flex text-cyan-300">
                <CornerDownRight size={13} aria-hidden />
              </span>
            ) : (
              <span title={t(lang, 'workspace.noTrigger')} aria-label={t(lang, 'workspace.noTrigger')} className="inline-flex text-amber-400">
                <TriangleAlert size={13} />
              </span>
            )
          )}
          {isSequence &&
            row.triggerKinds?.map((kindId) => {
              const Icon = TRIGGER_ICON[kindId];
              return (
                <span key={kindId} title={t(lang, `workspace.trigger.${kindId}`)} aria-label={t(lang, `workspace.trigger.${kindId}`)} className="inline-flex">
                  <Icon size={13} strokeWidth={2} />
                </span>
              );
            })}
        </div>

        <span className="hidden w-[96px] shrink-0 truncate text-[12.5px] text-muted min-[1100px]:block">{t(lang, `ranks.${row.permission}`)}</span>
        <span className="w-[44px] shrink-0 text-end font-mono text-[11.5px] text-muted">
          {row.cooldownSeconds > 0 ? `${row.cooldownSeconds}s` : t(lang, 'workspace.off')}
        </span>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="shrink-0 rounded-[4px] px-2 py-1 text-[12px] text-muted opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          {t(lang, 'workspace.edit')}
        </button>

        <span className="flex w-[44px] shrink-0 justify-end" onClick={(event) => event.stopPropagation()}>
          {isCounter ? (
            <span dir="ltr" className="font-mono text-[13px] font-semibold text-ink">{row.count ?? 0}</span>
          ) : (
            <Switch checked={row.enabled} onChange={setEnabled} label={`${row.enabled ? t(lang, 'workspace.disable') : t(lang, 'workspace.enable')}: ${row.name}`} />
          )}
        </span>
      </div>
      {row.error && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-danger">
          <TriangleAlert size={12} aria-hidden />
          {row.error}
        </div>
      )}
    </li>
  );
}

const TRIGGER_ICON: Record<NonNullable<CommandRow['triggerKinds']>[number], LucideIcon> = {
  channel_points: Coins,
  chat: MessageSquare,
  raid: Users,
  follow: Heart,
  watch_streak: Zap,
  timer: Timer,
};

const TYPE_TABS: { id: CommandGroup; labelKey: string }[] = [
  { id: 'all', labelKey: 'workspace.allCommands' },
  { id: 'counters', labelKey: 'workspace.counters' },
  { id: 'replies', labelKey: 'workspace.preparedReplies' },
  { id: 'ai', labelKey: 'workspace.aiReplies' },
  { id: 'sequences', labelKey: 'workspace.sequences' },
  { id: 'disabled', labelKey: 'workspace.disabled' },
];

/** The command types, as tabs at the top of the list (they used to be nested in the sidebar). */
function CommandTypeTabs({ rows, lang }: { rows: CommandRow[]; lang: 'en' | 'ar' }) {
  const group = useToolStore((s) => s.group);
  const setGroup = useToolStore((s) => s.setGroup);
  const countFor = (id: CommandGroup) =>
    id === 'all' ? rows.length : id === 'disabled' ? rows.filter((r) => !r.enabled).length : rows.filter((r) => r.group === id).length;
  return (
    <div role="tablist" aria-label={t(lang, 'workspace.typeTabs')} className="flex shrink-0 items-center gap-1 overflow-x-auto px-4 pb-1 pt-3">
      {TYPE_TABS.map((tab) => {
        const count = countFor(tab.id);
        const selected = group === tab.id;
        // Disabled is only worth a tab when something is switched off
        if (tab.id === 'disabled' && count === 0 && !selected) return null;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-od-id={`commands-tab-${tab.id}`}
            onClick={() => setGroup(tab.id)}
            className={`relative flex h-[36px] shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-[13.5px] transition-colors ${
              selected
                ? 'font-semibold text-white after:absolute after:start-1/2 after:bottom-[2px] after:h-[3px] after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-accent rtl:after:translate-x-1/2'
                : 'text-[#c3cad3] hover:bg-white/[0.05] hover:text-[#f0f3f7]'
            }`}
          >
            {t(lang, tab.labelKey)}
            <span className={`text-[12px] ${selected ? 'text-[#cbd3dc]' : 'text-[#8b94a1]'}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyCommands({ onNewCommand }: { onNewCommand?: () => void }) {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface text-center">
      <div className="text-[14px] font-extrabold">{t(lang, 'workspace.emptyTitle')}</div>
      <p className="mt-1 max-w-xs text-[12px] text-muted">{t(lang, 'workspace.emptyHint')}</p>
      <Button size="sm" className="mt-3" onClick={onNewCommand}>
        <Plus size={13} />
        {t(lang, 'workspace.newCommand')}
      </Button>
    </div>
  );
}

function CommandContextMenu({
  rows,
  onConfigureActions,
  onConfigureReply,
  onConfigureAiReply,
  onConfigureSequence,
}: {
  rows: CommandRow[];
  onConfigureActions?: (counterId: string) => void;
  onConfigureReply?: (ruleId: string) => void;
  onConfigureAiReply?: (ruleId: string) => void;
  onConfigureSequence?: (sequenceId: string) => void;
}) {
  const menu = useToolStore((s) => s.menu);
  const setMenu = useToolStore((s) => s.setMenu);
  const setSelected = useToolStore((s) => s.setSelected);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const ref = useRef<HTMLDivElement>(null);
  const row = rows.find((item) => item.id === menu?.rowId);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setMenu(null); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', close); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); };
  }, [menu, setMenu]);
  if (!menu || !row) return null;
  const duplicate = () => {
    if (row.sourceKind === 'reply') {
      const source = useAutoReplyStore.getState().rules.find((item) => item.id === row.sourceId);
      if (!source) return;
      const id = useAutoReplyStore.getState().add();
      const { id: _ignored, ...copy } = source;
      useAutoReplyStore.getState().update(id, { ...copy, triggers: [...source.triggers] });
      setSelected([`reply:${id}`]);
    } else if (row.sourceKind === 'sequence') {
      const source = useSequenceStore.getState().sequences.find((item) => item.id === row.sourceId);
      if (!source) return;
      const store = useSequenceStore.getState();
      const id = store.add();
      const { id: _ignored, ...copy } = source;
      store.update(id, {
        ...copy,
        name: `${source.name} copy`,
        steps: source.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      });
      setSelected([`sequence:${id}`]);
    } else {
      const source = useCounterStore.getState().counters.find((item) => item.id === row.sourceId);
      if (!source) return;
      const store = useCounterStore.getState();
      store.addCounter();
      const id = useCounterStore.getState().selectedId;
      if (!id) return;
      store.updateName(id, `${source.name} copy`);
      (['increase', 'decrease', 'reset'] as CounterAction[]).forEach((action) => store.updateCommand(id, action, source.commands[action]));
      if (source.commands.set) store.updateSetCommand(id, source.commands.set);
      store.updateObs(id, source.obs);
      store.updateTitle(id, { titleEnabled: source.titleEnabled, titleTemplate: source.titleTemplate });
      setSelected([`counter:${id}`]);
    }
    setMenu(null);
  };
  const remove = () => {
    if (row.sourceKind === 'counter') useCounterStore.getState().removeCounter(row.sourceId);
    else if (row.sourceKind === 'sequence') useSequenceStore.getState().remove(row.sourceId);
    else useAutoReplyStore.getState().remove(row.sourceId);
    setSelected([]); setMenu(null);
  };
  const item = 'flex h-7 w-full items-center justify-between px-2.5 text-start text-[11.5px] text-[#cbd3e6] hover:bg-[#283038] hover:text-white rounded-[3px] transition-colors';
  return <div ref={ref} role="menu" className="fixed z-[80] w-[185px] rounded-[4px] border border-[#2e3740] bg-[#1a2228] py-1 text-ink shadow-lg" style={{ left: menu.x, top: menu.y }}>
    <button
      role="menuitem"
      className={item}
      onClick={() => {
        if (row.sourceKind === 'counter') onConfigureActions?.(row.sourceId);
        else if (row.group === 'ai') onConfigureAiReply?.(row.sourceId);
        else if (row.sourceKind === 'sequence') onConfigureSequence?.(row.sourceId);
        else if (row.sourceKind === 'reply') onConfigureReply?.(row.sourceId);
        setMenu(null);
      }}
    >
      {t(lang, 'workspace.edit')}
      <kbd className="font-mono text-[9.5px]">Enter</kbd>
    </button>
    {row.sourceKind === 'counter' && (
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          onConfigureActions?.(row.sourceId);
          setMenu(null);
        }}
      >
        {t(lang, 'workspace.viewActions')}
        <span className="font-mono text-[9.5px] text-muted">3</span>
      </button>
    )}
    {row.sourceKind === 'reply' && row.group !== 'ai' && (
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          onConfigureReply?.(row.sourceId);
          setMenu(null);
        }}
      >
        {t(lang, 'workspace.openReplyStudio')}
        <Pencil size={11} className="text-accent-text" />
      </button>
    )}
    {row.sourceKind === 'reply' && row.group === 'ai' && (
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          onConfigureAiReply?.(row.sourceId);
          setMenu(null);
        }}
      >
        {t(lang, 'aiStudio.openStudio')}
        <Sparkles size={11} className="text-accent-text" />
      </button>
    )}
    {row.sourceKind === 'sequence' && (
      <button
        role="menuitem"
        className={item}
        onClick={() => {
          onConfigureSequence?.(row.sourceId);
          setMenu(null);
        }}
      >
        {t(lang, 'sequence.openStudio')}
        <Layers size={11} className="text-accent-text" />
      </button>
    )}
    <button role="menuitem" className={item} onClick={() => { void navigator.clipboard?.writeText(`${row.sourceKind === 'counter' ? '!' : ''}${row.command}`); setMenu(null); }}>{t(lang, 'workspace.copyCommand')}<kbd className="font-mono text-[9.5px]">Ctrl+C</kbd></button>
    <button role="menuitem" className={item} onClick={duplicate}>{t(lang, 'workspace.duplicate')}<kbd className="font-mono text-[9.5px]">Ctrl+D</kbd></button>
    {row.sourceKind === 'reply' && <><div className="my-1 border-t border-hair" /><button role="menuitem" className={item} onClick={() => { useAutoReplyStore.getState().update(row.sourceId, { enabled: row.enabled ? false : true }); setMenu(null); }}>{row.enabled ? t(lang, 'workspace.disable') : t(lang, 'workspace.enable')}</button></>}
    {row.sourceKind === 'sequence' && (
      <>
        <div className="my-1 border-t border-hair" />
        <button
          role="menuitem"
          className={item}
          onClick={() => {
            useSequenceStore.getState().update(row.sourceId, { enabled: !row.enabled });
            setMenu(null);
          }}
        >
          {row.enabled ? t(lang, 'workspace.disable') : t(lang, 'workspace.enable')}
        </button>
      </>
    )}
    <div className="my-1 border-t border-hair" /><button role="menuitem" className={item} onClick={remove}>{t(lang, 'workspace.delete')}<kbd className="font-mono text-[9.5px]">Del</kbd></button>
  </div>;
}

function CommandInspector({
  row,
  workspaceRef,
  onConfigureActions,
  onConfigureReply,
  onConfigureAiReply,
  onConfigureSequence,
  onCloseStudio,
}: {
  row: CommandRow | null;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  onConfigureActions?: (counterId: string) => void;
  onConfigureReply?: (ruleId: string) => void;
  onConfigureAiReply?: (ruleId: string) => void;
  onConfigureSequence?: (sequenceId: string) => void;
  onCloseStudio?: () => void;
}) {
  const setSelected = useToolStore((s) => s.setSelected);
  const inspectorWidth = useToolStore((s) => s.inspectorWidth);
  const setInspectorWidth = useToolStore((s) => s.setInspectorWidth);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = useToolStore.getState().inspectorWidth;
    const container = workspaceRef.current;
    // In a right-to-left layout the inspector sits on the left, so dragging right makes it wider.
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = rtl ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      const targetWidth = startWidth + deltaX;
      const containerWidth = container?.getBoundingClientRect().width;
      setInspectorWidth(clampInspectorWidth(targetWidth, containerWidth));
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const containerWidth = workspaceRef.current?.getBoundingClientRect().width;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setInspectorWidth(clampInspectorWidth(inspectorWidth + (rtl ? -16 : 16), containerWidth));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setInspectorWidth(clampInspectorWidth(inspectorWidth + (rtl ? 16 : -16), containerWidth));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);
    }
  };

  const handleClose = () => {
    setSelected([]);
    onCloseStudio?.();
  };

  return (
    <aside
      className="relative flex min-h-0 flex-col border-s border-[#262d34] bg-[#1a2228]"
      tabIndex={0}
      aria-label={t(lang, 'workspace.inspector')}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t(lang, 'workspace.resizeInspector')}
        aria-valuenow={inspectorWidth}
        aria-valuemin={MIN_INSPECTOR_WIDTH}
        aria-valuemax={MAX_INSPECTOR_WIDTH}
        tabIndex={0}
        title={t(lang, 'workspace.resizeInspector')}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => setInspectorWidth(DEFAULT_INSPECTOR_WIDTH)}
        onKeyDown={handleKeyDown}
        className="group absolute -start-[5px] top-0 bottom-0 z-20 w-[9px] cursor-col-resize select-none touch-none focus-visible:outline-none"
      >
        <div
          className={`absolute inset-y-0 start-[3px] w-[2px] transition-colors ${
            isDragging
              ? 'bg-accent'
              : 'bg-transparent group-hover:bg-accent/70 group-focus-visible:bg-accent'
          }`}
        />
      </div>
      {row ? (
        row.sourceKind === 'counter' ? (
          <CounterInspector
            row={row}
            onClose={handleClose}
            onConfigureActions={onConfigureActions}
          />
        ) : row.sourceKind === 'sequence' ? (
          <SequenceInspector
            row={row}
            onClose={handleClose}
            onConfigureSequence={onConfigureSequence}
          />
        ) : (
          <ReplyInspector
            row={row}
            onClose={handleClose}
            onConfigureReply={onConfigureReply}
            onConfigureAiReply={onConfigureAiReply}
          />
        )
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-5 pt-6">
          <p className="text-[13px] leading-5 text-muted">{t(lang, 'workspace.selectHint')}</p>
          {/* The live stream title lives here when no command is selected, out of the page header */}
          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-muted">{t(lang, 'workspace.liveTwitchTitle')}</div>
            <StreamTitleBar lang={lang} />
          </div>
        </div>
      )}
    </aside>
  );
}

function SequenceInspector({
  row,
  onClose,
  onConfigureSequence,
}: {
  row: CommandRow;
  onClose: () => void;
  onConfigureSequence?: (sequenceId: string) => void;
}) {
  const sequence = useSequenceStore((s) => s.sequences.find((item) => item.id === row.sourceId));
  const update = useSequenceStore((s) => s.update);
  const runSequence = useSequenceStore((s) => s.runSequence);
  const isExecuting = useSequenceStore((s) => s.activeRunningSequenceId === row.sourceId);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [testTarget, setTestTarget] = useState('');

  if (!sequence) return null;

  return (
    <>
      <InspectorHeader
        title={sequence.name || t(lang, 'workspace.untitled')}
        kind={t(lang, 'sequence.title')}
        onClose={onClose}
      />
      <div className="app-scroll min-h-0 flex-1 space-y-3 px-5 pb-4">
        <WhenThenCard
          lang={lang}
          when={whenLines(sequence, row, lang)}
          then={sequence.steps.filter((s) => s.type !== 'comment').map((s) => stepSentence(s, lang))}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfigureSequence?.(sequence.id)}
            className="flex h-[32px] flex-1 items-center justify-center gap-1.5 rounded-[4px] border border-white/[0.08] bg-accent font-sans text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Layers size={13} aria-hidden />
            {t(lang, 'workspace.edit')}
          </button>
          <Button
            variant="outline"
            className="h-[32px] flex-1 whitespace-nowrap text-[13px]"
            disabled={isExecuting}
            onClick={() => {
              const formatted = testTarget.trim() ? (testTarget.trim().startsWith('@') ? testTarget.trim() : `@${testTarget.trim()}`) : '';
              void runSequence(sequence.id, { username: 'Streamer', userInput: formatted, source: 'test' });
            }}
          >
            <Play size={12} aria-hidden />
            {isExecuting ? t(lang, 'sequence.running') : t(lang, 'sequence.runTest')}
          </Button>
        </div>
        <div className="relative">
          <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">@</span>
          <Input
            value={testTarget}
            onChange={(e) => setTestTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const formatted = testTarget.trim() ? (testTarget.trim().startsWith('@') ? testTarget.trim() : `@${testTarget.trim()}`) : '';
                void runSequence(sequence.id, { username: 'Streamer', userInput: formatted, source: 'test' });
              }
            }}
            placeholder={t(lang, 'sequence.testTargetPlaceholder')}
            className="h-[30px] ps-6 font-mono text-[12px]"
          />
        </div>

        <div className="space-y-2 pt-1">
          <CooldownField
            value={sequence.cooldownSeconds}
            onChange={(cooldownSeconds) => update(sequence.id, { cooldownSeconds })}
          />
        </div>

        {/* Older sequences created before the trigger list existed keep their simple trigger fields here */}
        {!Array.isArray(sequence.triggers) && (
          <MoreSettings label={t(lang, 'workspace.moreSettings')}>
            {(sequence.triggerType === 'channel_points' || sequence.triggerType === 'both') && (
              <InspectorField label={t(lang, 'sequence.rewardTitle')}>
                <Input
                  dir="auto"
                  className="font-mono text-[11px] h-8"
                  value={sequence.rewardTitle || ''}
                  onChange={(e) => update(sequence.id, { rewardTitle: e.target.value })}
                  placeholder={t(lang, 'sequence.rewardSelectPlaceholder')}
                />
              </InspectorField>
            )}
            {(sequence.triggerType === 'chat' || sequence.triggerType === 'both') && (
              <InspectorField label={t(lang, 'sequence.chatTrigger')}>
                <Input
                  dir="auto"
                  className="font-mono text-[11px] h-8"
                  value={sequence.chatTrigger || ''}
                  onChange={(e) => update(sequence.id, { chatTrigger: e.target.value })}
                  placeholder="!hydrate"
                />
              </InspectorField>
            )}
          </MoreSettings>
        )}
      </div>
      {/* The When / Then card already lists the steps, so the footer only keeps Saved and Delete */}
      <InspectorFooter
        savedAt={null}
        onDelete={() => useSequenceStore.getState().remove(sequence.id)}
      />
    </>
  );
}

function CounterInspector({
  row,
  onClose,
  onConfigureActions,
}: {
  row: CommandRow;
  onClose: () => void;
  onConfigureActions?: (counterId: string) => void;
}) {
  const counter = useCounterStore((s) => s.counters.find((item) => item.id === row.sourceId));
  const updateName = useCounterStore((s) => s.updateName);
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);
  const updateObs = useCounterStore((s) => s.updateObs);
  const updateTitle = useCounterStore((s) => s.updateTitle);
  const sync = useCounterStore((s) => s.configSync);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!counter?.titleEnabled) return;
    rpc.invoke(Channels.TwitchGetTitle).then((result) => setCurrentTitle(result.title ?? null)).catch(() => undefined);
  }, [counter?.id, counter?.titleEnabled]);

  if (!counter) return null;
  const primaryCommand = counter.commands.increase.commandName;
  const literalFile = counter.obs.enabled ? renderTemplate(counter.obs.template, counter.count, null) : null;
  const literalTitle = counter.titleEnabled && counter.titleTemplate ? renderTemplate(counter.titleTemplate, counter.count, null, currentTitle) : null;

  return (
    <>
      <InspectorHeader
        title={counter.name}
        kind={primaryCommand ? `${t(lang, 'workspace.counterCommand')} · !${primaryCommand}` : t(lang, 'workspace.counterCommand')}
        onClose={onClose}
      />
      <div className="app-scroll min-h-0 flex-1 space-y-3 px-5 pb-4">
        {/* Counter Name */}
        <InspectorField label={t(lang, 'config.name')}>
          <Input
            dir="auto"
            className="font-sans font-bold"
            value={counter.name}
            onChange={(event) => updateName(counter.id, event.target.value.slice(0, 40))}
            placeholder="Counter name"
            maxLength={40}
          />
        </InspectorField>

        {/* Actions Studio Launcher Card */}
        <div className="rounded-[5px] border border-[#384048] bg-[#2e3338] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="ui-label">{t(lang, 'workspace.counterActions')}</div>
            <span className="rounded-[3px] border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#a5b4fc]">
              {t(lang, 'workspace.actionsPill')}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-between h-8 text-[11px] rounded-[4px] border border-[#3d4856] bg-[#242a30] text-[#f0f3fa] hover:border-[#4d5a6c] hover:bg-[#2c333a]"
            onClick={() => onConfigureActions?.(counter.id)}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Tally5 size={12} className="text-accent-text" />
              <span>{t(lang, 'workspace.openActionsView')}</span>
            </div>
            <ChevronRight size={12} className="text-muted" />
          </Button>
        </div>

        {/* Live Count Readout & Quick Manual Adjust Controls */}
        <div className="rounded-[5px] border border-[#384048] bg-[#2e3338] p-3">
          <div className="flex items-center justify-between">
            <span className="ui-label">{t(lang, 'workspace.currentCount')}</span>
            <span className="font-sans text-[10px] text-muted">{t(lang, 'workspace.quickAdjust')}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div dir="ltr" className="font-mono text-3xl font-extrabold text-accent-text tracking-tight">
              {String(counter.count).padStart(3, '0')}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="size-8 p-0"
                disabled={counter.count <= 0}
                onClick={() => decrementManual(counter.id)}
                title="−1"
                aria-label="−1"
              >
                <Minus size={13} />
              </Button>
              <Button
                size="sm"
                className="size-8 p-0"
                onClick={() => incrementManual(counter.id)}
                title="+1"
                aria-label="+1"
              >
                <Plus size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="size-8 p-0 text-muted hover:text-accent-text"
                disabled={counter.count <= 0}
                onClick={() => resetManual(counter.id)}
                title="Reset"
                aria-label="Reset"
              >
                <RotateCcw size={12} />
              </Button>
            </div>
          </div>
        </div>

        {/* Outputs: on/off at a glance, details tucked away */}
        <div className="border-t-2 border-rule pt-3">
          <div className="ui-label mb-2">{t(lang, 'workspace.writesTo')}</div>
          <SinkRow
            label={t(lang, 'workspace.obsTextFile')}
            detail={counter.obs.template}
            checked={counter.obs.enabled}
            onChange={(enabled) => updateObs(counter.id, { enabled })}
          />
          <SinkRow
            label={t(lang, 'workspace.streamTitle')}
            detail={counter.titleTemplate || t(lang, 'workspace.notSet')}
            checked={counter.titleEnabled ?? false}
            onChange={(titleEnabled) =>
              updateTitle(counter.id, {
                titleEnabled,
                titleTemplate: counter.titleTemplate || `{title} | ${counter.name}: {count}`,
              })
            }
          />
        </div>

        <button
          type="button"
          onClick={() => onConfigureActions?.(counter.id)}
          className="w-full rounded-[4px] border border-dashed border-[#3d4856] px-3 py-2 text-start font-sans text-[11px] text-muted hover:border-accent hover:text-ink"
        >
          {lang === 'ar'
            ? 'الملف والنص والعنوان واختصار لوحة المفاتيح تُضبط داخل صفحة العدّاد ←'
            : 'The file, its text, the title and the keyboard shortcut are set inside the counter page →'}
        </button>
      </div>

      <InspectorFooter
        outputs={[literalFile, literalTitle].filter(Boolean) as string[]}
        savedAt={sync.at}
        onDelete={() => useCounterStore.getState().removeCounter(counter.id)}
      />
    </>
  );
}

function ReplyInspector({
  row,
  onClose,
  onConfigureReply,
  onConfigureAiReply,
}: {
  row: CommandRow;
  onClose: () => void;
  onConfigureReply?: (ruleId: string) => void;
  onConfigureAiReply?: (ruleId: string) => void;
}) {
  const rule = useAutoReplyStore((s) => s.rules.find((item) => item.id === row.sourceId));
  const update = useAutoReplyStore((s) => s.update);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  if (!rule) return null;

  const isAi = rule.responseMode === 'ai';
  const openStudio = () => {
    if (isAi) {
      onConfigureAiReply?.(rule.id);
    } else {
      onConfigureReply?.(rule.id);
    }
  };

  const preview = isAi
    ? (rule.aiFallback || rule.aiInstructions || t(lang, 'workspace.aiGenerated'))
    : rule.response.replaceAll('{mention}', '@viewer').replaceAll('{username}', 'viewer').replaceAll('{message}', t(lang, 'workspace.sampleMessage'));

  return (
    <>
      <InspectorHeader
        title={rule.triggers[0] || t(lang, 'workspace.untitled')}
        kind={isAi ? t(lang, 'workspace.aiReply') : t(lang, 'workspace.preparedReply')}
        onClose={onClose}
      />
      <div className="app-scroll min-h-0 flex-1 space-y-3 px-5 pb-4">
        {/* Quick Enable/Disable toggle */}
        <div className="flex items-center justify-between rounded-md border border-hair bg-surface-2/40 px-3 py-2">
          <div className="space-y-0.5">
            <div className="text-[12.5px] font-bold text-ink">
              {rule.enabled ? t(lang, 'workspace.enable') : t(lang, 'workspace.disable')}
            </div>
            <div className="font-mono text-[10px] text-muted">
              {rule.enabled ? 'Active in chat' : 'Paused / Inactive'}
            </div>
          </div>
          <Switch
            checked={rule.enabled}
            onChange={(enabled) => update(rule.id, { enabled })}
            label={t(lang, 'workspace.enable')}
          />
        </div>

        {/* Studio Launcher & Primary Config Card */}
        <div className="rounded-[5px] border border-[#384048] bg-[#2e3338] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="ui-label font-bold text-[11px]">Command Studio</span>
            <span
              className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                isAi
                  ? 'border-purple-500/30 bg-purple-500/15 text-[#c4b5fd]'
                  : 'border-[#38424d] bg-[#242b32] text-accent-text'
              }`}
            >
              {isAi ? 'AI Reply' : 'Prepared'}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full justify-between h-9 text-[11.5px] rounded-[4px] border border-[#3d4856] bg-[#242a30] text-[#f0f3fa] hover:border-[#4d5a6c] hover:bg-[#2c333a] shadow-sm font-semibold"
            onClick={openStudio}
          >
            <div className="flex items-center gap-2">
              {isAi ? <Sparkles size={13} className="text-accent-text" /> : <Pencil size={13} className="text-accent-text" />}
              <span>{isAi ? t(lang, 'aiStudio.openStudio') : t(lang, 'workspace.openReplyStudio')}</span>
            </div>
            <ChevronRight size={13} className="text-muted" />
          </Button>

          {/* Read-only Triggers Summary */}
          <div className="space-y-1.5 pt-1 border-t border-hair">
            <div className="flex items-center justify-between">
              <span className="ui-label text-[10px] text-muted">{t(lang, 'workspace.triggerWord')}</span>
              <button
                type="button"
                onClick={openStudio}
                className="text-[10px] font-mono text-accent-text hover:underline cursor-pointer"
              >
                Edit in Studio
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {rule.triggers.map((trig, idx) => (
                <span
                  key={idx}
                  className="rounded border border-hair bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-ink"
                >
                  {trig}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Permissions */}
        <PermissionField
          value={rule.minimumRank ?? 'everyone'}
          onChange={(minimumRank) => update(rule.id, { minimumRank })}
        />

        {/* Cooldown */}
        <CooldownField
          value={rule.cooldownSeconds}
          onChange={(cooldownSeconds) => update(rule.id, { cooldownSeconds })}
        />

        <p className="font-sans text-[10.5px] leading-snug text-muted">
          {t(lang, 'workspace.inspectorMoreInStudio')}
        </p>
      </div>
      <InspectorFooter outputs={[preview].filter(Boolean)} savedAt={null} onDelete={() => useAutoReplyStore.getState().remove(rule.id)} />
    </>
  );
}

/** Collapsed-by-default section for settings that are not needed day to day. */
function MoreSettings({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t-2 border-rule pt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between py-1 text-start"
      >
        <span className="ui-label">{label}</span>
        <ChevronRight size={12} className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}

function InspectorHeader({ title, kind, onClose }: { title: string; kind: string; onClose: () => void }) {
  return (
    <header className="shrink-0 px-5 pb-3 pt-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-sans text-[12px] text-muted">{kind}</div>
          <div dir="auto" className="mt-0.5 truncate font-sans text-[20px] font-semibold leading-7 text-ink">{title}</div>
        </div>
        <button type="button" className="grid size-7 place-items-center rounded-[4px] text-muted hover:bg-white/[0.06] hover:text-ink" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
    </header>
  );
}

/** A plain-language line for one sequence step, as in the concept's "Then" list. */
function stepSentence(step: SequenceStep, lang: 'en' | 'ar'): { label: string; detail: string } {
  const entry = SUB_ACTIONS.find((a) => a.type === step.type && (!a.options?.moderationAction || a.options.moderationAction === step.moderationAction)) ?? SUB_ACTIONS.find((a) => a.type === step.type);
  const label = entry ? entry[lang].label : step.type;
  let detail = '';
  if (step.type === 'wait') detail = `${step.waitDuration ?? 3} ${step.waitUnit === 'minutes' ? (lang === 'ar' ? 'د' : 'min') : (lang === 'ar' ? 'ث' : 's')}`;
  else if (step.type === 'chat') detail = step.chatMessage ?? '';
  else if (step.type === 'tts') detail = step.ttsText ?? '';
  else if (step.type === 'command') detail = step.commandTrigger ?? '';
  else if (step.type === 'moderation') detail = step.targetUser ?? '';
  else if (step.type === 'poll') detail = step.pollQuestion ?? '';
  return { label, detail };
}

/** The When lines for a sequence: each trigger named by its kind, e.g. "Chat command: !hydrate". */
function whenLines(sequence: CommandSequence, row: CommandRow, lang: 'en' | 'ar'): string[] {
  if (!Array.isArray(sequence.triggers)) return row.command.split(', ').filter((label) => label && label !== '(No Triggers)');
  return sequence.triggers
    .filter((trigger) => trigger.enabled !== false)
    .map((trigger) => {
      if (trigger.type === 'twitch_channel_points') return `${t(lang, 'workspace.trigger.channel_points')}: ${trigger.rewardTitle || '?'}`;
      if (trigger.type === 'twitch_chat') return `${t(lang, 'workspace.trigger.chat')}: ${triggerChatCommands(trigger).join(' / ') || '?'}`;
      if (trigger.type === 'twitch_raid') return `${t(lang, 'workspace.trigger.raid')} (${trigger.minViewers ?? 1}+)`;
      if (trigger.type === 'twitch_follow') return t(lang, 'workspace.trigger.follow');
      if (trigger.type === 'twitch_watch_streak') return t(lang, 'workspace.trigger.watch_streak');
      if (trigger.type === 'timer') return `${t(lang, 'workspace.trigger.timer')}: ${formatTimerInterval(trigger.intervalMinutes ?? TIMER_DEFAULT_INTERVAL_MINUTES)}`;
      return String(trigger.type);
    });
}

/** The concept's summary card: what starts the command, then what it does, in plain words. */
function WhenThenCard({ when, then, lang }: { when: string[]; then: { label: string; detail: string }[]; lang: 'en' | 'ar' }) {
  return (
    <div className="when-then rounded-[6px] border border-white/[0.07] bg-[#2a3036] px-4 py-3.5 text-[13px] leading-5">
      <div className="text-[12px] font-semibold text-muted">{t(lang, 'workspace.when')}</div>
      <ul className="mt-1.5 space-y-1">
        {when.length ? when.map((line, i) => <li key={i} className="text-ink"><bdi dir="auto">{line}</bdi></li>) : <li className="text-muted">{t(lang, 'workspace.noTrigger')}</li>}
      </ul>
      <div className="my-3 h-px bg-white/[0.07]" />
      <div className="text-[12px] font-semibold text-muted">{t(lang, 'workspace.then')}</div>
      <ol className="mt-1.5 space-y-1">
        {then.map((line, i) => (
          <li key={i} className="flex gap-2 text-ink">
            <span className="shrink-0 text-muted">{i + 1}.</span>
            {/* Label and message are isolated so an English message after an Arabic label keeps its order */}
            <span className="min-w-0 break-words">
              <bdi>{line.label}</bdi>
              {line.detail && (
                <>
                  {': '}
                  <bdi dir="auto" className="text-muted">{line.detail}</bdi>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) { return <div><div className="ui-label mb-1.5">{label}</div>{children}</div>; }

function PermissionField({ value, onChange }: { value: PermissionLevel; onChange: (value: PermissionLevel) => void }) {
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  const labels: Record<PermissionLevel, string> = { everyone: 'All', subscriber: 'Sub', vip: 'VIP', mod: 'Mod', broadcaster: 'Cast' };
  return <InspectorField label={t(lang, 'workspace.who')}><SegmentedControl value={value} options={RANKS.map((rank) => ({ value: rank, label: labels[rank] }))} onChange={onChange} /></InspectorField>;
}

function CooldownField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  // One quiet row, Windows style: the label and value on one line, a slim slider under it
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink">{t(lang, 'workspace.cooldown')}</span>
        <span className="font-mono text-[12.5px] text-muted">{value > 0 ? `${value}s` : t(lang, 'workspace.off')}</span>
      </div>
      <Slider value={value} min={0} max={300} step={5} onChange={onChange} ariaLabel={t(lang, 'workspace.cooldown')} />
    </div>
  );
}

function SinkRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex min-h-[46px] items-center gap-2 border-b border-hair py-1.5"><div className="min-w-0 flex-1"><div className={`text-[13px] font-extrabold ${checked ? 'text-ink' : 'text-muted'}`}>{label}</div><div dir="auto" className="truncate font-mono text-[10px] text-muted">{detail}</div></div><Switch checked={checked} onChange={onChange} label={label} /></div>;
}

function InspectorFooter({ outputs, savedAt, onDelete }: { outputs?: string[]; savedAt: string | null; onDelete: () => void }) {
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  return <footer className="shrink-0 border-t border-white/[0.07] px-5 py-2.5">{outputs && <><div className="ui-label">{t(lang, 'workspace.rightNowWrites')}</div><div className="mb-2 mt-1 border-s-2 border-accent ps-2 font-mono text-[11px] leading-5 text-ink">{outputs.length ? outputs.map((output, index) => <div dir="auto" key={index}>{output}</div>) : <div className="text-muted">—</div>}</div></>}<div className="flex items-center"><span className="flex items-center gap-1 font-mono text-[9.5px] text-muted"><Check size={11} />{t(lang, 'workspace.saved')}{savedAt ? ` ${formatTime(savedAt)}` : ''}</span><Button size="sm" variant="outline" className="ms-auto" onClick={onDelete}><Trash2 size={11} />{t(lang, 'workspace.delete')}</Button></div></footer>;
}

const LOG_KIND: Record<LogEntry['kind'], string> = { chat: 'CHAT', trigger: 'TRIGGER', 'cooldown-denied': 'SKIP', 'permission-denied': 'DENY', manual: 'MANUAL', reset: 'RESET', system: 'SYSTEM', 'obs-ok': 'WRITE', 'obs-error': 'ERROR' };

function DockedLog() {
  const entries = useLogStore((s) => s.entries).slice(0, 7);
  const open = useToolStore((s) => s.logOpen);
  const setOpen = useToolStore((s) => s.setLogOpen);
  const connected = useConnectionStore((s) => s.twitchConnected);
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  const minuteAgo = Date.now() - 60_000;
  const rate = useLogStore.getState().entries.filter((entry) => new Date(entry.timestamp).getTime() >= minuteAgo).length;
  return <section className={`shrink-0 border-t border-[#262d34] bg-[#1a2228] ${open ? 'h-[150px]' : 'h-6'}`} tabIndex={0} aria-label={t(lang, 'workspace.log')}>
    <button type="button" className="flex h-6 w-full items-center gap-2 border-b border-[#262d34] bg-[#1f262d] px-2 text-start" onClick={() => setOpen(!open)}><ChevronRight size={11} className={open ? 'rotate-90' : ''} /><span className="ui-label">{t(lang, 'workspace.log')}</span><span aria-hidden className="mx-auto w-9 border-t border-dashed border-[#384048]" /><span className="font-mono text-[9.5px] text-muted">{connected ? `live · ${rate} msg/min` : t(lang, 'workspace.paused')}</span></button>
    {open && <div className="app-scroll h-[126px] px-2 py-1 font-mono text-[10.5px] leading-[1.75]">{entries.length ? entries.map((entry) => <div key={entry.id} className={`grid grid-cols-[58px_58px_minmax(0,1fr)] gap-1 ${entry.kind === 'obs-error' ? 'text-accent-text' : 'text-ink'}`}><span className="text-faint">{formatTime(entry.timestamp)}</span><span className={entry.kind === 'trigger' ? 'text-accent-deep' : 'text-muted'}>{LOG_KIND[entry.kind]}</span><span dir="auto" className="truncate">{entry.message}</span></div>) : <div className="text-muted">{t(lang, 'workspace.noActivity')}</div>}</div>}
  </section>;
}
