import { useEffect } from 'react';
import { ArrowLeft, ChevronLeft, FileText, Hash, Minus, Plus, RotateCcw, Tv } from 'lucide-react';
import type { Counter, CounterAction, PermissionLevel } from '../../rpc/contracts';
import { useCounterStore } from '../../store/counterStore';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Field } from '../ui/Field';

interface CounterActionsGridViewProps {
  counter: Counter;
  onBack: () => void;
  lang: 'en' | 'ar';
}

const ACTION_META: Record<
  CounterAction,
  {
    icon: typeof Plus;
    labelKey: string;
    descKey: string;
    effectBadge: string;
    accentColor: string;
    actionOutcome: string;
  }
> = {
  increase: {
    icon: Plus,
    labelKey: 'workspace.actionIncrease',
    descKey: 'workspace.actionIncreaseDesc',
    effectBadge: '+1',
    accentColor: 'text-accent-text',
    actionOutcome: '+1',
  },
  decrease: {
    icon: Minus,
    labelKey: 'workspace.actionDecrease',
    descKey: 'workspace.actionDecreaseDesc',
    effectBadge: '−1',
    accentColor: 'text-ink',
    actionOutcome: '−1',
  },
  reset: {
    icon: RotateCcw,
    labelKey: 'workspace.actionReset',
    descKey: 'workspace.actionResetDesc',
    effectBadge: '0',
    accentColor: 'text-muted',
    actionOutcome: '0',
  },
};

const RANKS: PermissionLevel[] = ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'];

function ActionGridCard({
  counter,
  action,
  lang,
}: {
  counter: Counter;
  action: CounterAction;
  lang: 'en' | 'ar';
}) {
  const updateCommand = useCounterStore((s) => s.updateCommand);
  const command = counter.commands[action];
  const meta = ACTION_META[action];
  const Icon = meta.icon;

  const rankOptions: SegmentedOption<PermissionLevel>[] = RANKS.map((value) => ({
    value,
    label: t(lang, `ranks.${value}`),
  }));

  const cooldownDisplay =
    command.cooldownSeconds === 0 ? t(lang, 'workspace.off') : `${command.cooldownSeconds}s`;

  return (
    <div className="flex flex-col rounded-lg border border-rule bg-surface-3 p-5 text-start transition-all shadow-sm hover:border-accent/50 hover:shadow-md">
      {/* Card Header */}
      <div className="flex items-start justify-between border-b border-rule/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md border border-rule bg-surface-2 text-ink shadow-xs">
            <Icon size={17} className={meta.accentColor} />
          </div>
          <div>
            <h3 className="font-sans text-[14px] font-bold tracking-tight text-ink">
              {t(lang, meta.labelKey)}
            </h3>
            <p className="font-sans text-[11px] text-muted">
              {t(lang, meta.descKey)}
            </p>
          </div>
        </div>
        <span
          dir="ltr"
          className="rounded border border-rule bg-surface-2 px-2.5 py-1 font-mono text-[12px] font-bold text-accent-text shadow-xs"
        >
          {meta.effectBadge}
        </span>
      </div>

      {/* Card Fields */}
      <div className="mt-5 flex-1 space-y-5">
        <Field
          label={t(lang, 'workspace.triggerWord')}
          hint={t(lang, 'config.commandHint', { name: command.commandName || '…' })}
          error={command.commandName === '' ? t(lang, 'config.commandRequired') : undefined}
        >
          <div className="relative">
            <span
              aria-hidden
              dir="ltr"
              className="absolute start-3 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-accent-text"
            >
              !
            </span>
            <Input
              dir="auto"
              className="h-9 ps-8 font-sans text-[13px] font-bold uppercase tracking-wide"
              value={command.commandName}
              onChange={(event) =>
                updateCommand(counter.id, action, {
                  commandName: event.target.value
                    .toLowerCase()
                    .replace(/[^\p{L}\p{N}_]/gu, '')
                    .slice(0, 20),
                })
              }
              placeholder={action}
              maxLength={20}
              spellCheck={false}
            />
          </div>
        </Field>

        <Field label={t(lang, 'workspace.who')}>
          <SegmentedControl
            name={`${counter.id}-${action}-permission`}
            value={command.permission}
            options={rankOptions}
            onChange={(permission) => updateCommand(counter.id, action, { permission })}
          />
        </Field>

        <Field label={t(lang, 'workspace.cooldown')}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[11px] text-muted">
              <span className="font-bold text-ink">{cooldownDisplay}</span>
              <span>300s</span>
            </div>
            <Slider
              ariaLabel={`${t(lang, meta.labelKey)} ${t(lang, 'workspace.cooldown')}`}
              min={0}
              max={300}
              step={5}
              value={command.cooldownSeconds}
              onChange={(cooldownSeconds) =>
                updateCommand(counter.id, action, { cooldownSeconds })
              }
            />
          </div>
        </Field>
      </div>

      {/* Preview Pill */}
      <div className="mt-5 border-t border-hair pt-3 text-[11px] text-muted">
        <span className="font-mono text-[10px] uppercase text-muted">Preview: </span>
        <code className="font-mono font-bold text-accent-text">!{command.commandName || '…'}</code>
        <span className="ms-1 font-sans">
          ➔ {counter.name} {meta.actionOutcome}
        </span>
      </div>
    </div>
  );
}

