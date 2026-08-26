import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { directionFromStart, renderAutoReply } from '../../../lib/autoReplyRules';
import { ReplyComposer } from './ReplyComposer';
import { TriggerRestrictions } from './TriggerRestrictions';
import { TriggerGlobalSettings } from './TriggerGlobalSettings';
import { TriggerTitleAction } from './TriggerTitleAction';
import { TriggerTemplatePicker } from './TriggerTemplatePicker';

type TestState = { loading: boolean; text?: string; error?: string };

export function AutoRepliesView() {
  const language = useSettingsStore((state) => state.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const rules = useAutoReplyStore((state) => state.rules);
  const add = useAutoReplyStore((state) => state.add);
  const update = useAutoReplyStore((state) => state.update);
  const remove = useAutoReplyStore((state) => state.remove);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [testState, setTestState] = useState<TestState>({ loading: false });
  const undoHistory = useRef<Record<string, string[]>>({});
  const activeRule = rules.find((rule) => rule.id === activeRuleId) ?? null;
  const hasFeature = Boolean(activeRule && (activeRule.responseEnabled !== false || activeRule.titleActionEnabled || activeRule.themeActionEnabled));
  const openEditor = (id: string) => { setActiveRuleId(id); setShowTemplatePicker(false); };
  const createTrigger = () => { const id = add(); setActiveRuleId(id); setShowTemplatePicker(true); };

  useEffect(() => {
    if (!activeRule) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveRuleId(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [activeRule]);

  const updateResponse = (id: string, response: string) => {
    const current = rules.find((rule) => rule.id === id)?.response;
    if (current !== undefined && current !== response) undoHistory.current[id] = [...(undoHistory.current[id] ?? []), current].slice(-30);
    update(id, { response });
  };
  const undoResponse = (id: string) => { const previous = undoHistory.current[id]?.pop(); if (previous !== undefined) update(id, { response: previous }); };
  const updateTrigger = (id: string, index: number, value: string) => { const rule = rules.find((item) => item.id === id); if (rule) update(id, { triggers: rule.triggers.map((trigger, triggerIndex) => triggerIndex === index ? value : trigger) }); };
  const addTrigger = (id: string) => { const rule = rules.find((item) => item.id === id); if (rule) update(id, { triggers: [...rule.triggers, ''] }); };
  const removeTrigger = (id: string, index: number) => { const rule = rules.find((item) => item.id === id); if (rule && rule.triggers.length > 1) update(id, { triggers: rule.triggers.filter((_, triggerIndex) => triggerIndex !== index) }); };

  const testAi = async () => {
    if (!activeRule) return;
    setTestState({ loading: true });
    await rpc.invoke(Channels.AutoRepliesSave, { rule: activeRule }).catch(() => undefined);
    const result = await rpc.invoke(Channels.AutoRepliesGenerate, { ruleId: activeRule.id, send: false, message: { id: 'preview', username: 'viewer', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false, message: 'السلام عليكم', timestamp: new Date().toISOString() } }).catch(() => null);
    setTestState(result?.ok ? { loading: false, text: result.message } : { loading: false, error: result?.error ?? t(lang, 'autoReplies.aiFailed') });
  };

  return <div>
    <header className="mb-8 flex items-start justify-between gap-6"><div><div className="flex items-center gap-3"><MessageSquare size={22} className="text-primary" aria-hidden /><h1 className="font-display text-3xl uppercase leading-none text-ink">{t(lang, 'autoReplies.title')}</h1></div><div className="mt-5 h-px bg-ink/20"><div className="h-px w-56 bg-primary" /></div><p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">{t(lang, 'autoReplies.subtitle')}</p></div><Button onClick={createTrigger}><Plus size={15} />{t(lang, 'autoReplies.new')}</Button></header>
    <TriggerGlobalSettings lang={lang} />
    {rules.length === 0 ? <Card className="flex flex-col items-center justify-center px-6 py-16 text-center"><MessageSquare size={28} className="text-primary/60" aria-hidden /><div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink/70">{t(lang, 'autoReplies.empty')}</div><div className="mt-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink/70">{t(lang, 'autoReplies.emptyHint')}</div><Button className="mt-6" onClick={createTrigger}><Plus size={15} />{t(lang, 'autoReplies.new')}</Button></Card> : <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{rules.map((rule) => <Card key={rule.id} title={t(lang, 'autoReplies.rule')} action={<Switch checked={rule.enabled} onChange={(enabled) => update(rule.id, { enabled })} label={t(lang, 'autoReplies.enabled')} />}><div className="space-y-5"><div className="grid grid-cols-[1fr_auto] items-start gap-3"><div className="min-w-0"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.trigger')}</div><div dir={directionFromStart(rule.triggers[0] ?? '')} className="mt-2 truncate border border-ink/15 bg-surface px-3 py-2 font-mono text-sm text-ink" title={rule.triggers[0] || t(lang, 'autoReplies.emptyValue')}>{rule.triggers[0] || t(lang, 'autoReplies.emptyValue')}{rule.triggers.length > 1 ? ` +${rule.triggers.length - 1}` : ''}</div></div><Button variant="outline" size="sm" onClick={() => { openEditor(rule.id); setTestState({ loading: false }); }}><Pencil size={13} />{t(lang, 'autoReplies.customize')}</Button></div><div className="border border-ink/15 bg-surface px-3 py-2"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/60">{t(lang, 'autoReplies.response')}</div><div className="mt-1 break-words font-mono text-sm text-ink">{rule.responseMode === 'ai' ? `${t(lang, 'autoReplies.aiReply')} · ${rule.aiProvider === 'groq' ? 'Groq' : 'OpenRouter'}` : (rule.response || t(lang, 'autoReplies.emptyValue'))}</div></div><div className="flex justify-end border-t border-ink/15 pt-4"><Button variant="danger" size="sm" onClick={() => remove(rule.id)}><Trash2 size={13} />{t(lang, 'autoReplies.delete')}</Button></div></div></Card>)}</div>}
    {activeRule && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-6 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveRuleId(null); }}><section className="slab max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="auto-reply-customize-title"><header className="flex items-start justify-between gap-4 border-b border-ink/15 px-6 py-5"><div><h2 id="auto-reply-customize-title" className="font-display text-xl uppercase leading-tight tracking-[0.04em] text-ink">{t(lang, 'autoReplies.customize')}</h2><p className="mt-1 font-sans text-sm text-ink/65">{t(lang, 'autoReplies.customizeHint')}</p></div>{hasFeature && <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(true)}>{t(lang, 'autoReplies.changeTemplate')}</Button>}<Button variant="ghost" size="sm" onClick={() => setActiveRuleId(null)} aria-label={t(lang, 'autoReplies.close')} title={t(lang, 'autoReplies.close')}><X size={16} /></Button></header><div className="space-y-6 p-6">{(showTemplatePicker || !hasFeature) ? <TriggerTemplatePicker rule={activeRule} lang={lang} update={update} onChosen={() => setShowTemplatePicker(false)} /> : <><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.trigger')}</div><div className="mt-2 space-y-2">{activeRule.triggers.map((trigger, index) => <div key={`${activeRule.id}-${index}`} className="flex items-center gap-2"><Input dir={directionFromStart(trigger)} value={trigger} onChange={(event) => updateTrigger(activeRule.id, index, event.target.value)} placeholder={index === 0 ? 'السلام عليكم' : 'سلام عليكم'} aria-label={`${t(lang, 'autoReplies.trigger')} ${index + 1}`} />{activeRule.triggers.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeTrigger(activeRule.id, index)} aria-label={t(lang, 'autoReplies.removeTrigger')} title={t(lang, 'autoReplies.removeTrigger')}><X size={15} /></Button>}</div>)}</div><Button className="mt-3" variant="outline" size="sm" onClick={() => addTrigger(activeRule.id)}><Plus size={13} />{t(lang, 'autoReplies.addTrigger')}</Button></div><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.matchMode')}</div><SegmentedControl name={`match-mode-${activeRule.id}`} value={activeRule.matchMode} options={[{ value: 'exact', label: t(lang, 'autoReplies.exact') }, { value: 'startsWith', label: t(lang, 'autoReplies.startsWith') }, { value: 'contains', label: t(lang, 'autoReplies.contains') }, { value: 'regex', label: t(lang, 'autoReplies.regex') }]} onChange={(value) => update(activeRule.id, { matchMode: value as typeof activeRule.matchMode })} /><span className="mt-2 block font-sans text-xs font-normal normal-case tracking-normal text-ink/60">{t(lang, `autoReplies.${activeRule.matchMode}Hint`)}</span></div>{activeRule.responseEnabled !== false && <div className="border border-primary/30 bg-primary/5 p-4"><div className="mt-3"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.answerType')}</div><div className="mt-2"><SegmentedControl name={`response-mode-${activeRule.id}`} value={activeRule.responseMode ?? 'static'} options={[{ value: 'static', label: t(lang, 'autoReplies.preparedReply') }, { value: 'ai', label: t(lang, 'autoReplies.aiReply') }]} onChange={(value) => update(activeRule.id, { responseMode: value as 'static' | 'ai' })} /></div>{activeRule.responseMode === 'ai' ? <div className="mt-4 space-y-4"><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiProvider')}</div><SegmentedControl name={`ai-provider-${activeRule.id}`} value={activeRule.aiProvider ?? 'openrouter'} options={[{ value: 'openrouter', label: 'OpenRouter' }, { value: 'groq', label: 'Groq' }]} onChange={(value) => update(activeRule.id, { aiProvider: value as 'openrouter' | 'groq', aiModel: value === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free' })} /></div><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiInstructions')}<textarea className="mt-2 min-h-24 w-full border border-ink/25 bg-surface-2 px-3 py-3 font-sans text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" value={activeRule.aiInstructions ?? ''} onChange={(event) => update(activeRule.id, { aiInstructions: event.target.value })} placeholder={t(lang, 'autoReplies.aiInstructionsPlaceholder')} /></label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiModel')}<Input className="mt-2" dir="ltr" value={activeRule.aiModel ?? (activeRule.aiProvider === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free')} onChange={(event) => update(activeRule.id, { aiModel: event.target.value })} /></label><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiMaxTokens')}<Input className="mt-2" dir="ltr" type="number" min={40} max={240} value={activeRule.aiMaxTokens ?? 120} onChange={(event) => update(activeRule.id, { aiMaxTokens: Math.max(40, Math.min(240, Number(event.target.value) || 120)) })} /></label></div><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiFallback')}<Input className="mt-2" dir={directionFromStart(activeRule.aiFallback ?? '')} value={activeRule.aiFallback ?? ''} onChange={(event) => update(activeRule.id, { aiFallback: event.target.value })} placeholder={t(lang, 'autoReplies.aiFallbackPlaceholder')} /></label><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={testState.loading} onClick={testAi}><Sparkles size={14} />{testState.loading ? t(lang, 'autoReplies.aiTesting') : t(lang, 'autoReplies.aiTest')}</Button>{testState.text && <span dir={directionFromStart(testState.text)} className="font-mono text-sm text-ink">{testState.text}</span>}{testState.error && <span className="font-sans text-xs text-danger">{testState.error}</span>}</div></div> : <div className="mt-4"><ReplyComposer value={activeRule.response} onChange={(response) => updateResponse(activeRule.id, response)} onUndo={() => undoResponse(activeRule.id)} placeholder={t(lang, 'autoReplies.responsePlaceholder')} tokens={[{ token: '{mention}', label: t(lang, 'autoReplies.mentionToken') }, { token: '{username}', label: t(lang, 'autoReplies.usernameToken') }, { token: '{message}', label: t(lang, 'autoReplies.messageToken') }]} /><p className="mt-2 font-sans text-xs text-ink/60">{t(lang, 'autoReplies.undoHint')}</p></div>}</div></div>}{activeRule.titleActionEnabled && <TriggerTitleAction rule={activeRule} lang={lang} update={update} />}<TriggerRestrictions rule={activeRule} lang={lang} update={update} /><div className="border border-ink/15 bg-surface-2 px-4 py-3"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/60">{t(lang, 'autoReplies.preview')}</div><div className="mt-2 font-mono text-xs text-ink/65">{t(lang, 'autoReplies.previewMessage')}</div><div dir={directionFromStart(activeRule.response)} className="mt-1 break-words font-mono text-sm text-ink">{activeRule.responseMode === 'ai' ? (testState.text || t(lang, 'autoReplies.aiPreviewHint')) : (renderAutoReply(activeRule.response, { username: 'viewer', message: 'السلام عليكم' }) || t(lang, 'autoReplies.emptyValue'))}</div></div></> }</div><footer className="flex justify-end border-t border-ink/15 px-6 py-4"><Button onClick={() => setActiveRuleId(null)}>{t(lang, 'autoReplies.done')}</Button></footer></section></div>}
  </div>;
}








