import { useState } from 'react';
import {
  Plus,
  UserCheck,
  VolumeX,
  X,
} from 'lucide-react';
import type { AiConditionRule, AiConditionThenType, AutoReply } from '../../rpc/contracts';
import { normalizeUsername } from '../../lib/autoReplyRules';
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
  const [tagInput, setTagInput] = useState('');
  const isAi = rule.responseMode === 'ai';

  // Extract the single chatter override condition
  const conditions = rule.aiConditions ?? [];
  const existingCond: AiConditionRule | undefined =
    conditions.find((c) => c.ifType === 'username') ?? conditions[0];

  const targetUsers: string[] = existingCond
    ? existingCond.ifValue
        .split(/[,;\s]+/)
        .map(normalizeUsername)
        .filter(Boolean)
    : [];

  // If command is AI, only 'instructions' or 'ignore' are permitted (NO normal text)
  // If command is Prepared, only 'static_reply' or 'ignore' are permitted (NO AI reply)
  const rawMode: AiConditionThenType = existingCond?.thenType ?? (isAi ? 'instructions' : 'static_reply');
  const overrideMode: AiConditionThenType = rawMode === 'ignore'
    ? 'ignore'
    : isAi
      ? 'instructions'
      : 'static_reply';
  const overrideValue: string = existingCond?.thenValue ?? '';

  const saveCondition = (nextUsers: string[], mode: AiConditionThenType, value: string) => {
    if (nextUsers.length === 0) {
      update(rule.id, { aiConditions: [], aiTargetUsers: [] });
      return;
    }

    // Enforce valid mode strictly
    const sanitizedMode: AiConditionThenType = mode === 'ignore'
      ? 'ignore'
      : isAi
        ? 'instructions'
        : 'static_reply';

    const nextCondition: AiConditionRule = {
      id: existingCond?.id || 'chatter-override',
      ifType: 'username',
      ifValue: nextUsers.join(', '),
      thenType: sanitizedMode,
      thenValue: value,
    };
    update(rule.id, {
      aiConditions: [nextCondition],
      aiTargetUsers: nextUsers,
    });
  };

  const handleAddUser = () => {
    const clean = normalizeUsername(tagInput);
    if (!clean) return;
    if (!targetUsers.includes(clean)) {
      const nextUsers = [...targetUsers, clean];
      saveCondition(nextUsers, overrideMode, overrideValue);
    }
    setTagInput('');
  };

  const handleRemoveUser = (userToRemove: string) => {
    const nextUsers = targetUsers.filter((u) => u !== userToRemove);
    saveCondition(nextUsers, overrideMode, overrideValue);
  };

  const handleModeChange = (newMode: AiConditionThenType) => {
    saveCondition(targetUsers, newMode, overrideValue);
  };

  const handleValueChange = (newValue: string) => {
    saveCondition(targetUsers, overrideMode, newValue);
  };

  const handleInsertToken = (token: string) => {
    const nextValue = overrideValue ? `${overrideValue} ${token}` : token;
    handleValueChange(nextValue);
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
            {targetUsers.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 font-mono text-[10px] text-emerald-300 font-semibold">
                {targetUsers.length} {targetUsers.length === 1 ? 'user' : 'users'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted">
            {lang === 'ar'
              ? isAi
                ? 'أضف أسماء المتابعين لتخصيص رد ذكاء اصطناعي خاص بهم أو تجاهلهم. عند تطابقهم ينفذ الاستثناء أولاً ويتخطى الرد الافتراضي.'
                : 'أضف أسماء المتابعين لتخصيص رد عادي خاص بهم أو تجاهلهم. عند تطابقهم ينفذ الاستثناء أولاً ويتخطى الرد الافتراضي.'
              : isAi
                ? 'Add viewers to receive custom AI instructions or be silenced. Matches execute first; all others receive the default AI reply.'
                : 'Add viewers to receive a custom normal text message or be silenced. Matches execute first; all others receive the default reply.'}
          </p>
        </div>
      </div>

      {/* Viewers List Input */}
      <div className="space-y-2">
        <label className="text-[11px] font-medium text-foreground">
          {lang === 'ar' ? 'قائمة المشاهدين المستثنين' : 'Overridden Viewers List'}
        </label>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">
              @
            </span>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddUser();
                }
              }}
              placeholder={
                lang === 'ar'
                  ? 'اكتب اسم المشاهد واضغط Enter للإضافة...'
                  : 'Type viewer username and press Enter to add...'
              }
              className="h-8 ps-6 text-[11.5px] font-mono"
            />
          </div>

          <Button size="sm" variant="outline" onClick={handleAddUser} className="h-8 px-3">
            <Plus size={12} className="me-1" />
            <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
          </Button>
        </div>

        {/* Tags / Chips */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] pt-0.5">
          {targetUsers.length === 0 ? (
            <span className="font-sans text-[11px] text-muted italic">
              {lang === 'ar'
                ? 'لا يوجد متابعون في القائمة. الجميع سيتلقون الرد الافتراضي.'
                : 'No viewers in list. Everyone receives the default response above.'}
            </span>
          ) : (
            targetUsers.map((user) => (
              <span
                key={user}
                className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-emerald-300 shadow-xs"
              >
                <span>@{user}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveUser(user)}
                  className="text-emerald-400/70 hover:text-red-400 transition-colors"
                  title={`Remove @${user}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Override Response Configuration (When targetUsers has at least 1 user) */}
      {targetUsers.length > 0 && (
        <div className="space-y-3 rounded-md border border-rule/80 bg-surface/60 p-3 pt-3 mt-1">
          {/* Response Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                {lang === 'ar' ? 'الرد الخاص بهؤلاء المتابعين' : 'Response for Listed Viewers'}
              </label>
              <span
                className={cn(
                  'rounded px-1.5 py-0.2 font-mono text-[9.5px] font-semibold uppercase',
                  overrideMode === 'static_reply' && 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
                  overrideMode === 'instructions' && 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
                  overrideMode === 'ignore' && 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
                )}
              >
                {overrideMode === 'static_reply'
                  ? 'Normal Text'
                  : overrideMode === 'instructions'
                  ? 'AI Banter'
                  : 'Silent'}
              </span>
            </div>

            <SegmentedControl<AiConditionThenType>
              value={overrideMode}
              onChange={handleModeChange}
              options={
                isAi
                  ? [
                      { value: 'instructions', label: lang === 'ar' ? 'رد ذكاء اصطناعي ✨' : '✨ AI Reply' },
                      { value: 'ignore', label: lang === 'ar' ? 'صامت (تجاهل) 🔇' : '🔇 Silent' },
                    ]
                  : [
                      { value: 'static_reply', label: lang === 'ar' ? 'رد عادي' : 'Normal Text' },
                      { value: 'ignore', label: lang === 'ar' ? 'صامت (تجاهل) 🔇' : '🔇 Silent' },
                    ]
              }
              className="text-[11px]"
            />
          </div>

          {/* Static Reply Text */}
          {overrideMode === 'static_reply' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-medium text-muted">
                  {lang === 'ar' ? 'نص الرد الخاص' : 'Custom Static Message'}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[9.5px] text-muted">Insert:</span>
                  {['{username}', '{mention}'].map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => handleInsertToken(token)}
                      className="rounded border border-rule bg-surface px-1 py-0.2 font-mono text-[9px] hover:border-accent hover:text-accent"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                value={overrideValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'مثال: أهلاً بصديقنا المميز {mention}! نورت البث.'
                    : 'e.g. Welcome back VIP friend {mention}! Glad to see you here.'
                }
                className="h-8 text-[11.5px]"
              />
            </div>
          )}

          {/* AI Persona Instructions */}
          {overrideMode === 'instructions' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-medium text-muted">
                {lang === 'ar'
                  ? 'توجيهات الذكاء الاصطناعي الخاصة بهؤلاء المتابعين'
                  : 'Custom AI Instructions for Listed Viewers'}
              </label>
              <textarea
                rows={2}
                value={overrideValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'مثال: رحب بهم بحماس وامزح معهم بخصوص لعبتنا الأخيرة...'
                    : 'e.g. Greet them with high excitement and playfully banter about our co-op game...'
                }
                className="w-full rounded border border-rule bg-surface p-2 text-[11.5px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
              />
            </div>
          )}

          {/* Silent Mode */}
          {overrideMode === 'ignore' && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-300 flex items-center gap-2">
              <VolumeX size={13} className="shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تفعيل الصمت: لن يتم إرسال أي رد عندما يكتب المشاهدون المذكورون في القائمة أعلاه كلمة التفعيل.'
                  : 'Silence active: No response is sent when viewers in this list trigger the command.'}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
