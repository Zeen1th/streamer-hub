import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, FolderOpen, Plus, Search, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
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
  type CommandGroup,
  type CommandRow,
} from '../../lib/commandProjection';
import { renderTemplate } from '../../lib/counterRules';
import { formatTime } from '../../lib/format';
import { t } from '../../i18n/translations';
import { useAutoReplyStore } from '../../store/autoReplyStore';
import { useChatOverlayStore } from '../../store/chatOverlayStore';
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
import { ReplyComposer } from '../tools/auto-replies/ReplyComposer';
import { TriggerTitleAction } from '../tools/auto-replies/TriggerTitleAction';

const ACTION_LABELS: Record<CounterAction, string> = { increase: '+1', decrease: '-1', reset: 'Reset' };
const RANKS: PermissionLevel[] = ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'];

export function CommandsView() {
  const counters = useCounterStore((s) => s.counters);
  const counterLastTriggeredAt = useCounterStore((s) => s.lastTriggerAt);
  const obsStatus = useCounterStore((s) => s.obsStatus);
  const replies = useAutoReplyStore((s) => s.rules);
  const replyLastTriggeredAt = useAutoReplyStore((s) => s.lastTriggeredAt);
  const group = useToolStore((s) => s.group);
  const query = useToolStore((s) => s.query);
  const selected = useToolStore((s) => s.selected);
  const setSelected = useToolStore((s) => s.setSelected);
  const setQuery = useToolStore((s) => s.setQuery);
  const inspectorWidth = useToolStore((s) => s.inspectorWidth);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const workspaceRef = useRef<HTMLDivElement | null>(null);

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
    () => projectCommands({ counters, replies, counterLastTriggeredAt, replyLastTriggeredAt, obsErrors: obsStatus }),
    [counters, replies, counterLastTriggeredAt, replyLastTriggeredAt, obsStatus],
  );
  const visibleRows = useMemo(() => filterCommands(rows, group, query), [rows, group, query]);
  const selectedRows = rows.filter((row) => selected.includes(row.id));

  useEffect(() => {
    const valid = selected.filter((id) => rows.some((row) => row.id === id));
    if (valid.length !== selected.length) setSelected(valid);
  }, [rows, selected, setSelected]);

  const createCommand = () => {
    if (group === 'replies' || group === 'ai') {
      const id = useAutoReplyStore.getState().add();
      if (group === 'ai') useAutoReplyStore.getState().update(id, { responseMode: 'ai' });
      setSelected([`reply:${id}`]);
      return;
    }
    useCounterStore.getState().addCounter();
    const id = useCounterStore.getState().selectedId;
    if (id) setSelected([`counter:${id}:increase`]);
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
    setSelected([`counter:${id}:${row.action ?? 'increase'}`]);
  };

  const deleteSelected = () => {
    const countersToDelete = new Set(selectedRows.filter((row) => row.sourceKind === 'counter').map((row) => row.sourceId));
    const repliesToDelete = new Set(selectedRows.filter((row) => row.sourceKind === 'reply').map((row) => row.sourceId));
    countersToDelete.forEach((id) => useCounterStore.getState().removeCounter(id));
    repliesToDelete.forEach((id) => useAutoReplyStore.getState().remove(id));
    setSelected([]);
  };

  const disableSelected = () => {
    selectedRows.filter((row) => row.sourceKind === 'reply').forEach((row) => useAutoReplyStore.getState().update(row.sourceId, { enabled: false }));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface" aria-label={t(lang, 'workspace.commands')}>
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-rule bg-surface px-2.5">
        <Button size="sm" onClick={createCommand}><Plus size={13} />{t(lang, 'workspace.new')}</Button>
        <Button size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={duplicateSelected}><Copy size={12} />{t(lang, 'workspace.duplicate')}</Button>
        <Button size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={deleteSelected}><Trash2 size={12} />{t(lang, 'workspace.delete')}</Button>
        <span aria-hidden className="mx-0.5 h-[26px] w-px bg-rule" />
        <label className="relative w-[210px]">
          <Search aria-hidden size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-[26px] ps-7 text-[11px]" placeholder={t(lang, 'workspace.filter')} />
        </label>
        {selectedRows.length > 1 && (
          <>
            <span className="font-mono text-[10px] text-muted">{t(lang, 'workspace.selectedCount', { n: selectedRows.length })}</span>
            <Button size="sm" variant="outline" disabled={!selectedRows.some((row) => row.sourceKind === 'reply' && row.enabled)} onClick={disableSelected}>{t(lang, 'workspace.disableAll')}</Button>
          </>
        )}
        <span className="ms-auto font-mono text-[10px] text-muted">
          {t(lang, 'workspace.shownCount', { shown: visibleRows.length, disabled: rows.filter((row) => !row.enabled).length })}
        </span>
      </div>
      <div
        ref={workspaceRef}
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: `186px minmax(0,1fr) ${inspectorWidth}px` }}
      >
        <CommandTree rows={rows} />
        <div className="flex min-h-0 min-w-0 flex-col border-s border-rule">
          <CommandTable rows={visibleRows} allRows={rows} />
          <DockedLog />
        </div>
        <CommandInspector row={selectedRows[0] ?? null} workspaceRef={workspaceRef} />
      </div>
    </section>
  );
}

