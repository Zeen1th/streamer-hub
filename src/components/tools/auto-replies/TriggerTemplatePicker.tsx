import { MessageSquare, Type } from 'lucide-react';
import { t } from '../../../i18n/translations';
import type { AutoReply } from '../../../rpc/contracts';

interface TriggerTemplatePickerProps {
  rule: AutoReply;
  lang: 'en' | 'ar';
  update(id: string, patch: Partial<AutoReply>): void;
  onChosen?(): void;
}

export function TriggerTemplatePicker({ rule, lang, update, onChosen }: TriggerTemplatePickerProps) {
  const choose = (kind: 'reply' | 'title') => {
    if (kind === 'reply') {
      update(rule.id, { responseEnabled: true, titleActionEnabled: false, themeActionEnabled: false, responseMode: 'static' });
      onChosen?.();
    } else {
      update(rule.id, { responseEnabled: false, titleActionEnabled: true, themeActionEnabled: false });
      onChosen?.();
    }
  };

  return <div className="grid gap-4 p-2 md:grid-cols-2">
    <button type="button" onClick={() => choose('reply')} className="border border-ink/20 bg-surface p-6 text-start transition hover:border-primary hover:bg-primary/5">
      <MessageSquare size={24} className="text-primary" aria-hidden />
      <div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink">{t(lang, 'autoReplies.templateReply')}</div>
      <p className="mt-2 font-sans text-sm text-ink/65">{t(lang, 'autoReplies.templateReplyHint')}</p>
    </button>
    <button type="button" onClick={() => choose('title')} className="border border-ink/20 bg-surface p-6 text-start transition hover:border-primary hover:bg-primary/5">
      <Type size={24} className="text-primary" aria-hidden />
      <div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink">{t(lang, 'autoReplies.templateTitle')}</div>
      <p className="mt-2 font-sans text-sm text-ink/65">{t(lang, 'autoReplies.templateTitleHint')}</p>
    </button>
  </div>;
}