export function CounterActionsGridView({
  counter,
  onBack,
  lang,
}: CounterActionsGridViewProps) {
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const BackIcon = lang === 'ar' ? ChevronLeft : ArrowLeft;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      {/* Sub-Header Toolbar */}
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-rule bg-surface px-3">
        <Button size="sm" variant="outline" onClick={onBack} title={t(lang, 'workspace.backToCommands')}>
          <BackIcon size={13} className="text-accent-text" />
          <span className="font-bold">{t(lang, 'workspace.backToCommands')}</span>
        </Button>

        <span aria-hidden className="mx-1 h-[22px] w-px bg-rule" />

        <div className="flex items-center gap-2 min-w-0">
          <Hash size={13} className="text-accent-text shrink-0" />
          <span className="truncate font-sans text-[13px] font-extrabold text-ink">
            {counter.name}
          </span>
          <span className="font-sans text-[11px] text-muted hidden sm:inline">
            · {t(lang, 'workspace.actionsModalTitle')}
          </span>
        </div>

        {/* Live Count Readout + Quick Manual Buttons */}
        <div className="ms-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 border border-rule bg-surface-2 px-2 py-0.5">
            <span className="font-sans text-[10px] uppercase text-muted max-[1020px]:hidden">
              {t(lang, 'workspace.currentCount')}:
            </span>
            <span dir="ltr" className="font-mono text-[12px] font-extrabold text-accent-text">
              {String(counter.count).padStart(3, '0')}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              size="sm"
              variant="outline"
              className="size-7 p-0"
              disabled={counter.count <= 0}
              onClick={() => decrementManual(counter.id)}
              title="−1"
              aria-label="−1"
            >
              <Minus size={12} />
            </Button>
            <Button
              size="sm"
              className="size-7 p-0"
              onClick={() => incrementManual(counter.id)}
              title="+1"
              aria-label="+1"
            >
              <Plus size={12} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="size-7 p-0 text-muted hover:text-accent-text"
              disabled={counter.count <= 0}
              onClick={() => resetManual(counter.id)}
              title="Reset"
              aria-label="Reset"
            >
              <RotateCcw size={11} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Spacious Grid Canvas */}
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-5 xl:p-6">
        {/* Banner Section */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-4">
          <div>
            <h2 className="font-sans text-base font-extrabold tracking-tight text-ink uppercase">
              {counter.name} · {t(lang, 'workspace.actionsModalTitle')}
            </h2>
            <p className="font-sans text-[12px] text-muted">
              {t(lang, 'workspace.actionsModalSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
            {counter.obs.enabled && (
              <span className="flex items-center gap-1.5 rounded-md border border-rule bg-surface-2 px-2.5 py-1 text-[11px] shadow-xs">
                <FileText size={12} className="text-accent-text" />
                <span>OBS File Sync</span>
              </span>
            )}
            {counter.titleEnabled && (
              <span className="flex items-center gap-1.5 rounded-md border border-rule bg-surface-2 px-2.5 py-1 text-[11px] shadow-xs">
                <Tv size={12} className="text-accent-text" />
                <span>Title Sync</span>
              </span>
            )}
          </div>
        </div>

        {/* 3-Card Actions Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {(['increase', 'decrease', 'reset'] as CounterAction[]).map((action) => (
            <ActionGridCard key={action} counter={counter} action={action} lang={lang} />
          ))}
        </div>

        {/* Bottom Helper Info */}
        <div className="mt-6 rounded-lg border border-rule bg-surface-3 p-4 text-[12px] text-muted shadow-sm">
          <div className="font-bold text-ink mb-1">
            💡 {t(lang, 'workspace.counterCommand')}
          </div>
          <p>
            Whenever viewers or moderators type any of these 3 commands in your Twitch chat, the counter automatically updates its value, writes to your configured OBS text file, and updates your live Twitch stream title.
          </p>
        </div>
      </div>
    </div>
  );
}