function CommandTree({ rows }: { rows: CommandRow[] }) {
  const group = useToolStore((s) => s.group);
  const setGroup = useToolStore((s) => s.setGroup);
  const counters = useCounterStore((s) => s.counters);
  const overlayEnabled = useChatOverlayStore((s) => s.settings.enabled);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const groups: { id: CommandGroup; label: string; count: number; indent: boolean }[] = [
    { id: 'all', label: t(lang, 'workspace.allCommands'), count: rows.length, indent: false },
    { id: 'counters', label: t(lang, 'workspace.counters'), count: rows.filter((row) => row.group === 'counters').length, indent: true },
    { id: 'replies', label: t(lang, 'workspace.preparedReplies'), count: rows.filter((row) => row.group === 'replies').length, indent: true },
    { id: 'ai', label: t(lang, 'workspace.aiReplies'), count: rows.filter((row) => row.group === 'ai').length, indent: true },
    { id: 'disabled', label: t(lang, 'workspace.disabled'), count: rows.filter((row) => !row.enabled).length, indent: true },
  ];
  const outputRows = [
    { label: t(lang, 'workspace.obsFiles'), detail: String(counters.filter((counter) => counter.obs.enabled).length), on: counters.some((counter) => counter.obs.enabled) },
    { label: t(lang, 'workspace.streamTitle'), detail: '', on: counters.some((counter) => counter.titleEnabled) },
    { label: t(lang, 'workspace.overlay'), detail: overlayEnabled ? '' : t(lang, 'workspace.off'), on: overlayEnabled },
  ];
  return (
    <nav className="relative flex min-h-0 flex-col bg-surface-2" aria-label={t(lang, 'workspace.groups')}>
      <div className="px-3 pt-3 ui-label">{t(lang, 'workspace.groups')}</div>
      <div className="mt-1" role="tree">
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            role="treeitem"
            aria-selected={group === item.id}
            onClick={() => setGroup(item.id)}
            className={`relative flex h-8 w-full items-center pe-3 text-start text-[13px] ${item.indent ? 'ps-6' : 'ps-3'} ${group === item.id ? 'bg-surface font-extrabold text-ink before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-accent' : 'text-ink hover:bg-accent-soft'}`}
          >
            <span className="truncate">{item.label}</span><span className="ms-auto font-mono text-[10px] text-muted">{item.count}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-hair px-3 pt-3 ui-label">{t(lang, 'workspace.outputs')}</div>
      <div className="mt-1 space-y-2 px-3 text-[12px]">
        {outputRows.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-ink">
            <span aria-hidden className={`size-[7px] border ${item.on ? 'border-ink bg-ink' : 'border-muted bg-transparent'}`} />
            <span>{item.label}{item.detail ? ` · ${item.detail}` : ''}</span>
          </div>
        ))}
      </div>
    </nav>
  );
}

