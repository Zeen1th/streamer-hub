import {
  Plus,
  Trash2,
  UserCheck,
  VolumeX,
} from 'lucide-react';
import type { AiConditionRule, AiConditionThenType, AutoReply } from '../../rpc/contracts';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { cn } from '../../lib/cn';

interface ChatterOverridesSectionProps {
  rule: AutoReply;
  update: (id: string, patch: Partial<AutoReply>) => void;
  lang: 'en' | 'ar';
}

export function ChatterOverridesSection({ rule, update, lang }: ChatterOverridesSectionProps) {
  const conditions: AiConditionRule[] = rule.aiConditions ?? [];

  const handleAddOverride = () => {
    const nextCondition: AiConditionRule = {
      id: `override-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ifType: 'username',
      ifValue: '',
      thenType: 'static_reply',
      thenValue: '',
    };
    update(rule.id, { aiConditions: [...conditions, nextCondition] });
  };

  const handleUpdateCondition = (index: number, patch: Partial<AiConditionRule>) => {
    const nextConditions = conditions.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update(rule.id, { aiConditions: nextConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const nextConditions = conditions.filter((_, i) => i !== index);
    update(rule.id, { aiConditions: nextConditions });
  };

  const handleInsertToken = (index: number, token: string) => {
    const current = conditions[index]?.thenValue || '';
    handleUpdateCondition(index, {
      thenValue: current ? `${current} ${token}` : token,
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-rule bg-surface-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-400" />
            <h2 className="font-semibold text-[13px] tracking-tight text-foreground">
              {lang === 'ar' ? 'استثناءات المتابعين (أولوية أولى)' : 'Specific Chatter Overrides (Priority 1)'}
            </h2>
            {conditions.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 font-mono text-[10px] text-emerald-300 font-semibold">
                {conditions.length} active
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted">
            {lang === 'ar'
              ? 'تخصيص ردود خاصة لمستخدمين محددين (عادي أو ذكاء اصطناعي). يتم التحقق منها أولاً ثم الانتقال للرد العادي.'
              : 'Execute custom static text or AI prompts for specific viewers. Evaluated first; falls back to default if no match.'}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleAddOverride}
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/20"
        >
          <Plus size={12} className="me-1" />
          <span>{lang === 'ar' ? 'إضافة استثناء' : 'Add Override'}</span>
        </Button>
      </div>

      {/* Conditions List */}
      {conditions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-rule py-6 text-center">
          <UserCheck size={24} className="text-muted/60 mb-1.5" />
          <p className="text-[12px] font-medium text-foreground">
            {lang === 'ar' ? 'لا توجد استثناءات مخصصة' : 'No chatter overrides configured'}
          </p>
          <p className="text-[11px] text-muted max-w-sm mt-0.5 mb-3">
            {lang === 'ar'
              ? 'جميع المشاهدين سيتلقون الرد الافتراضي. أضف استثناءً إذا كنت تريد الرد بشكل مميز على مستخدمين محددين.'
              : 'All viewers receive the default response above. Add an override if you want special VIPs, friends, or roles to get unique replies.'}
          </p>
          <Button size="sm" variant="outline" onClick={handleAddOverride}>
            <Plus size={12} className="me-1" />
            <span>{lang === 'ar' ? 'إضافة استثناء للمتابعين' : 'Add First Chatter Override'}</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conditions.map((cond, idx) => (
            <div
              key={cond.id || idx}
              className="relative flex flex-col gap-3 rounded-md border border-rule/80 bg-surface/60 p-3 shadow-xs"
            >
              {/* Card top bar */}
              <div className="flex items-center justify-between border-b border-hair pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-2 font-mono text-[10px] font-bold text-muted">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold text-[11.5px] text-foreground">
                    {cond.ifType === 'username'
                      ? cond.ifValue ? `@${cond.ifValue}` : 'Any chatter'
                      : `Role: ${cond.ifValue}`}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.2 font-mono text-[9.5px] font-semibold uppercase',
                      cond.thenType === 'static_reply' && 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
                      cond.thenType === 'instructions' && 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
                      cond.thenType === 'ignore' && 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
                    )}
                  >
                    {cond.thenType === 'static_reply'
                      ? 'Static Text'
                      : cond.thenType === 'instructions'
                      ? 'AI Prompt'
                      : 'Silent (Ignore)'}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveCondition(idx)}
                  className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  title="Remove Override"
                >
                  <Trash2 size={12} />
                </Button>
              </div>

              {/* Target Chatter Configuration */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-medium text-muted">
                    {lang === 'ar' ? 'الهدف (المتابع أو الرتبة)' : 'Target Chatter (User or Role)'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <SegmentedControl<'username' | 'role'>
                      value={cond.ifType === 'role' ? 'role' : 'username'}
                      onChange={(val) => {
                        handleUpdateCondition(idx, {
                          ifType: val,
                          ifValue: val === 'role' ? 'vip' : '',
                        });
                      }}
                      options={[
                        { value: 'username', label: 'User' },
                        { value: 'role', label: 'Role' },
                      ]}
                      className="shrink-0 text-[10.5px]"
                    />
                    {cond.ifType === 'role' ? (
                      <SegmentedControl<'vip' | 'mod' | 'subscriber'>
                        value={(cond.ifValue as 'vip' | 'mod' | 'subscriber') || 'vip'}
                        onChange={(val) => handleUpdateCondition(idx, { ifValue: val })}
                        options={[
                          { value: 'vip', label: 'VIP' },
                          { value: 'mod', label: 'Mod' },
                          { value: 'subscriber', label: 'Sub' },
                        ]}
                        className="flex-1 text-[10.5px]"
                      />
                    ) : (
                      <Input
                        value={cond.ifValue}
                        onChange={(e) => handleUpdateCondition(idx, { ifValue: e.target.value })}
                        placeholder="@username (e.g. friend_alex)"
                        className="h-7 text-[11px] font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Response Mode Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-medium text-muted">
                    {lang === 'ar' ? 'طريقة الرد للاستثناء' : 'Override Response Mode'}
                  </label>
                  <SegmentedControl<AiConditionThenType>
                    value={cond.thenType}
                    onChange={(thenType) => handleUpdateCondition(idx, { thenType })}
                    options={[
                      { value: 'static_reply', label: 'Static Text' },
                      { value: 'instructions', label: '✨ AI Prompt' },
                      { value: 'ignore', label: '🔇 Silent' },
                    ]}
                    className="text-[10.5px]"
                  />
                </div>
              </div>

              {/* Response Payload */}
              {cond.thenType === 'static_reply' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-medium text-muted">
                      {lang === 'ar' ? 'نص الرد الخاص' : 'Custom Static Reply'}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[9.5px] text-muted">Insert:</span>
                      {['{username}', '{mention}'].map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => handleInsertToken(idx, token)}
                          className="rounded border border-rule bg-surface px-1 py-0.2 font-mono text-[9px] hover:border-accent hover:text-accent"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    value={cond.thenValue}
                    onChange={(e) => handleUpdateCondition(idx, { thenValue: e.target.value })}
                    placeholder="e.g. Welcome back VIP friend! Glad to see you here."
                    className="h-7 text-[11.5px]"
                  />
                </div>
              )}

              {cond.thenType === 'instructions' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10.5px] font-medium text-muted">
                    {lang === 'ar' ? 'توجيهات الذكاء الاصطناعي الخاصة بهذا المتابع' : 'Custom AI Instructions for this Chatter'}
                  </label>
                  <textarea
                    rows={2}
                    value={cond.thenValue}
                    onChange={(e) => handleUpdateCondition(idx, { thenValue: e.target.value })}
                    placeholder="e.g. Greet them with high excitement and playfully reference our co-op game."
                    className="w-full rounded border border-rule bg-surface p-2 text-[11.5px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
                  />
                </div>
              )}

              {cond.thenType === 'ignore' && (
                <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-300 flex items-center gap-2">
                  <VolumeX size={13} className="shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? 'لن يتم إرسال أي رد عندما يكتب هذا المتابع كلمة التفعيل.'
                      : 'Silence active: No response is emitted when this chatter triggers the command.'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
