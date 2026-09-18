import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Crown, MessageSquare, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useConnectionStore } from '../../../store/connectionStore';
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
    const testSenderRole = activeRule.senderRole && activeRule.senderRole !== 'default' ? activeRule.senderRole : undefined;
    const result = await rpc.invoke(Channels.AutoRepliesGenerate, {
      ruleId: activeRule.id,
      send: false,
      senderRole: testSenderRole,
      message: { id: 'preview', username: 'viewer', isBroadcaster: false, isMod: false, isVip: false, isSubscriber: false, message: 'السلام عليكم', timestamp: new Date().toISOString() },
    }).catch(() => null);
    setTestState(result?.ok ? { loading: false, text: result.message } : { loading: false, error: result?.error ?? t(lang, 'autoReplies.aiFailed') });
  };

  const twitchChannel = useConnectionStore((state) => state.twitchChannel);
  const botConnected = useConnectionStore((state) => state.botConnected);
  const botLogin = useConnectionStore((state) => state.botLogin);
  const botAccountEnabled = useConnectionStore((state) => state.botAccountEnabled);
  const activeChatSender = useConnectionStore((state) => state.activeChatSender);
  const activeChatSenderLogin = useConnectionStore((state) => state.activeChatSenderLogin);
  const preferredChatSender = useConnectionStore((state) => state.preferredChatSender);

  const toggleGlobalSender = () => {
    if (!botAccountEnabled) return;
    const nextSender = preferredChatSender === 'bot' ? 'broadcaster' : 'bot';
    useSettingsStore.getState().setPreferredChatSender(nextSender);
  };

  const senderBadge = (() => {
    const isClickable = botAccountEnabled;
    const commonClass = `flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-all ${
      isClickable ? 'cursor-pointer hover:opacity-85 hover:scale-[1.02]' : ''
    }`;
    const clickTitle = isClickable
      ? ` · ${t(lang, 'autoReplies.toggleSenderTitle', { current: activeChatSender === 'bot' ? (botLogin || 'Bot') : (twitchChannel || 'Broadcaster') })}`
      : '';

    if (activeChatSender === 'bot') {
      return (
        <button
          type="button"
          disabled={!isClickable}
          onClick={toggleGlobalSender}
          className={`${commonClass} border-emerald-500/30 bg-emerald-950/20 text-emerald-400`}
          title={`${t(lang, 'settings.senderBotActive', { name: activeChatSenderLogin || botLogin || 'Bot' })}${clickTitle}`}
        >
          <Bot size={14} className="shrink-0" />
          <span>{t(lang, 'autoReplies.sendingAsBot', { name: activeChatSenderLogin || botLogin || 'Bot' })}</span>
        </button>
      );
    }
    if (botAccountEnabled && preferredChatSender === 'bot' && !botConnected) {
      return (
        <button
          type="button"
          disabled={!isClickable}
          onClick={toggleGlobalSender}
          className={`${commonClass} border-amber-500/30 bg-amber-950/20 text-amber-300`}
          title={`${t(lang, 'settings.senderBotOfflineFallback', { name: twitchChannel || 'Broadcaster' })}${clickTitle}`}
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>{t(lang, 'autoReplies.sendingAsFallback', { name: activeChatSenderLogin || twitchChannel || 'Main' })}</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={!isClickable}
        onClick={toggleGlobalSender}
        className={`${commonClass} border-primary/30 bg-primary/10 text-ink`}
        title={`${t(lang, 'settings.senderBroadcasterActive', { name: activeChatSenderLogin || twitchChannel || 'Broadcaster' })}${clickTitle}`}
      >
        <Crown size={14} className="shrink-0 text-primary" />
        <span>{t(lang, 'autoReplies.sendingAsMain', { name: activeChatSenderLogin || twitchChannel || 'Main' })}</span>
      </button>
    );
  })();

  return <div>
    <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
      <div>
        <div className="flex items-center gap-3">
          <MessageSquare size={22} className="text-primary" aria-hidden />
          <h1 className="font-display text-3xl uppercase leading-none text-ink">{t(lang, 'autoReplies.title')}</h1>
        </div>
        <div className="mt-5 h-px bg-ink/20"><div className="h-px w-56 bg-primary" /></div>
        <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">{t(lang, 'autoReplies.subtitle')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {senderBadge}
        <Button onClick={createTrigger}><Plus size={15} />{t(lang, 'autoReplies.new')}</Button>
      </div>
    </header>
    <TriggerGlobalSettings lang={lang} />
    {rules.length === 0 ? <Card className="flex flex-col items-center justify-center px-6 py-16 text-center"><MessageSquare size={28} className="text-primary/60" aria-hidden /><div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink/70">{t(lang, 'autoReplies.empty')}</div><div className="mt-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink/70">{t(lang, 'autoReplies.emptyHint')}</div><Button className="mt-6" onClick={createTrigger}><Plus size={15} />{t(lang, 'autoReplies.new')}</Button></Card> : <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{rules.map((rule) => <Card key={rule.id} title={t(lang, 'autoReplies.rule')} action={<Switch checked={rule.enabled} onChange={(enabled) => update(rule.id, { enabled })} label={t(lang, 'autoReplies.enabled')} />}><div className="space-y-5"><div className="grid grid-cols-[1fr_auto] items-start gap-3"><div className="min-w-0"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.trigger')}</div><div dir={directionFromStart(rule.triggers[0] ?? '')} className="mt-2 truncate border border-ink/15 bg-surface px-3 py-2 font-mono text-sm text-ink" title={rule.triggers[0] || t(lang, 'autoReplies.emptyValue')}>{rule.triggers[0] || t(lang, 'autoReplies.emptyValue')}{rule.triggers.length > 1 ? ` +${rule.triggers.length - 1}` : ''}</div></div><Button variant="outline" size="sm" onClick={() => { openEditor(rule.id); setTestState({ loading: false }); }}><Pencil size={13} />{t(lang, 'autoReplies.customize')}</Button></div><div className="border border-ink/15 bg-surface px-3 py-2"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/60">{t(lang, 'autoReplies.response')}</div><div className="mt-1 break-words font-mono text-sm text-ink">{rule.responseMode === 'ai' ? `${t(lang, 'autoReplies.aiReply')} · ${rule.aiProvider === 'groq' ? 'Groq' : 'OpenRouter'}` : (rule.response || t(lang, 'autoReplies.emptyValue'))}</div></div><div className="flex items-center justify-between border-t border-ink/15 pt-4"><div>{rule.senderRole && rule.senderRole !== 'default' && (<span className="inline-flex items-center gap-1 rounded border border-ink/20 bg-surface px-2 py-0.5 font-mono text-xs text-ink">{rule.senderRole === 'bot' ? `🤖 ${t(lang, 'autoReplies.senderBot')}` : `👑 ${t(lang, 'autoReplies.senderBroadcaster')}`}</span>)}</div><Button variant="danger" size="sm" onClick={() => remove(rule.id)}><Trash2 size={13} />{t(lang, 'autoReplies.delete')}</Button></div></div></Card>)}</div>}
    {activeRule && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-6 backdrop-blur-md" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveRuleId(null); }}><section className="slab max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="auto-reply-customize-title"><header className="flex items-start justify-between gap-4 border-b border-ink/15 px-6 py-5"><div><h2 id="auto-reply-customize-title" className="font-display text-xl uppercase leading-tight tracking-[0.04em] text-ink">{t(lang, 'autoReplies.customize')}</h2><p className="mt-1 font-sans text-sm text-ink/65">{t(lang, 'autoReplies.customizeHint')}</p></div>{hasFeature && <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(true)}>{t(lang, 'autoReplies.changeTemplate')}</Button>}<Button variant="ghost" size="sm" onClick={() => setActiveRuleId(null)} aria-label={t(lang, 'autoReplies.close')} title={t(lang, 'autoReplies.close')}><X size={16} /></Button></header><div className="space-y-6 p-6">{(showTemplatePicker || !hasFeature) ? <TriggerTemplatePicker rule={activeRule} lang={lang} update={update} onChosen={() => setShowTemplatePicker(false)} /> : <><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.trigger')}</div><div className="mt-2 space-y-2">{activeRule.triggers.map((trigger, index) => <div key={`${activeRule.id}-${index}`} className="flex items-center gap-2"><Input dir={directionFromStart(trigger)} value={trigger} onChange={(event) => updateTrigger(activeRule.id, index, event.target.value)} placeholder={index === 0 ? 'السلام عليكم' : 'سلام عليكم'} aria-label={`${t(lang, 'autoReplies.trigger')} ${index + 1}`} />{activeRule.triggers.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeTrigger(activeRule.id, index)} aria-label={t(lang, 'autoReplies.removeTrigger')} title={t(lang, 'autoReplies.removeTrigger')}><X size={15} /></Button>}</div>)}</div><Button className="mt-3" variant="outline" size="sm" onClick={() => addTrigger(activeRule.id)}><Plus size={13} />{t(lang, 'autoReplies.addTrigger')}</Button></div><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.matchMode')}</div><SegmentedControl name={`match-mode-${activeRule.id}`} value={activeRule.matchMode} options={[{ value: 'exact', label: t(lang, 'autoReplies.exact') }, { value: 'startsWith', label: t(lang, 'autoReplies.startsWith') }, { value: 'contains', label: t(lang, 'autoReplies.contains') }, { value: 'regex', label: t(lang, 'autoReplies.regex') }]} onChange={(value) => update(activeRule.id, { matchMode: value as typeof activeRule.matchMode })} /><span className="mt-2 block font-sans text-xs font-normal normal-case tracking-normal text-ink/60">{t(lang, `autoReplies.${activeRule.matchMode}Hint`)}</span></div>{activeRule.responseEnabled !== false && <div className="border border-primary/30 bg-primary/5 p-4"><div className="mt-3"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.answerType')}</div><div className="mt-2"><SegmentedControl name={`response-mode-${activeRule.id}`} value={activeRule.responseMode ?? 'static'} options={[{ value: 'static', label: t(lang, 'autoReplies.preparedReply') }, { value: 'ai', label: t(lang, 'autoReplies.aiReply') }]} onChange={(value) => {
  const nextMode = value as 'static' | 'ai';
  if (nextMode === 'ai' && !activeRule.aiInstructions?.trim()) {
    const isAr = lang === 'ar';
    update(activeRule.id, {
      responseMode: nextMode,
      agentName: activeRule.agentName?.trim() ? activeRule.agentName : (isAr ? 'أروديس' : 'Arrodes'),
      agentRole: activeRule.agentRole?.trim() ? activeRule.agentRole : (isAr ? 'مرآة سحرية فضية عليمة بالأسرار من LOTM تملك بحراً من المعلومات وتجيب بذكاء وغموض' : 'All-knowing magic silver mirror from LOTM that holds endless secrets and answers questions with mysterious wit'),
      agentContext: activeRule.agentContext?.trim() ? activeRule.agentContext : (isAr ? 'الهوية: مرآة أروديس السحرية الفضية من رواية سيد الغموض (LOTM). تملك علماً واسعاً بالأسرار والمعلومات، ومخلصة تماماً لسيدها العظيم (الستريمر).' : 'Identity: Arrodes, the mysterious magic silver mirror from Lord of the Mysteries (LOTM). It possesses immense knowledge of the universe, secrets, and stream facts. It is completely devoted to the Supreme Master (the streamer).'),
      aiInstructions: isAr ? 'أنت أروديس (المرآة السحرية العليمة من LOTM). قدّم إجابات دقيقة وغنية بالمعلومات لـ {username} في أقل من 25 كلمة بنبرة مرآة غامضة ومخلصة للستريمر.' : 'You are Arrodes, the omniscient magic mirror. Answer {username} accurately with insightful knowledge in under 25 words. Maintain a respectful, devoted tone to the streamer and a mysterious mirror vibe.',
    });
  } else {
    update(activeRule.id, { responseMode: nextMode });
  }
}} /></div>{activeRule.responseMode === 'ai' ? <div className="mt-4 space-y-4"><div><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiProvider')}</div><SegmentedControl name={`ai-provider-${activeRule.id}`} value={activeRule.aiProvider ?? 'openrouter'} options={[{ value: 'openrouter', label: 'OpenRouter' }, { value: 'groq', label: 'Groq' }]} onChange={(value) => update(activeRule.id, { aiProvider: value as 'openrouter' | 'groq', aiModel: value === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free' })} /></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.agentName')}<Input dir={lang === 'ar' ? 'rtl' : 'ltr'} className="mt-2" value={activeRule.agentName ?? ''} onChange={(event) => update(activeRule.id, { agentName: event.target.value })} placeholder={t(lang, 'autoReplies.agentNamePlaceholder')} /></label><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.agentRole')}<Input dir={lang === 'ar' ? 'rtl' : 'ltr'} className="mt-2" value={activeRule.agentRole ?? ''} onChange={(event) => update(activeRule.id, { agentRole: event.target.value })} placeholder={t(lang, 'autoReplies.agentRolePlaceholder')} /></label></div><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiInstructions')}<textarea dir={lang === 'ar' ? 'rtl' : 'ltr'} className="mt-2 min-h-24 w-full border border-ink/25 bg-surface-2 px-3 py-3 font-sans text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" value={activeRule.aiInstructions ?? ''} onChange={(event) => update(activeRule.id, { aiInstructions: event.target.value })} placeholder={t(lang, 'autoReplies.aiInstructionsPlaceholder')} /></label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiModel')}<Input className="mt-2" dir="ltr" value={activeRule.aiModel ?? (activeRule.aiProvider === 'groq' ? 'llama-3.1-8b-instant' : 'openrouter/free')} onChange={(event) => update(activeRule.id, { aiModel: event.target.value })} /></label><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiMaxTokens')}<Input className="mt-2" dir="ltr" type="number" min={40} max={240} value={activeRule.aiMaxTokens ?? 120} onChange={(event) => update(activeRule.id, { aiMaxTokens: Math.max(40, Math.min(240, Number(event.target.value) || 120)) })} /></label></div><label className="block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.aiFallback')}<Input className="mt-2" dir={directionFromStart(activeRule.aiFallback ?? '')} value={activeRule.aiFallback ?? ''} onChange={(event) => update(activeRule.id, { aiFallback: event.target.value })} placeholder={t(lang, 'autoReplies.aiFallbackPlaceholder')} /></label><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={testState.loading} onClick={testAi}><Sparkles size={14} />{testState.loading ? t(lang, 'autoReplies.aiTesting') : t(lang, 'autoReplies.aiTest')}</Button>{testState.text && <span dir={directionFromStart(testState.text)} className="font-mono text-sm text-ink">{testState.text}</span>}{testState.error && <span className="font-sans text-xs text-danger">{testState.error}</span>}</div></div> : <div className="mt-4"><ReplyComposer value={activeRule.response} onChange={(response) => updateResponse(activeRule.id, response)} onUndo={() => undoResponse(activeRule.id)} placeholder={t(lang, 'autoReplies.responsePlaceholder')} tokens={[{ token: '{mention}', label: t(lang, 'autoReplies.mentionToken') }, { token: '{username}', label: t(lang, 'autoReplies.usernameToken') }, { token: '{message}', label: t(lang, 'autoReplies.messageToken') }]} /><p className="mt-2 font-sans text-xs text-ink/60">{t(lang, 'autoReplies.undoHint')}</p></div>}<div className="mt-4 border-t border-primary/20 pt-3"><div className="flex items-center justify-between"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">{t(lang, 'autoReplies.whoResponds')}</div>{activeRule.senderRole === 'bot' && !botConnected && (<span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono"><AlertCircle size={11} />{t(lang, 'autoReplies.senderBotOffline')}</span>)}</div><div className="mt-2"><SegmentedControl name={`auto-reply-sender-role-${activeRule.id}`} value={activeRule.senderRole ?? 'default'} options={[{ value: 'default', label: t(lang, 'autoReplies.senderDefault', { sender: activeChatSender === 'bot' ? (botLogin || 'Bot') : (twitchChannel || 'Streamer') }) }, { value: 'broadcaster', label: `👑 ${t(lang, 'autoReplies.senderBroadcaster')}${twitchChannel ? ` (@${twitchChannel})` : ''}` }, { value: 'bot', label: `🤖 ${t(lang, 'autoReplies.senderBot')}${botLogin ? ` (@${botLogin})` : ''}` }]} onChange={(value) => update(activeRule.id, { senderRole: value as 'default' | 'bot' | 'broadcaster' })} /></div><p className="mt-1 font-sans text-xs text-ink/60">{t(lang, 'autoReplies.whoRespondsHint')}</p></div></div></div>}{activeRule.titleActionEnabled && <TriggerTitleAction rule={activeRule} lang={lang} update={update} />}<TriggerRestrictions rule={activeRule} lang={lang} update={update} /><div className="border border-ink/15 bg-surface-2 px-4 py-3"><div className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/60">{t(lang, 'autoReplies.preview')}</div><div className="mt-2 font-mono text-xs text-ink/65">{t(lang, 'autoReplies.previewMessage')}</div><div dir={directionFromStart(activeRule.response)} className="mt-1 break-words font-mono text-sm text-ink">{activeRule.responseMode === 'ai' ? (testState.text || t(lang, 'autoReplies.aiPreviewHint')) : (renderAutoReply(activeRule.response, { username: 'viewer', message: 'السلام عليكم' }) || t(lang, 'autoReplies.emptyValue'))}</div></div></> }</div><footer className="flex justify-end border-t border-ink/15 px-6 py-4"><Button onClick={() => { useAutoReplyStore.getState().flush(); setActiveRuleId(null); }}>{t(lang, 'autoReplies.done')}</Button></footer></section></div>}
  </div>;
}








