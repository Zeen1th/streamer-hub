import { FileText, FolderOpen, Trash2 } from 'lucide-react';
import type { Counter, CounterAction, PermissionLevel } from '../../../rpc/contracts';
import { Channels } from '../../../rpc/contracts';
import { rpc } from '../../../rpc';
import { renderTemplate } from '../../../lib/counterRules';
import { formatTime } from '../../../lib/format';
import { t } from '../../../i18n/translations';
import type { ObsWriteStatus } from '../../../store/counterStore';
import { useCounterStore } from '../../../store/counterStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import type { SegmentedOption } from '../../ui/SegmentedControl';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import { FeatureKeybindEditor } from '../settings/FeatureKeybindEditor';

const RANK_KEYS: Record<PermissionLevel, string> = {
  everyone: 'ranks.everyone',
  subscriber: 'ranks.subscriber',
  vip: 'ranks.vip',
  mod: 'ranks.mod',
  broadcaster: 'ranks.broadcaster',
};

const ACTION_KEYS: Record<CounterAction, { label: string; effect: string; hint: string }> = {
  increase: { label: 'config.increase', effect: '+1', hint: 'config.addsOne' },
  decrease: { label: 'config.decrease', effect: '−1', hint: 'config.removesOne' },
  reset: { label: 'config.reset', effect: '0', hint: 'config.resetsZero' },
};

function CommandBlock({ counter, action }: { counter: Counter; action: CounterAction }) {
  const updateCommand = useCounterStore((s) => s.updateCommand);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const command = counter.commands[action];
  const meta = ACTION_KEYS[action];
  const label = t(lang, meta.label);
  const cooldownLabel = command.cooldownSeconds === 0 ? t(lang, 'config.cooldownOff') : `${command.cooldownSeconds}s`;

  const options: SegmentedOption<PermissionLevel>[] = (
    ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'] as PermissionLevel[]
  ).map((value) => ({ value, label: t(lang, RANK_KEYS[value]) }));

  return (
    <div className="border border-ink/15 bg-surface px-4 py-4">
      <div className="flex items-baseline justify-between">
        <div className="font-display text-base uppercase tracking-[0.04em] text-ink">{label}</div>
        <div dir="ltr" className="font-mono text-xs font-bold text-secondary">{meta.effect}</div>
      </div>
      <div className="mt-4 space-y-4">
        <Field
          label={t(lang, 'config.command')}
          error={command.commandName === '' ? t(lang, 'config.commandRequired') : undefined}
          hint={t(lang, 'config.commandHint', { name: command.commandName || '…' })}
        >
          <div className="relative">
            <span
              aria-hidden
              dir="ltr"
              className="absolute start-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-secondary"
            >
              !
            </span>
            <Input
              dir="auto"
              className="ps-8 text-start uppercase"
              value={command.commandName}
              onChange={(event) =>
                updateCommand(counter.id, action, {
                  commandName: event.target.value.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 20),
                })
              }
              placeholder={t(lang, meta.label).toLowerCase()}
              aria-label={`${t(lang, meta.label)} ${t(lang, 'config.command').toLowerCase()}`}
              maxLength={20}
              spellCheck={false}
            />
          </div>
        </Field>
        <Field label={t(lang, 'config.minRank')}>
          <SegmentedControl
            name={`${counter.id}-${action}-permission`}
            value={command.permission}
            options={options}
            onChange={(permission) => updateCommand(counter.id, action, { permission })}
          />
        </Field>
        <Field label={t(lang, 'config.cooldown', { value: cooldownLabel })}>
          <Slider
            ariaLabel={`${t(lang, meta.label)} ${t(lang, 'config.cooldown', { value: '' }).trim()}`}
            min={0}
            max={300}
            step={5}
            value={command.cooldownSeconds}
            onChange={(cooldownSeconds) => updateCommand(counter.id, action, { cooldownSeconds })}
          />
          <div className="mt-1 flex justify-between font-mono text-xs text-ink/70">
            <span dir="ltr">0s</span>
            <span dir="ltr">300s</span>
          </div>
        </Field>
      </div>
    </div>
  );
}

interface CounterConfigPanelProps {
  counter: Counter;
  onClose?: () => void;
}

