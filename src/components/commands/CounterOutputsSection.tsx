import { useEffect, useState } from 'react';
import { FileText, FolderOpen, Keyboard, Tv } from 'lucide-react';
import type { Counter } from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import { renderTemplate } from '../../lib/counterRules';
import { fieldDir } from '../../lib/textDirection';
import { useCounterStore } from '../../store/counterStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { FeatureKeybindEditor } from '../tools/settings/FeatureKeybindEditor';

/** Where a counter writes its value (an OBS text file, the Twitch title) and exactly what it writes. */

const TEXT = {
  en: {
    heading: 'Writes to',
    sub: 'Everything this counter updates by itself when its number changes.',
    fileTitle: 'OBS text file',
    fileOff: 'Off. Turn it on to keep a text file up to date for an OBS text source.',
    path: 'File',
    browse: 'Browse',
    writeText: 'Text written to the file',
    tokens: 'Click to add',
    examples: 'Or start from',
    preview: 'What gets written',
    writeNow: 'Write now',
    statusOk: 'Written',
    statusError: 'Could not write',
    noFile: 'Choose a file first',
    help: '{count} (or {counter}) is the number, {name} is this counter\'s name, {username} is the last person who changed it. A new line in the box is a new line in the file.',
    titleTitle: 'Stream title',
    titleOff: 'Off. Turn it on to show this counter in your live Twitch title.',
    titleTemplate: 'Title text',
    titleHelp: '{title} is your own title without the counter. {count} (or {counter}) is the number, {name} the counter\'s name.',
    titleNeedsTitle: 'Add {title} so your own title stays in front of the counter.',
    apply: 'Apply to title',
    detach: 'Remove from title',
    applying: 'Applying...',
    applied: 'Title applied',
    applyFailed: 'Could not apply the title',
    detached: 'Removed from the title',
    liveTitle: 'Live title now',
    keybindTitle: 'Keyboard shortcut',
  },
  ar: {
    heading: 'يكتب إلى',
    sub: 'كل ما يحدّثه هذا العدّاد تلقائياً عندما يتغير رقمه.',
    fileTitle: 'ملف نصي لـ OBS',
    fileOff: 'متوقف. فعّله ليبقى ملف نصي محدّثاً لمصدر نص في OBS.',
    path: 'الملف',
    browse: 'استعراض',
    writeText: 'النص الذي يُكتب في الملف',
    tokens: 'اضغط للإضافة',
    examples: 'أو ابدأ من',
    preview: 'ما سيُكتب',
    writeNow: 'اكتب الآن',
    statusOk: 'تمت الكتابة',
    statusError: 'تعذّرت الكتابة',
    noFile: 'اختر ملفاً أولاً',
    help: '{count} (أو {counter}) هو الرقم، و {name} اسم هذا العدّاد، و {username} آخر شخص غيّره. السطر الجديد في الصندوق سطر جديد في الملف.',
    titleTitle: 'عنوان البث',
    titleOff: 'متوقف. فعّله ليظهر هذا العدّاد في عنوان بثك على تويتش.',
    titleTemplate: 'نص العنوان',
    titleHelp: '{title} هو عنوانك بدون العدّاد. {count} (أو {counter}) هو الرقم و {name} اسم العدّاد.',
    titleNeedsTitle: 'أضف {title} ليبقى عنوانك الخاص قبل العدّاد.',
    apply: 'طبّق على العنوان',
    detach: 'أزل من العنوان',
    applying: 'جارٍ التطبيق...',
    applied: 'تم تطبيق العنوان',
    applyFailed: 'تعذّر تطبيق العنوان',
    detached: 'تمت الإزالة من العنوان',
    liveTitle: 'العنوان الحالي',
    keybindTitle: 'اختصار لوحة المفاتيح',
  },
} as const;

const labelClass = 'font-sans text-[12px] font-medium text-ink';
const chipClass =
  'rounded border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors';
const cardClass = 'flex flex-col rounded-lg border bg-surface-3 p-5 text-start shadow-sm transition-all';

interface SectionProps {
  counter: Counter;
  lang: 'en' | 'ar';
}