function CommandTable({ rows, allRows }: { rows: CommandRow[]; allRows: CommandRow[] }) {
  const selected = useToolStore((s) => s.selected);
  const setSelected = useToolStore((s) => s.setSelected);
  const setMenu = useToolStore((s) => s.setMenu);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const select = (row: CommandRow, modified: boolean) => setSelected(selectionAfterClick(selected, row.id, modified));
  if (allRows.length === 0) return <EmptyCommands />;
  return (
    <div className="app-scroll min-h-0 flex-1 bg-surface" tabIndex={0}>
      <table className="w-full table-fixed border-collapse text-start text-[12px]">
        <thead className="sticky top-0 z-10 h-[30px] border-b-2 border-rule bg-surface-2 ui-label">
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
              <FragmentRow key={row.id} row={row} active={active} onClick={(event) => select(row, event.ctrlKey || event.metaKey || event.shiftKey)} onContextMenu={(event) => {
                event.preventDefault();
                if (!active) setSelected([row.id]);
                setMenu({ ...clampMenuPosition(event.clientX, event.clientY, window.innerWidth, window.innerHeight), rowId: row.id });
              }} />
            );
          })}
        </tbody>
      </table>
      <CommandContextMenu rows={allRows} />
    </div>
  );
}

function FragmentRow({ row, active, onClick, onContextMenu }: { row: CommandRow; active: boolean; onClick: (event: React.MouseEvent) => void; onContextMenu: (event: React.MouseEvent) => void }) {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const prefix = row.sourceKind === 'counter' ? '!' : '';
  return (
    <>
      <tr tabIndex={0} aria-selected={active} onClick={onClick} onContextMenu={onContextMenu} className={`relative h-[30px] cursor-default border-b border-hair hover:bg-accent-soft ${active ? 'bg-accent-soft border-s-2 border-accent' : ''}`}>
        <td className="truncate px-2"><span dir="auto" className={`font-sans text-[13px] font-extrabold ${row.enabled ? 'text-accent-text' : 'text-muted line-through'}`}>{prefix}{row.command}</span></td>
        <td className="truncate px-2 text-ink"><span dir="auto" className={row.enabled ? '' : 'text-muted'}>{row.description}</span>{!row.enabled && <span className="ms-2 border border-rule px-1 py-0.5 text-[9.5px] font-semibold tracking-[.09em] text-muted">{t(lang, 'workspace.disabledTag')}</span>}</td>
        <td className="truncate px-2 text-muted">{t(lang, `ranks.${row.permission}`)}</td>
        <td className="px-2 font-mono text-[11px] text-muted max-[960px]:hidden">{row.cooldownSeconds > 0 ? `${row.cooldownSeconds}s` : t(lang, 'workspace.off')}</td>
        <td className={`truncate px-2 text-[11px] max-[1060px]:hidden ${row.error ? 'text-accent-text' : 'text-muted'}`}>{row.writes.length ? row.writes.map((sink) => t(lang, `workspace.sink.${sink}`)).join(' · ') : '—'}</td>
        <td className="truncate px-2 font-mono text-[10px] text-muted max-[1180px]:hidden">{row.lastTriggeredAt ? formatTime(new Date(row.lastTriggeredAt).toISOString()) : '—'}</td>
      </tr>
      {row.error && <tr className="h-[26px] border-b border-hair bg-surface"><td colSpan={6} className="border-s-2 border-accent px-2 text-[11px] text-accent-text"><TriangleAlert size={11} className="me-1 inline" />{row.error}</td></tr>}
    </>
  );
}

function EmptyCommands() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface text-center"><div className="text-[14px] font-extrabold">{t(lang, 'workspace.emptyTitle')}</div><p className="mt-1 max-w-xs text-[12px] text-muted">{t(lang, 'workspace.emptyHint')}</p><Button size="sm" className="mt-3" onClick={() => useCounterStore.getState().addCounter()}><Plus size={13} />{t(lang, 'workspace.new')}</Button></div>;
}