export function CounterConfigPanel({ counter, onClose }: CounterConfigPanelProps) {
  const updateName = useCounterStore((s) => s.updateName);
  const updateObs = useCounterStore((s) => s.updateObs);
  const updateTitle = useCounterStore((s) => s.updateTitle);
  const removeCounter = useCounterStore((s) => s.removeCounter);
  const testWrite = useCounterStore((s) => s.testWrite);
  const lastTriggerUser = useCounterStore((s) => s.lastTriggerUser[counter.id]);
  const obsStatus = useCounterStore((s) => s.obsStatus[counter.id]);
  const configSync = useCounterStore((s) => s.configSync);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const browse = () => {
    rpc
      .invoke(Channels.DialogSaveFile, {
        defaultName: `${counter.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'counter'}.txt`,
      })
      .then((result) => {
        if (result.path) updateObs(counter.id, { filePath: result.path });
      })
      .catch(() => undefined);
  };

  const status = obsStatus ?? { state: 'idle' as ObsWriteStatus, message: null, at: null };

  return (
    <Card title={counter.name} className="flex flex-col gap-6">
      <div className="space-y-6">
        <Field label={t(lang, 'config.name')}>
          <Input
            value={counter.name}
            onChange={(event) => updateName(counter.id, event.target.value.slice(0, 40))}
            placeholder="Deaths"
            aria-label={t(lang, 'config.name')}
            maxLength={40}
            spellCheck={false}
          />
        </Field>

        <div className="space-y-4">
          {(['increase', 'decrease', 'reset'] as CounterAction[]).map((action) => (
            <CommandBlock key={action} counter={counter} action={action} />
          ))}
        </div>

        <FeatureKeybindEditor lang={lang} targetType="counter" targetId={counter.id} />

        <div className="border border-ink/15 bg-surface px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-base uppercase tracking-[0.04em] text-ink">
                {t(lang, "config.counterTitle")}
              </div>
              <div className="mt-1 font-sans text-xs text-ink/70">{t(lang, "config.counterTitleHint")}</div>
            </div>
            <Switch
              label={t(lang, "config.counterTitle")}
              checked={counter.titleEnabled ?? false}
              onChange={(titleEnabled) => updateTitle(counter.id, { titleEnabled })}
            />
          </div>
          {counter.titleEnabled && <div className="mt-4 space-y-4">
            <Field label={t(lang, "config.counterTitleTemplate")} hint={t(lang, "config.counterTitleTemplateHint")}>
              <Input
                dir="auto"
                className="text-start"
                value={counter.titleTemplate ?? ""}
                onChange={(event) => updateTitle(counter.id, { titleTemplate: event.target.value })}
                placeholder={counter.name + ": {count}"}
                spellCheck={false}
                aria-label={t(lang, "config.counterTitleTemplate")}
              />
            </Field>
            <div className="border border-ink/20 bg-surface-2 px-4 py-3">
              <div className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/70">{t(lang, "config.counterTitlePreview")}</div>
              <div dir="auto" className="mt-1.5 break-all text-start font-mono text-sm text-ink">
                {renderTemplate(counter.titleTemplate ?? "", counter.count, null) || " "}
              </div>
            </div>
          </div>}
        </div>
        <div className="border border-ink/15 bg-surface px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-base uppercase tracking-[0.04em] text-ink">
                {t(lang, 'config.obs')}
              </div>
              <div className="mt-1 font-sans text-xs text-ink/70">{t(lang, 'config.obsHint')}</div>
            </div>
            <Switch
              label={t(lang, 'config.obs')}
              checked={counter.obs.enabled}
              onChange={(enabled) => updateObs(counter.id, { enabled })}
            />
          </div>
          <div className="mt-4 space-y-4">
            <Field label={t(lang, 'config.targetFile')} hint={t(lang, 'config.targetHint')}>
              <div className="flex gap-2">
                <Input
                  dir="ltr"
                  className="text-start"
                  value={counter.obs.filePath}
                  onChange={(event) => updateObs(counter.id, { filePath: event.target.value })}
                  placeholder="C:\StreamerHub\deaths.txt"
                  spellCheck={false}
                  aria-label={t(lang, 'config.targetFile')}
                />
                <Button
                  variant="outline"
                  size="md"
                  className="shrink-0 px-3.5"
                  onClick={browse}
                  title={t(lang, 'config.browse')}
                >
                  <FolderOpen size={16} />
                </Button>
              </div>
            </Field>
            <Field label={t(lang, 'config.template')} hint={t(lang, 'config.templateHint')}>
              <Input
                dir="ltr"
                className="text-start"
                value={counter.obs.template}
                onChange={(event) => updateObs(counter.id, { template: event.target.value })}
                placeholder={`${counter.name}: {count}`}
                spellCheck={false}
                aria-label={t(lang, 'config.template')}
              />
            </Field>
            <div className="border border-ink/20 bg-surface-2 px-4 py-3">
              <div className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
                {t(lang, 'config.preview')}
              </div>
              <div dir="ltr" className="mt-1.5 break-all text-start font-mono text-sm text-ink">
                {renderTemplate(counter.obs.template, counter.count, lastTriggerUser ?? null) || ' '}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-ink/15 pt-4">
        {counter.obs.enabled ? (
          status.state === 'writing' ? (
            <Badge tone="warning">{t(lang, 'config.writing')}</Badge>
          ) : status.state === 'ok' ? (
            <Badge tone="success">
              {t(lang, 'config.ok')} · {status.at ? formatTime(status.at) : ''}
            </Badge>
          ) : status.state === 'error' ? (
            <Badge tone="danger">{status.message ?? t(lang, 'config.error')}</Badge>
          ) : (
            <Badge tone="neutral">{t(lang, 'config.idle')}</Badge>
          )
        ) : (
          <Badge tone="neutral">{t(lang, 'config.disabled')}</Badge>
        )}
        <div className="flex items-center gap-2">
          {configSync.state === 'syncing' ? (
            <Badge tone="warning">{t(lang, 'config.syncing')}</Badge>
          ) : configSync.state === 'error' ? (
            <Badge tone="danger">{t(lang, 'config.syncFailed')}</Badge>
          ) : null}
          {onClose && <Button variant="outline" size="sm" onClick={onClose}>{t(lang, 'counters.done')}</Button>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => testWrite(counter.id)}
            title={t(lang, 'config.testWrite')}
          >
            <FileText size={13} />
            {t(lang, 'config.testWrite')}
          </Button>
        </div>
      </div>

      <div className="border-t border-ink/15 pt-4">
        <Button
          variant="danger"
          size="sm"
          onClick={() => removeCounter(counter.id)}
          title={t(lang, 'config.delete')}
        >
          <Trash2 size={13} />
          {t(lang, 'config.delete')}
        </Button>
      </div>
    </Card>
  );
}
