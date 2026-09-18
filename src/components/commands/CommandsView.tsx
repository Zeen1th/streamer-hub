import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Copy, FolderOpen, Layers, Minus, Pencil, Play, Plus, RotateCcw, Search, Sparkles, Tally5, Trash2, TriangleAlert, Tv, X } from 'lucide-react';
import type { CounterAction, PermissionLevel } from '../../rpc/contracts';
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
import { useToolStore } from '../../store/toolStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { FeatureKeybindEditor } from '../tools/settings/FeatureKeybindEditor';
import { CounterActionsGridView } from './CounterActionsGridView';
import { AiReplyStudioView } from './AiReplyStudioView';
import { ReplyStudioView } from './ReplyStudioView';
import { SequenceStudioView } from './SequenceStudioView';
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
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#1a2228] px-2.5">
        <Button size="sm" onClick={createCommand}><Plus size={13} />{t(lang, 'workspace.new')}</Button>
        <Button size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={duplicateSelected}><Copy size={12} />{t(lang, 'workspace.duplicate')}</Button>
        <Button size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={deleteSelected}><Trash2 size={12} />{t(lang, 'workspace.delete')}</Button>
        <span aria-hidden className="mx-0.5 h-[22px] w-px bg-white/[0.12]" />
        <label className="relative w-[210px]">
          <Search aria-hidden size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-[26px] ps-7 text-[11px]" placeholder={t(lang, 'workspace.filter')} />
        </label>
        {selectedRows.length > 1 && (
          <>
            <span className="font-mono text-[10px] text-muted">{t(lang, 'workspace.selectedCount', { n: selectedRows.length })}</span>
            <Button size="sm" variant="outline" disabled={!selectedRows.some((row) => (row.sourceKind === 'reply' || row.sourceKind === 'sequence') && row.enabled)} onClick={disableSelected}>{t(lang, 'workspace.disableAll')}</Button>
          </>
        )}
        <div className="ms-auto flex items-center gap-3">
          <StreamTitleBar lang={lang} />
          <span className="font-mono text-[10px] text-muted">
            {t(lang, 'workspace.shownCount', { shown: visibleRows.length, disabled: rows.filter((row) => !row.enabled).length })}
          </span>
        </div>
      </div>
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
          <DockedLog />
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
    <div className="app-scroll min-h-0 flex-1 bg-[#23282e]" tabIndex={0}>
      <table className="w-full table-fixed border-collapse text-start text-[12px]">
        <thead className="sticky top-0 z-10 h-[34px] border-b border-white/[0.15] bg-[#262C33] text-[#9AA3AF] text-[10px] uppercase font-bold tracking-[0.09em]">
          <tr>
            <th className="w-[22%] px-2 text-start font-semibold">{t(lang, 'workspace.columnCommand')}</th>
            <th className="px-2 text-start font-semibold">{t(lang, 'workspace.columnWhat')}</th>
            <th className="w-[15%] px-2 text-start font-semibold">{t(lang, 'workspace.columnWho')}</th>
            <th className="w-[9%] px-2 text-start font-semibold max-[960px]:hidden">{t(lang, 'workspace.columnCooldown')}</th>
            <th className="w-[17%] px-2 text-start font-semibold max-[1060px]:hidden">{t(lang, 'workspace.columnWrites')}</th>
            <th className="w-[11%] px-2 text-start font-semibold max-[1180px]:hidden">{t(lang, 'workspace.columnLast')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = selected.includes(row.id);
            return (
              <FragmentRow
                key={row.id}
                row={row}
                active={active}
                onClick={(event) => {
                  select(row, event.ctrlKey || event.metaKey || event.shiftKey);
                }}
                onDoubleClick={() => {
                  if (row.sourceKind === 'counter') {
                    onConfigureActions?.(row.sourceId);
                  } else if (row.group === 'ai') {
                    onConfigureAiReply?.(row.sourceId);
                  } else if (row.sourceKind === 'sequence') {
                    onConfigureSequence?.(row.sourceId);
                  } else if (row.sourceKind === 'reply') {
                    onConfigureReply?.(row.sourceId);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (!active) setSelected([row.id]);
                  setMenu({ ...clampMenuPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight), rowId: row.id });
                }}
                onConfigureActions={onConfigureActions}
                onConfigureReply={onConfigureReply}
                onConfigureAiReply={onConfigureAiReply}
                onConfigureSequence={onConfigureSequence}
              />
            );
          })}
        </tbody>
      </table>
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