function CardHeader({ icon, title, checked, onChange }: { icon: React.ReactNode; title: string; checked?: boolean; onChange?: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule/50 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md border border-rule bg-surface-2 text-accent-text shadow-xs">{icon}</div>
        <h3 className="font-sans text-[14px] font-bold tracking-tight text-ink">{title}</h3>
      </div>
      {onChange && <Switch checked={checked ?? false} onChange={onChange} label={title} />}
    </div>
  );
}

function ObsFileCard({ counter, lang }: SectionProps) {
  const tx = TEXT[lang];
  const updateObs = useCounterStore((s) => s.updateObs);
  const testWrite = useCounterStore((s) => s.testWrite);
  const status = useCounterStore((s) => s.obsStatus[counter.id]);
  const rendered = renderTemplate(counter.obs.template, counter.count, null, null, counter.name);
  const examples = ['{count}', '{name}: {count}', lang === 'ar' ? 'عدّاد {name}: {count}' : 'The {name} counter is: {count}'];

  const addToken = (token: string) => updateObs(counter.id, { template: counter.obs.template + token });

  return (
    <div className={`${cardClass} ${counter.obs.enabled ? 'border-accent/50' : 'border-rule'}`}>
      <CardHeader icon={<FileText size={17} />} title={tx.fileTitle} checked={counter.obs.enabled} onChange={(enabled) => updateObs(counter.id, { enabled })} />
      {!counter.obs.enabled && <p className="mt-4 font-sans text-[12px] text-muted">{tx.fileOff}</p>}

      <div className={`mt-5 space-y-4 ${counter.obs.enabled ? '' : 'opacity-60'}`}>
        <div className="space-y-1.5">
          <label className={labelClass}>{tx.path}</label>
          <div className="flex gap-1.5">
            <Input
              dir="ltr"
              className="h-9 font-mono text-[11px]"
              value={counter.obs.filePath}
              placeholder="C:\stream\counter.txt"
              onChange={(event) => updateObs(counter.id, { filePath: event.target.value })}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 gap-1.5"
              onClick={async () => {
                const result = await rpc.invoke(Channels.DialogSaveFile, { defaultName: `${counter.name.toLowerCase().replace(/\s+/g, '-')}.txt` });
                if (result.path) updateObs(counter.id, { filePath: result.path });
              }}
            >
              <FolderOpen size={13} />
              <span>{tx.browse}</span>
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>{tx.writeText}</label>
          <textarea
            rows={2}
            dir={fieldDir(counter.obs.template)}
            value={counter.obs.template}
            onChange={(event) => updateObs(counter.id, { template: event.target.value })}
            className="w-full resize-y rounded-[4px] border border-[#2e3740] bg-[#161c22] px-2.5 py-2 font-sans text-[13px] text-[#f0f3fa] focus:border-[#445060] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/25"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-muted">{tx.tokens}:</span>
            {['{count}', '{name}', '{username}'].map((token) => (
              <button key={token} type="button" className={chipClass} onClick={() => addToken(token)}>
                {token}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-muted">{tx.examples}:</span>
            {examples.map((example) => (
              <button key={example} type="button" className={chipClass} onClick={() => updateObs(counter.id, { template: example })}>
                {example}
              </button>
            ))}
          </div>
          <p className="font-sans text-[11px] leading-relaxed text-muted">{tx.help}</p>
        </div>

        <div className="space-y-1.5">
          <div className="ui-label">{tx.preview}</div>
          <pre dir={fieldDir(rendered)} className="min-h-9 whitespace-pre-wrap break-words rounded-[4px] border border-rule bg-surface-2 px-3 py-2 font-sans text-[13px] font-semibold text-ink">
            {rendered || ' '}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" disabled={!counter.obs.filePath.trim()} onClick={() => testWrite(counter.id)}>
            {tx.writeNow}
          </Button>
          {!counter.obs.filePath.trim() && <span className="font-sans text-[11px] text-muted">{tx.noFile}</span>}
          {status?.state === 'ok' && <span className="font-mono text-[11px] text-emerald-400">{tx.statusOk}</span>}
          {status?.state === 'error' && <span className="font-mono text-[11px] text-amber-400">{tx.statusError}{status.message ? `: ${status.message}` : ''}</span>}
        </div>
      </div>
    </div>
  );
}

function TitleCard({ counter, lang }: SectionProps) {
  const tx = TEXT[lang];
  const updateTitle = useCounterStore((s) => s.updateTitle);
  const applyTitle = useCounterStore((s) => s.applyTitle);
  const detachTitle = useCounterStore((s) => s.detachTitle);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const template = counter.titleTemplate ?? '';
  const rendered = counter.titleEnabled && template ? renderTemplate(template, counter.count, null, currentTitle, counter.name) : '';

  useEffect(() => {
    if (!counter.titleEnabled) return;
    rpc.invoke(Channels.TwitchGetTitle).then((result) => setCurrentTitle(result.title ?? null)).catch(() => undefined);
  }, [counter.id, counter.titleEnabled]);

  const refreshTitle = () => rpc.invoke(Channels.TwitchGetTitle).then((res) => setCurrentTitle(res.title ?? null)).catch(() => undefined);
  const flash = (text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className={`${cardClass} ${counter.titleEnabled ? 'border-accent/50' : 'border-rule'}`}>
      <CardHeader
        icon={<Tv size={17} />}
        title={tx.titleTitle}
        checked={counter.titleEnabled ?? false}
        onChange={(titleEnabled) => updateTitle(counter.id, { titleEnabled, titleTemplate: template || `{title} | ${counter.name}: {count}` })}
      />
      {!counter.titleEnabled && <p className="mt-4 font-sans text-[12px] text-muted">{tx.titleOff}</p>}

      <div className={`mt-5 space-y-4 ${counter.titleEnabled ? '' : 'opacity-60'}`}>
        <div className="space-y-1.5">
          <label className={labelClass}>{tx.titleTemplate}</label>
          <Input
            dir={fieldDir(template)}
            className="h-9 font-sans text-[13px]"
            value={template}
            placeholder={`{title} | ${counter.name}: {count}`}
            onChange={(event) => updateTitle(counter.id, { titleTemplate: event.target.value })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-muted">{tx.tokens}:</span>
            {['{title}', '{count}', '{name}'].map((token) => (
              <button key={token} type="button" className={chipClass} onClick={() => updateTitle(counter.id, { titleTemplate: template + token })}>
                {token}
              </button>
            ))}
          </div>
          <p className="font-sans text-[11px] leading-relaxed text-muted">{tx.titleHelp}</p>
          {template.trim() && !template.includes('{title}') && !template.includes('{current_title}') && (
            <p className="font-sans text-[11px] text-amber-400">{tx.titleNeedsTitle}</p>
          )}
        </div>

        {rendered && (
          <div className="space-y-1.5">
            <div className="ui-label">{tx.preview}</div>
            <div dir={fieldDir(rendered)} className="break-words rounded-[4px] border border-rule bg-surface-2 px-3 py-2 font-sans text-[13px] font-semibold text-ink">
              {rendered}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!template.trim()}
            onClick={async () => {
              setStatus(tx.applying);
              const ok = await applyTitle(counter.id);
              if (ok) void refreshTitle();
              flash(ok ? tx.applied : tx.applyFailed);
            }}
          >
            {tx.apply}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await detachTitle(counter.id);
              if (ok) void refreshTitle();
              flash(ok ? tx.detached : tx.applyFailed);
            }}
          >
            {tx.detach}
          </Button>
          {status && <span className="font-mono text-[11px] text-accent-text">{status}</span>}
        </div>
        {currentTitle && (
          <p className="font-mono text-[10.5px] text-muted">
            {tx.liveTitle}: <strong className="text-ink">{currentTitle}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

export function CounterOutputsSection({ counter, lang }: SectionProps) {
  const tx = TEXT[lang];
  return (
    <section className="mt-8" aria-label={tx.heading}>
      <div className="mb-4 border-b border-rule pb-3">
        <h2 className="font-sans text-base font-extrabold uppercase tracking-tight text-ink">{tx.heading}</h2>
        <p className="font-sans text-[12px] text-muted">{tx.sub}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ObsFileCard counter={counter} lang={lang} />
        <TitleCard counter={counter} lang={lang} />
      </div>
      <div className="mt-5 rounded-lg border border-rule bg-surface-3 p-5">
        <div className="mb-3 flex items-center gap-2 font-sans text-[14px] font-bold text-ink">
          <Keyboard size={16} className="text-accent-text" />
          {tx.keybindTitle}
        </div>
        <FeatureKeybindEditor lang={lang} targetType="counter" targetId={counter.id} />
      </div>
    </section>
  );
}