function CommandContextMenu({ rows }: { rows: CommandRow[] }) {
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
      setSelected([`counter:${id}:${row.action ?? 'increase'}`]);
    }
    setMenu(null);
  };
  const remove = () => {
    if (row.sourceKind === 'counter') useCounterStore.getState().removeCounter(row.sourceId);
    else useAutoReplyStore.getState().remove(row.sourceId);
    setSelected([]); setMenu(null);
  };
  const item = 'flex h-7 w-full items-center justify-between px-2 text-start text-[11px] hover:bg-accent-fill hover:text-on-accent';
  return <div ref={ref} role="menu" className="fixed z-[80] w-[180px] border border-rule bg-surface py-1 text-ink" style={{ left: menu.x, top: menu.y }}>
    <button role="menuitem" className={item} onClick={() => setMenu(null)}>{t(lang, 'workspace.edit')}<kbd className="font-mono text-[9.5px]">Enter</kbd></button>
    <button role="menuitem" className={item} onClick={() => { void navigator.clipboard?.writeText(`${row.sourceKind === 'counter' ? '!' : ''}${row.command}`); setMenu(null); }}>{t(lang, 'workspace.copyCommand')}<kbd className="font-mono text-[9.5px]">Ctrl+C</kbd></button>
    <button role="menuitem" className={item} onClick={duplicate}>{t(lang, 'workspace.duplicate')}<kbd className="font-mono text-[9.5px]">Ctrl+D</kbd></button>
    {row.sourceKind === 'reply' && <><div className="my-1 border-t border-hair" /><button role="menuitem" className={item} onClick={() => { useAutoReplyStore.getState().update(row.sourceId, { enabled: row.enabled ? false : true }); setMenu(null); }}>{row.enabled ? t(lang, 'workspace.disable') : t(lang, 'workspace.enable')}</button></>}
    <div className="my-1 border-t border-hair" /><button role="menuitem" className={item} onClick={remove}>{t(lang, 'workspace.delete')}<kbd className="font-mono text-[9.5px]">Del</kbd></button>
  </div>;
}

function CommandInspector({
  row,
  workspaceRef,
}: {
  row: CommandRow | null;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
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

  return (
    <aside
      className="relative flex min-h-0 flex-col border-s-2 border-rule bg-surface-2"
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
          <CounterInspector row={row} onClose={() => setSelected([])} />
        ) : (
          <ReplyInspector row={row} onClose={() => setSelected([])} />
        )
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] text-muted">
          {t(lang, 'workspace.selectHint')}
        </div>
      )}
    </aside>
  );
}