function FragmentRow({
  row,
  active,
  onClick,
  onDoubleClick,
  onContextMenu,
  onConfigureActions,
  onConfigureReply,
  onConfigureAiReply,
  onConfigureSequence,
}: {
  row: CommandRow;
  active: boolean;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onConfigureActions?: (counterId: string) => void;
  onConfigureReply?: (ruleId: string) => void;
  onConfigureAiReply?: (ruleId: string) => void;
  onConfigureSequence?: (sequenceId: string) => void;
}) {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const prefix = row.sourceKind === 'counter' ? '!' : '';
  const isCounter = row.sourceKind === 'counter';
  const isAi = row.group === 'ai';
  const isSequence = row.sourceKind === 'sequence';

  return (
    <>
      <tr
        tabIndex={0}
        aria-selected={active}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        className={`relative h-[38px] cursor-pointer border-b border-white/[0.06] transition-colors ${active ? 'bg-[#6366f1]/15 text-white border-s-2 border-[#6366f1]' : 'hover:bg-white/[0.045]'}`}
      >
        <td className="truncate px-2.5"><span dir="auto" className={`font-sans text-[13px] font-bold ${row.enabled ? 'text-[#a5b4fc]' : 'text-muted line-through'}`}>{prefix}{row.command}</span></td>
        <td className="truncate px-2 text-ink">
          {isCounter ? (
            <div className="flex items-center gap-1.5">
              <span dir="auto" className="font-sans font-bold text-[#f0f3fa] truncate">{row.description}</span>
              <span dir="ltr" className="rounded-[3px] border border-[#38424d] bg-[#242b32] px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-accent-text shrink-0 shadow-xs">
                {String(row.count ?? 0).padStart(3, '0')}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigureActions?.(row.sourceId);
                }}
                className="rounded-[3px] border border-[#2e3740] bg-[#22282f] hover:border-[#3d4856] hover:bg-[#283038] hover:text-white px-2 py-0.5 text-[10px] font-mono text-[#cbd3e6] shrink-0 transition-colors shadow-xs"
                title={t(lang, 'workspace.openActionsView')}
              >
                {t(lang, 'workspace.actionsPill')} ↗
              </button>
            </div>
          ) : isAi ? (
            <div className="flex items-center gap-1.5">
              <span dir="auto" className={`truncate ${row.enabled ? 'font-bold text-[#f0f3fa]' : 'text-muted'}`}>{row.description}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigureAiReply?.(row.sourceId);
                }}
                className="rounded-[3px] border border-purple-500/30 bg-purple-500/15 text-[#d8b4fe] hover:border-purple-500/50 hover:bg-purple-500/25 hover:text-white px-2 py-0.5 text-[10px] font-mono font-bold shrink-0 transition-colors shadow-xs"
                title={t(lang, 'aiStudio.openStudio')}
              >
                {t(lang, 'aiStudio.openStudio')} ↗
              </button>
              {!row.enabled && <span className="ms-1 rounded-[3px] border border-[#2a323a] bg-[#1c2228] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-[#737e8c] shrink-0">{t(lang, 'workspace.disabledTag')}</span>}
            </div>
          ) : isSequence ? (
            <div className="flex items-center gap-1.5">
              <span dir="auto" className={`truncate ${row.enabled ? 'font-bold text-[#f0f3fa]' : 'text-muted'}`}>{row.description}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigureSequence?.(row.sourceId);
                }}
                className="rounded-[3px] border border-purple-500/30 bg-purple-500/15 text-[#d8b4fe] hover:border-purple-500/50 hover:bg-purple-500/25 hover:text-white px-2 py-0.5 text-[10px] font-mono font-bold shrink-0 transition-colors shadow-xs"
                title={t(lang, 'sequence.openStudio')}
              >
                {t(lang, 'workspace.stepsCount', { n: row.sequenceStepCount ?? 0 })} ↗
              </button>
              {!row.enabled && <span className="ms-1 rounded-[3px] border border-[#2a323a] bg-[#1c2228] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-[#737e8c] shrink-0">{t(lang, 'workspace.disabledTag')}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span dir="auto" className={`truncate ${row.enabled ? 'text-[#f0f3fa]' : 'text-muted'}`}>{row.description}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigureReply?.(row.sourceId);
                }}
                className="rounded-[3px] border border-[#2e3740] bg-[#22282f] hover:border-[#3d4856] hover:bg-[#283038] hover:text-white px-2 py-0.5 text-[10px] font-mono text-[#cbd3e6] shrink-0 transition-colors shadow-xs"
                title={t(lang, 'workspace.openReplyStudio')}
              >
                {t(lang, 'workspace.replyPill')} ↗
              </button>
              {!row.enabled && <span className="ms-1 rounded-[3px] border border-[#2a323a] bg-[#1c2228] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-[#737e8c] shrink-0">{t(lang, 'workspace.disabledTag')}</span>}
            </div>
          )}
        </td>
        <td className="truncate px-2 text-muted">{t(lang, `ranks.${row.permission}`)}</td>
        <td className="px-2 font-mono text-[11px] text-muted max-[960px]:hidden">{row.cooldownSeconds > 0 ? `${row.cooldownSeconds}s` : t(lang, 'workspace.off')}</td>
        <td className={`truncate px-2 text-[11px] max-[1060px]:hidden ${row.error ? 'text-accent-text' : 'text-muted'}`}>{row.writes.length ? row.writes.map((sink) => t(lang, `workspace.sink.${sink}`)).join(' · ') : '—'}</td>
        <td className="truncate px-2 font-mono text-[10px] text-muted max-[1180px]:hidden">{row.lastTriggeredAt ? formatTime(new Date(row.lastTriggeredAt).toISOString()) : '—'}</td>
      </tr>
      {row.error && <tr className="h-[28px] border-b border-rule/50 bg-danger/5"><td colSpan={6} className="border-s-2 border-danger px-2.5 text-[11px] text-danger font-medium"><TriangleAlert size={11} className="me-1.5 inline" />{row.error}</td></tr>}
    </>
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
        {t(lang, 'workspace.new')}
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
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = startX - moveEvent.clientX;
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
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setInspectorWidth(clampInspectorWidth(inspectorWidth + 16, containerWidth));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setInspectorWidth(clampInspectorWidth(inspectorWidth - 16, containerWidth));
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
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] text-muted">
          {t(lang, 'workspace.selectHint')}
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
      <div className="app-scroll min-h-0 flex-1 space-y-4 px-3 py-3">
        {/* Studio Launcher Card */}
        <div className="rounded-[5px] border border-[#384048] bg-[#2e3338] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="ui-label">{t(lang, 'sequence.stackTitle')}</div>
            <span className="rounded-[3px] border border-purple-500/30 bg-purple-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-[#c4b5fd]">
              {t(lang, 'workspace.stepsCount', { n: sequence.steps.length })}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full justify-between h-8 text-[11px] rounded-[4px] border border-[#3d4856] bg-[#242a30] text-[#f0f3fa] hover:border-[#4d5a6c] hover:bg-[#2c333a]"
            onClick={() => onConfigureSequence?.(sequence.id)}
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Layers size={12} className="text-accent-text" />
              <span>{t(lang, 'sequence.openStudio')}</span>
            </div>
            <ChevronRight size={12} className="text-muted" />
          </Button>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute start-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted">@</span>
              <Input
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const formatted = testTarget.trim()
                      ? (testTarget.trim().startsWith('@') ? testTarget.trim() : `@${testTarget.trim()}`)
                      : '';
                    void runSequence(sequence.id, {
                      username: 'Streamer',
                      userInput: formatted,
                      source: 'test',
                    });
                  }
                }}
                placeholder={t(lang, 'sequence.testTargetPlaceholder')}
                className="h-7 ps-5 font-mono text-[11px]"
              />
            </div>
            <Button
              size="sm"
              className="h-7 text-[11px] font-bold rounded-[4px] px-3 shrink-0"
              disabled={isExecuting}
              onClick={() => {
                const formatted = testTarget.trim()
                  ? (testTarget.trim().startsWith('@') ? testTarget.trim() : `@${testTarget.trim()}`)
                  : '';
                void runSequence(sequence.id, {
                  username: 'Streamer',
                  userInput: formatted,
                  source: 'test',
                });
              }}
            >
              <Play size={11} className="me-1" />
              {isExecuting ? t(lang, 'sequence.running') : t(lang, 'sequence.runTest')}
            </Button>
          </div>
        </div>

        {/* Trigger Summary */}
        <div className="space-y-2 border-t border-hair pt-2">
          <InspectorField label={t(lang, 'sequence.triggerType')}>
            <div className="font-mono text-[11px] text-ink bg-surface-2 p-2 border border-rule">
              {sequence.triggerType === 'channel_points'
                ? t(lang, 'sequence.channelPoints')
                : sequence.triggerType === 'chat'
                ? t(lang, 'sequence.chatCommand')
                : t(lang, 'sequence.bothTriggers')}
            </div>
          </InspectorField>

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

          <CooldownField
            value={sequence.cooldownSeconds}
            onChange={(cooldownSeconds) => update(sequence.id, { cooldownSeconds })}
          />
        </div>
      </div>
      <InspectorFooter
        outputs={sequence.steps.map((s, idx) => {
          let detail = '';
          if (s.type === 'wait') detail = `${s.waitDuration ?? 3} ${s.waitUnit ?? 'seconds'}`;
          else if (s.type === 'chat') detail = s.chatMessage ?? '';
          else if (s.type === 'counter') detail = `${s.counterAction ?? 'increase'} counter`;
          else if (s.type === 'command') detail = s.commandTrigger ?? '';
          return `${idx + 1}. [${s.type.toUpperCase()}] ${detail}`;
        })}
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
  const applyTitle = useCounterStore((s) => s.applyTitle);
  const detachTitle = useCounterStore((s) => s.detachTitle);
  const sync = useCounterStore((s) => s.configSync);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!counter?.titleEnabled) return;
    rpc.invoke(Channels.TwitchGetTitle).then((result) => setCurrentTitle(result.title ?? null)).catch(() => undefined);
  }, [counter?.id, counter?.titleEnabled]);

  const handleApplyTitle = async () => {
    if (!counter) return;
    setApplyStatus(lang === 'ar' ? 'جارٍ التطبيق...' : 'Applying...');
    const ok = await applyTitle(counter.id);
    setApplyStatus(ok ? (lang === 'ar' ? 'تم تطبيق العنوان' : 'Title applied') : (lang === 'ar' ? 'تعذر تطبيق العنوان' : 'Could not apply title'));
    if (ok) {
      rpc.invoke(Channels.TwitchGetTitle).then((res) => setCurrentTitle(res.title ?? null)).catch(() => undefined);
      setTimeout(() => setApplyStatus(null), 3000);
    }
  };

  const handleDetachTitle = async () => {
    if (!counter) return;
    setApplyStatus(lang === 'ar' ? 'جارٍ الإزالة...' : 'Detaching...');
    const ok = await detachTitle(counter.id);
    setApplyStatus(ok ? t(lang, 'workspace.detachedTitle') : (lang === 'ar' ? 'تعذر إزالة العداد' : 'Failed to detach'));
    if (ok) {
      rpc.invoke(Channels.TwitchGetTitle).then((res) => setCurrentTitle(res.title ?? null)).catch(() => undefined);
      setTimeout(() => setApplyStatus(null), 3000);
    }
  };

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
      <div className="app-scroll min-h-0 flex-1 space-y-4 px-3 py-3">
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
              3 Actions
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

        {/* Outputs / Sinks */}
        <div className="border-t-2 border-rule pt-3">
          <div className="ui-label mb-2">{t(lang, 'workspace.writesTo')}</div>
          <SinkRow
            label={t(lang, 'workspace.obsTextFile')}
            detail={counter.obs.template}
            checked={counter.obs.enabled}
            onChange={(enabled) => updateObs(counter.id, { enabled })}
          />
          {counter.obs.enabled && (
            <div className="mt-2 flex gap-1">
              <Input
                dir="ltr"
                className="font-mono text-[10px]"
                value={counter.obs.filePath}
                onChange={(event) => updateObs(counter.id, { filePath: event.target.value })}
              />
              <Button
                size="sm"
                variant="outline"
                aria-label={t(lang, 'workspace.browse')}
                onClick={async () => {
                  const result = await rpc.invoke(Channels.DialogSaveFile, {
                    defaultName: `${counter.name.toLowerCase().replace(/\s+/g, '-')}.txt`,
                  });
                  if (result.path) updateObs(counter.id, { filePath: result.path });
                }}
              >
                <FolderOpen size={12} />
              </Button>
            </div>
          )}

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
          {counter.titleEnabled && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                <Input
                  dir="auto"
                  className="flex-1 font-mono text-[10px]"
                  value={counter.titleTemplate ?? ''}
                  placeholder={`{title} | ${counter.name}: {count}`}
                  onChange={(event) => updateTitle(counter.id, { titleTemplate: event.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyTitle}
                  disabled={!counter.titleTemplate?.trim()}
                  title={t(lang, 'workspace.applyTitle')}
                >
                  {t(lang, 'workspace.applyTitle')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDetachTitle}
                  title={t(lang, 'workspace.detachTitle')}
                >
                  {t(lang, 'workspace.detachTitle')}
                </Button>
              </div>
              {applyStatus && <span className="block font-mono text-[10px] text-accent-text">{applyStatus}</span>}
              {currentTitle && (
                <div className="flex items-center justify-between font-mono text-[10px] text-muted">
                  <span className="truncate">
                    {t(lang, 'workspace.liveTwitchTitle')}: <strong className="text-ink">{currentTitle}</strong>
                  </span>
                </div>
              )}
              {!counter.titleTemplate?.includes('{title}') && !counter.titleTemplate?.includes('{current_title}') && (
                <span className="block font-sans text-[10px] text-muted">
                  {t(lang, 'workspace.titlePlaceholderHint')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Global Keybinds */}
        <div className="border-t-2 border-rule pt-3">
          <div className="ui-label mb-2">{t(lang, 'workspace.keybind')}</div>
          <FeatureKeybindEditor lang={lang} targetType="counter" targetId={counter.id} />
        </div>
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
  const globalSettings = useAutoReplyStore((s) => s.globalSettings);
  const updateGlobalSettings = useAutoReplyStore((s) => s.updateGlobalSettings);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);
  const activeChatSender = useConnectionStore((s) => s.activeChatSender);
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

  const activeOverridesCount = rule.aiConditions?.length ?? 0;

  return (
    <>
      <InspectorHeader
        title={rule.triggers[0] ? (rule.triggers[0].startsWith('!') ? rule.triggers[0] : `!${rule.triggers[0]}`) : t(lang, 'workspace.untitled')}
        kind={isAi ? t(lang, 'workspace.aiReply') : t(lang, 'workspace.preparedReply')}
        onClose={onClose}
      />
      <div className="app-scroll min-h-0 flex-1 space-y-4 px-3 py-3">
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
              {isAi ? '✨ AI Reply' : '💬 Prepared'}
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

          {/* Quick Mode Switch */}
          <div className="space-y-1 pt-1 border-t border-hair">
            <div className="ui-label text-[10px] text-muted">{t(lang, 'workspace.responseType')}</div>
            <SegmentedControl
              value={rule.responseMode ?? 'static'}
              options={[
                { value: 'static', label: t(lang, 'workspace.prepared') },
                { value: 'ai', label: t(lang, 'workspace.ai') },
              ]}
              onChange={(responseMode) => {
                if (responseMode === 'ai' && !rule.aiInstructions?.trim()) {
                  const isAr = lang === 'ar';
                  update(rule.id, {
                    responseMode,
                    agentName: rule.agentName?.trim() ? rule.agentName : (isAr ? 'أروديس' : 'Arrodes'),
                    agentRole: rule.agentRole?.trim() ? rule.agentRole : (isAr ? 'مرآة سحرية فضية عليمة بالأسرار من LOTM تملك بحراً من المعلومات وتجيب بذكاء وغموض' : 'All-knowing magic silver mirror from LOTM that holds endless secrets and answers questions with mysterious wit'),
                    agentContext: rule.agentContext?.trim() ? rule.agentContext : (isAr ? 'الهوية: مرآة أروديس السحرية الفضية من رواية سيد الغموض (LOTM). تملك علماً واسعاً بالأسرار والمعلومات، ومخلصة تماماً لسيدها العظيم (الستريمر).' : 'Identity: Arrodes, the mysterious magic silver mirror from Lord of the Mysteries (LOTM). It possesses immense knowledge of the universe, secrets, and stream facts. It is completely devoted to the Supreme Master (the streamer).'),
                    aiInstructions: isAr ? 'أنت أروديس (المرآة السحرية العليمة من LOTM). قدّم إجابات دقيقة وغنية بالمعلومات لـ {username} في أقل من 25 كلمة بنبرة مرآة غامضة ومخلصة للستريمر.' : 'You are Arrodes, the omniscient magic mirror. Answer {username} accurately with insightful knowledge in under 25 words. Maintain a respectful, devoted tone to the streamer and a mysterious mirror vibe.',
                  });
                } else {
                  update(rule.id, { responseMode });
                }
              }}
            />
          </div>

          {/* Who Responds Switcher */}
          <div className="space-y-1 pt-2 border-t border-hair">
            <div className="flex items-center justify-between">
              <span className="ui-label text-[10px] text-muted">{t(lang, 'autoReplies.whoResponds')}</span>
              {rule.senderRole === 'bot' && !botConnected && (
                <span className="text-[9.5px] text-amber-400 font-mono flex items-center gap-0.5">
                  <AlertCircle size={10} />
                  {t(lang, 'autoReplies.senderBotOfflineShort')}
                </span>
              )}
            </div>
            <SegmentedControl
              name={`inspector-sender-${rule.id}`}
              value={rule.senderRole ?? 'default'}
              options={[
                {
                  value: 'default',
                  label: t(lang, 'autoReplies.senderDefault', {
                    sender: activeChatSender === 'bot' ? (botLogin || 'Bot') : (twitchChannel || 'Streamer'),
                  }),
                },
                {
                  value: 'broadcaster',
                  label: `👑 ${t(lang, 'autoReplies.senderBroadcaster')}`,
                },
                {
                  value: 'bot',
                  label: `🤖 ${t(lang, 'autoReplies.senderBot')}`,
                },
              ]}
              onChange={(senderRole) => update(rule.id, { senderRole: senderRole as 'default' | 'bot' | 'broadcaster' })}
            />
          </div>

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
                  {trig.startsWith('!') ? trig : `!${trig}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* AI Global Protection Limits (When isAi is true) */}
        {isAi && (
          <div className="rounded-[5px] border border-purple-500/35 bg-purple-500/10 p-3 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-purple-200">
                <Sparkles size={13} className="text-purple-400" />
                <span>{t(lang, 'aiStudio.globalLimitsTitle')}</span>
              </div>
              <span className="rounded-[3px] border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-purple-300">
                {t(lang, 'aiStudio.globalLimitsBadge')}
              </span>
            </div>

            {/* Global AI Cooldown */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{t(lang, 'aiStudio.globalAiCooldownShort')}</span>
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
                    className="h-6 w-16 text-center font-mono text-[11px]"
                  />
                  <span className="font-mono text-muted text-[10px]">s</span>
                </div>
              </div>
              <Slider
                value={globalSettings.globalAiCooldownSeconds || 0}
                min={0}
                max={180}
                step={5}
                onChange={(val) => updateGlobalSettings({ globalAiCooldownSeconds: val })}
                ariaLabel={t(lang, 'aiStudio.globalAiCooldownShort')}
              />
            </div>

            {/* Global AI User Cooldown */}
            <div className="space-y-1 pt-2 border-t border-purple-500/20">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{t(lang, 'aiStudio.globalAiUserCooldownShort')}</span>
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
                    className="h-6 w-16 text-center font-mono text-[11px]"
                  />
                  <span className="font-mono text-muted text-[10px]">s</span>
                </div>
              </div>
              <Slider
                value={globalSettings.globalAiUserCooldownSeconds ?? 60}
                min={0}
                max={300}
                step={5}
                onChange={(val) => updateGlobalSettings({ globalAiUserCooldownSeconds: val })}
                ariaLabel={t(lang, 'aiStudio.globalAiUserCooldownShort')}
              />
            </div>
          </div>
        )}

        {/* Permissions */}
        <PermissionField
          value={rule.minimumRank ?? 'everyone'}
          onChange={(minimumRank) => update(rule.id, { minimumRank })}
        />

        {/* Command Specific Cooldown */}
        <div className="space-y-2 pt-1 border-t border-hair">
          {isAi && (
            <div className="ui-label text-[10px] text-muted font-bold uppercase tracking-wider">
              {t(lang, 'aiStudio.ruleCooldownTitle')}
            </div>
          )}
          <CooldownField
            value={rule.cooldownSeconds}
            onChange={(cooldownSeconds) => update(rule.id, { cooldownSeconds })}
          />

          <InspectorField label={t(lang, 'autoReplies.userCooldown')}>
            <Input
              dir="ltr"
              type="number"
              min={0}
              max={3600}
              value={rule.userCooldownSeconds ?? 0}
              onChange={(event) =>
                update(rule.id, {
                  userCooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)),
                })
              }
            />
          </InspectorField>
        </div>

        {/* Quick Chatter Overrides Indicator */}
        {activeOverridesCount > 0 && (
          <div className="rounded border border-amber-500/25 bg-amber-500/10 p-2 text-[11px] text-amber-200">
            <div className="font-semibold flex items-center justify-between">
              <span>Chatter Overrides</span>
              <span className="font-mono text-[10px] bg-amber-500/20 px-1 rounded">
                {activeOverridesCount} active
              </span>
            </div>
            <div className="text-[10.5px] text-amber-300/80 mt-0.5">
              Specific viewers have custom override responses configured in Studio.
            </div>
          </div>
        )}
      </div>
      <InspectorFooter outputs={[preview].filter(Boolean)} savedAt={null} onDelete={() => useAutoReplyStore.getState().remove(rule.id)} />
    </>
  );
}

function InspectorHeader({ title, kind, onClose }: { title: string; kind: string; onClose: () => void }) {
  return <header className="shrink-0 border-b border-hair px-3 py-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div dir="auto" className="truncate font-sans text-[19px] font-extrabold leading-normal pb-0.5 text-accent-text">{title}</div><div className="mt-1 truncate ui-label">{kind}</div></div><button type="button" className="grid size-6 place-items-center text-ink" onClick={onClose} aria-label="Close"><X size={13} /></button></div></header>;
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) { return <div><div className="ui-label mb-1.5">{label}</div>{children}</div>; }

function PermissionField({ value, onChange }: { value: PermissionLevel; onChange: (value: PermissionLevel) => void }) {
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  const labels: Record<PermissionLevel, string> = { everyone: 'All', subscriber: 'Sub', vip: 'VIP', mod: 'Mod', broadcaster: 'Cast' };
  return <InspectorField label={t(lang, 'workspace.who')}><SegmentedControl value={value} options={RANKS.map((rank) => ({ value: rank, label: labels[rank] }))} onChange={onChange} /></InspectorField>;
}

function CooldownField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  return <InspectorField label={`${t(lang, 'workspace.cooldown')} · ${value}s`}><Slider value={value} min={0} max={300} step={5} onChange={onChange} ariaLabel={t(lang, 'workspace.cooldown')} /><div className="flex justify-between font-mono text-[9.5px] text-faint"><span>0s</span><span>300s</span></div></InspectorField>;
}

function SinkRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex min-h-[46px] items-center gap-2 border-b border-hair py-1.5"><div className="min-w-0 flex-1"><div className={`text-[13px] font-extrabold ${checked ? 'text-ink' : 'text-muted'}`}>{label}</div><div dir="auto" className="truncate font-mono text-[10px] text-muted">{detail}</div></div><Switch checked={checked} onChange={onChange} label={label} /></div>;
}

function InspectorFooter({ outputs, savedAt, onDelete }: { outputs: string[]; savedAt: string | null; onDelete: () => void }) {
  const language = useSettingsStore((s) => s.language); const lang = language === 'ar' ? 'ar' : 'en';
  return <footer className="shrink-0 border-t-2 border-rule bg-surface px-3 py-2"><div className="ui-label">{t(lang, 'workspace.rightNowWrites')}</div><div className="mt-1 border-s-2 border-accent ps-2 font-mono text-[11px] leading-5 text-ink">{outputs.length ? outputs.map((output, index) => <div dir="auto" key={index}>{output}</div>) : <div className="text-muted">—</div>}</div><div className="mt-2 flex items-center"><span className="flex items-center gap-1 font-mono text-[9.5px] text-muted"><Check size={11} />{t(lang, 'workspace.saved')}{savedAt ? ` ${formatTime(savedAt)}` : ''}</span><Button size="sm" variant="outline" className="ms-auto" onClick={onDelete}><Trash2 size={11} />{t(lang, 'workspace.delete')}</Button></div></footer>;
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