function CounterInspector({ row, onClose }: { row: CommandRow; onClose: () => void }) {
  const counter = useCounterStore((s) => s.counters.find((item) => item.id === row.sourceId));
  const updateCommand = useCounterStore((s) => s.updateCommand);
  const updateObs = useCounterStore((s) => s.updateObs);
  const updateTitle = useCounterStore((s) => s.updateTitle);
  const sync = useCounterStore((s) => s.configSync);
  const setSelected = useToolStore((s) => s.setSelected);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const action = row.action ?? 'increase';
  useEffect(() => {
    if (!counter?.titleEnabled || !counter.titleTemplate?.includes('{title}')) return;
    rpc.invoke(Channels.TwitchGetTitle).then((result) => setCurrentTitle(result.title ?? null)).catch(() => undefined);
  }, [counter?.id, counter?.titleEnabled, counter?.titleTemplate]);
  if (!counter) return null;
  const command = counter.commands[action];
  const literalFile = counter.obs.enabled ? renderTemplate(counter.obs.template, counter.count, null) : null;
  const literalTitle = counter.titleEnabled && counter.titleTemplate ? renderTemplate(counter.titleTemplate, counter.count, null, currentTitle) : null;
  return <>
    <InspectorHeader title={`!${command.commandName}`} kind={`${t(lang, 'workspace.counterCommand')} · ${counter.name}`} onClose={onClose} />
    <div className="app-scroll min-h-0 flex-1 space-y-4 px-3 py-3">
      <InspectorField label={t(lang, 'workspace.triggerWord')}><div className="relative"><span className="absolute start-2 top-1/2 -translate-y-1/2 font-extrabold text-accent-text">!</span><Input dir="auto" className="ps-5 font-sans" value={command.commandName} onChange={(event) => updateCommand(counter.id, action, { commandName: event.target.value.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 20) })} /></div></InspectorField>
      <InspectorField label={t(lang, 'workspace.effect')}><SegmentedControl value={action} options={(Object.keys(ACTION_LABELS) as CounterAction[]).map((value) => ({ value, label: ACTION_LABELS[value] }))} onChange={(value) => setSelected([`counter:${counter.id}:${value}`])} /></InspectorField>
      <PermissionField value={command.permission} onChange={(permission) => updateCommand(counter.id, action, { permission })} />
      <CooldownField value={command.cooldownSeconds} onChange={(cooldownSeconds) => updateCommand(counter.id, action, { cooldownSeconds })} />
      <div className="border-t-2 border-rule pt-3"><div className="ui-label mb-2">{t(lang, 'workspace.writesTo')}</div><SinkRow label={t(lang, 'workspace.obsTextFile')} detail={counter.obs.template} checked={counter.obs.enabled} onChange={(enabled) => updateObs(counter.id, { enabled })} />{counter.obs.enabled && <div className="mt-2 flex gap-1"><Input dir="ltr" className="font-mono text-[10px]" value={counter.obs.filePath} onChange={(event) => updateObs(counter.id, { filePath: event.target.value })} /><Button size="sm" variant="outline" aria-label={t(lang, 'workspace.browse')} onClick={async () => { const result = await rpc.invoke(Channels.DialogSaveFile, { defaultName: `${counter.name.toLowerCase().replace(/\s+/g, '-')}.txt` }); if (result.path) updateObs(counter.id, { filePath: result.path }); }}><FolderOpen size={12} /></Button></div>}
      <SinkRow label={t(lang, 'workspace.streamTitle')} detail={counter.titleTemplate || t(lang, 'workspace.notSet')} checked={counter.titleEnabled ?? false} onChange={(titleEnabled) => updateTitle(counter.id, { titleEnabled })} />{counter.titleEnabled && <Input dir="auto" className="mt-2 font-mono text-[10px]" value={counter.titleTemplate ?? ''} onChange={(event) => updateTitle(counter.id, { titleTemplate: event.target.value })} />}</div>
      <div className="border-t-2 border-rule pt-3"><div className="ui-label mb-2">{t(lang, 'workspace.keybind')}</div><FeatureKeybindEditor lang={lang} targetType="counter" targetId={counter.id} /></div>
    </div>
    <InspectorFooter outputs={[literalFile, literalTitle].filter(Boolean) as string[]} savedAt={sync.at} onDelete={() => useCounterStore.getState().removeCounter(counter.id)} />
  </>;
}

function ReplyInspector({ row, onClose }: { row: CommandRow; onClose: () => void }) {
  const rule = useAutoReplyStore((s) => s.rules.find((item) => item.id === row.sourceId));
  const update = useAutoReplyStore((s) => s.update);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const undoHistory = useRef<string[]>([]);
  const [testState, setTestState] = useState<{ loading: boolean; text?: string; error?: string }>({ loading: false });

  useEffect(() => setTestState({ loading: false }), [row.sourceId]);
  if (!rule) return null;

  const setTrigger = (index: number, value: string) =>
    update(rule.id, { triggers: rule.triggers.map((trigger, i) => i === index ? value : trigger) });
  const testAi = async () => {
    setTestState({ loading: true });
    await rpc.invoke(Channels.AutoRepliesSave, { rule }).catch(() => undefined);
    const result = await rpc.invoke(Channels.AutoRepliesGenerate, {
      ruleId: rule.id,
      send: false,
      message: {
        id: 'preview',
        username: 'viewer',
        isBroadcaster: false,
        isMod: false,
        isVip: false,
        isSubscriber: false,
        message: 'السلام عليكم',
        timestamp: new Date().toISOString(),
      },
    }).catch(() => null);
    setTestState(result?.ok
      ? { loading: false, text: result.message }
      : { loading: false, error: result?.error ?? t(lang, 'autoReplies.aiFailed') });
  };
  const preview = rule.responseMode === 'ai'
    ? (testState.text || rule.aiFallback || rule.aiInstructions || t(lang, 'workspace.aiGenerated'))
    : rule.response.replaceAll('{mention}', '@viewer').replaceAll('{username}', 'viewer').replaceAll('{message}', t(lang, 'workspace.sampleMessage'));

  return <>
    <InspectorHeader title={rule.triggers[0] || t(lang, 'workspace.untitled')} kind={rule.responseMode === 'ai' ? t(lang, 'workspace.aiReply') : t(lang, 'workspace.preparedReply')} onClose={onClose} />
    <div className="app-scroll min-h-0 flex-1 space-y-4 px-3 py-3">
      <InspectorField label={t(lang, 'workspace.triggerWord')}>
        {rule.triggers.map((trigger, index) => <div key={index} className="mb-1 flex gap-1"><Input dir="auto" value={trigger} onChange={(event) => setTrigger(index, event.target.value)} />{rule.triggers.length > 1 && <Button size="sm" variant="ghost" onClick={() => update(rule.id, { triggers: rule.triggers.filter((_, i) => i !== index) })}><X size={12} /></Button>}</div>)}
        <Button size="sm" variant="outline" onClick={() => update(rule.id, { triggers: [...rule.triggers, ''] })}><Plus size={12} />{t(lang, 'workspace.addTrigger')}</Button>
      </InspectorField>
      <InspectorField label={t(lang, 'workspace.matchMode')}><SegmentedControl value={rule.matchMode} options={[{ value: 'exact', label: t(lang, 'workspace.exact') }, { value: 'startsWith', label: t(lang, 'workspace.starts') }, { value: 'contains', label: t(lang, 'workspace.contains') }, { value: 'regex', label: t(lang, 'workspace.regex') }]} onChange={(matchMode) => update(rule.id, { matchMode })} /></InspectorField>
      <InspectorField label={t(lang, 'workspace.responseType')}><SegmentedControl value={rule.responseMode ?? 'static'} options={[{ value: 'static', label: t(lang, 'workspace.prepared') }, { value: 'ai', label: t(lang, 'workspace.ai') }]} onChange={(responseMode) => update(rule.id, { responseMode })} /></InspectorField>
      {rule.responseMode === 'ai' ? (
        <div className="space-y-3">
          <InspectorField label={t(lang, 'workspace.provider')}><SegmentedControl value={rule.aiProvider ?? 'openrouter'} options={[{ value: 'openrouter', label: 'OpenRouter' }, { value: 'groq', label: 'Groq' }]} onChange={(aiProvider) => update(rule.id, { aiProvider, aiModel: aiProvider === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free' })} /></InspectorField>
          <InspectorField label={t(lang, 'workspace.instructions')}><textarea dir="auto" className="min-h-20 w-full resize-y border border-rule bg-surface p-2 font-[Cairo] text-[12px] text-ink" value={rule.aiInstructions ?? ''} onChange={(event) => update(rule.id, { aiInstructions: event.target.value })} /></InspectorField>
          <InspectorField label={t(lang, 'workspace.model')}><Input dir="ltr" className="font-mono text-[10px]" value={rule.aiModel ?? (rule.aiProvider === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free')} onChange={(event) => update(rule.id, { aiModel: event.target.value })} /></InspectorField>
          <InspectorField label={t(lang, 'autoReplies.aiMaxTokens')}><Input dir="ltr" type="number" min={40} max={240} value={rule.aiMaxTokens ?? 120} onChange={(event) => update(rule.id, { aiMaxTokens: Math.max(40, Math.min(240, Number(event.target.value) || 120)) })} /></InspectorField>
          <InspectorField label={t(lang, 'workspace.fallback')}><Input dir="auto" value={rule.aiFallback ?? ''} onChange={(event) => update(rule.id, { aiFallback: event.target.value })} /></InspectorField>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={testState.loading} onClick={() => void testAi()}><Sparkles size={12} />{testState.loading ? t(lang, 'autoReplies.aiTesting') : t(lang, 'autoReplies.aiTest')}</Button>
            {testState.text && <span dir="auto" className="font-mono text-[10px] text-ink">{testState.text}</span>}
            {testState.error && <span dir="auto" className="border-s-2 border-accent ps-2 text-[10px] text-accent-text">{testState.error}</span>}
          </div>
        </div>
      ) : (
        <InspectorField label={t(lang, 'workspace.response')}><ReplyComposer value={rule.response} onChange={(response) => { undoHistory.current.push(rule.response); update(rule.id, { response }); }} onUndo={() => { const response = undoHistory.current.pop(); if (response !== undefined) update(rule.id, { response }); }} placeholder={t(lang, 'workspace.response')} tokens={[{ token: '{mention}', label: '{mention}' }, { token: '{username}', label: '{username}' }, { token: '{message}', label: '{message}' }]} /></InspectorField>
      )}
      <PermissionField value={rule.minimumRank ?? 'everyone'} onChange={(minimumRank) => update(rule.id, { minimumRank })} />
      <CooldownField value={rule.cooldownSeconds} onChange={(cooldownSeconds) => update(rule.id, { cooldownSeconds })} />
      <InspectorField label={t(lang, 'autoReplies.userCooldown')}><Input dir="ltr" type="number" min={0} max={3600} value={rule.userCooldownSeconds ?? 0} onChange={(event) => update(rule.id, { userCooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })} /></InspectorField>
      <div className="border-t-2 border-rule pt-3">
        <div className="ui-label mb-2">{t(lang, 'workspace.writesTo')}</div>
        <SinkRow label={t(lang, 'workspace.chatReply')} detail={rule.response || t(lang, 'workspace.notSet')} checked={rule.responseEnabled !== false} onChange={(responseEnabled) => update(rule.id, { responseEnabled })} />
        <SinkRow label={t(lang, 'workspace.streamTitle')} detail={rule.titleTemplate || t(lang, 'workspace.notSet')} checked={rule.titleActionEnabled ?? false} onChange={(titleActionEnabled) => update(rule.id, { titleActionEnabled })} />
      </div>
      {rule.titleActionEnabled && <><TriggerTitleAction rule={rule} lang={lang} update={update} /><FeatureKeybindEditor lang={lang} targetType="title" targetId={rule.id} /></>}
    </div>
    <InspectorFooter outputs={[preview].filter(Boolean)} savedAt={null} onDelete={() => useAutoReplyStore.getState().remove(rule.id)} />
  </>;
}

function InspectorHeader({ title, kind, onClose }: { title: string; kind: string; onClose: () => void }) {
  return <header className="shrink-0 border-b border-hair px-3 py-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div dir="auto" className="truncate font-sans text-[19px] font-extrabold leading-[1.15] text-accent-text">{title}</div><div className="mt-1 truncate ui-label">{kind}</div></div><button type="button" className="grid size-6 place-items-center text-ink" onClick={onClose} aria-label="Close"><X size={13} /></button></div></header>;
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
  return <section className={`shrink-0 border-t-2 border-rule bg-surface ${open ? 'h-[150px]' : 'h-6'}`} tabIndex={0} aria-label={t(lang, 'workspace.log')}>
    <button type="button" className="flex h-6 w-full items-center gap-2 border-b border-hair bg-surface-2 px-2 text-start" onClick={() => setOpen(!open)}><ChevronRight size={11} className={open ? 'rotate-90' : ''} /><span className="ui-label">{t(lang, 'workspace.log')}</span><span aria-hidden className="mx-auto w-9 border-t border-dashed border-rule" /><span className="font-mono text-[9.5px] text-muted">{connected ? `live · ${rate} msg/min` : t(lang, 'workspace.paused')}</span></button>
    {open && <div className="app-scroll h-[126px] px-2 py-1 font-mono text-[10.5px] leading-[1.75]">{entries.length ? entries.map((entry) => <div key={entry.id} className={`grid grid-cols-[58px_58px_minmax(0,1fr)] gap-1 ${entry.kind === 'obs-error' ? 'text-accent-text' : 'text-ink'}`}><span className="text-faint">{formatTime(entry.timestamp)}</span><span className={entry.kind === 'trigger' ? 'text-accent-deep' : 'text-muted'}>{LOG_KIND[entry.kind]}</span><span dir="auto" className="truncate">{entry.message}</span></div>) : <div className="text-muted">{t(lang, 'workspace.noActivity')}</div>}</div>}
  </section>;
}
