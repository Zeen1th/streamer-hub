import { useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Copy,
  ExternalLink,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../../../store/settingsStore';
import { t } from '../../../i18n/translations';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { useChatStore, useChatTarget } from './ChatTargetContext';

export function ChatOverlayBar() {
  const target = useChatTarget();
  const store = useChatStore();
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const overlays = store.overlays || [];
  const activeOverlayId = store.activeOverlayId || 'default';
  const activeOverlay = overlays.find((o) => o.id === activeOverlayId) || overlays[0];

  const [isAdding, setIsAdding] = useState(false);
  const [newOverlayName, setNewOverlayName] = useState('');

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [isDeleting, setIsDeleting] = useState(false);

  const [copiedSettingsFeedback, setCopiedSettingsFeedback] = useState(false);
  const [pastedSettingsFeedback, setPastedSettingsFeedback] = useState(false);
  const [copiedUrlFeedback, setCopiedUrlFeedback] = useState(false);

  // If this is the OBS chat dock rather than chat overlay, don't show the multi-overlay bar
  if (target === 'obs-chat') {
    return null;
  }

  const handleStartAdd = () => {
    setNewOverlayName('');
    setIsAdding(true);
    setIsRenaming(false);
    setIsDeleting(false);
  };

  const handleConfirmAdd = async () => {
    const name = newOverlayName.trim() || `${t(lang, 'chat.overlays.newDefaultName')} ${overlays.length + 1}`;
    await store.createOverlay(name);
    setIsAdding(false);
    setNewOverlayName('');
  };

  const handleStartRename = () => {
    if (!activeOverlay) return;
    setRenameValue(activeOverlay.name);
    setIsRenaming(true);
    setIsAdding(false);
    setIsDeleting(false);
  };

  const handleConfirmRename = async () => {
    if (!activeOverlay) return;
    const name = renameValue.trim();
    if (name && name !== activeOverlay.name) {
      await store.renameOverlay(activeOverlay.id, name);
    }
    setIsRenaming(false);
  };

  const handleConfirmDelete = async () => {
    if (!activeOverlay || activeOverlay.isMain || activeOverlay.id === 'default') return;
    await store.deleteOverlay(activeOverlay.id);
    setIsDeleting(false);
  };

  const handleCopySettings = () => {
    store.copySettings();
    setCopiedSettingsFeedback(true);
    window.setTimeout(() => setCopiedSettingsFeedback(false), 2000);
  };

  const handlePasteSettings = async () => {
    const ok = await store.pasteSettings();
    if (ok) {
      setPastedSettingsFeedback(true);
      window.setTimeout(() => setPastedSettingsFeedback(false), 2000);
    }
  };

  const handleCopyUrl = () => {
    if (!store.overlayUrl) return;
    void navigator.clipboard.writeText(store.overlayUrl);
    setCopiedUrlFeedback(true);
    window.setTimeout(() => setCopiedUrlFeedback(false), 2000);
  };

  return (
    <div className="relative border-b border-rule bg-surface-2 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Active Overlay Page Title & Management Controls */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-accent-text me-1">
            <Layers size={16} className="shrink-0" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink truncate max-w-[220px]" title={activeOverlay?.name}>
              {activeOverlay?.name || t(lang, 'chat.overlays.title')}
            </span>
            {activeOverlay?.isMain && (
              <Badge tone="primary" className="text-[9px] px-1.5 py-0.5">
                {t(lang, 'chat.overlays.main')}
              </Badge>
            )}
          </div>

          {/* Overlay Switcher Dropdown */}
          <div className="relative flex items-center gap-1.5">
            <select
              value={activeOverlayId}
              onChange={(e) => void store.setActiveOverlay(e.target.value)}
              className="h-7 rounded-[4px] border border-white/[0.12] bg-surface-3 px-2 py-0.5 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
              aria-label={t(lang, 'chat.overlays.title')}
              title={t(lang, 'chat.overlays.title')}
            >
              {overlays.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.isMain ? `(${t(lang, 'chat.overlays.main')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartAdd}
              className="h-7 px-2 text-xs"
              title={t(lang, 'chat.overlays.add')}
            >
              <Plus size={13} className="me-1 shrink-0" />
              <span>{t(lang, 'chat.overlays.add')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void store.duplicateOverlay(activeOverlayId)}
              className="h-7 px-2 text-xs text-ink/80 hover:text-white"
              title={t(lang, 'chat.overlays.duplicate')}
            >
              <Copy size={13} className="me-1 shrink-0" />
              <span className="hidden lg:inline">{t(lang, 'chat.overlays.duplicate')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartRename}
              className="h-7 px-2 text-xs text-ink/80 hover:text-white"
              title={t(lang, 'chat.overlays.rename')}
            >
              <Pencil size={12} className="shrink-0" />
              <span className="hidden xl:inline ms-1">{t(lang, 'chat.overlays.rename')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={activeOverlay?.isMain || activeOverlayId === 'default'}
              onClick={() => setIsDeleting(true)}
              className="h-7 px-2 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 disabled:opacity-30"
              title={
                activeOverlay?.isMain || activeOverlayId === 'default'
                  ? t(lang, 'chat.overlays.cannotDeleteMain')
                  : t(lang, 'chat.overlays.delete')
              }
            >
              <Trash2 size={13} className="shrink-0" />
              <span className="hidden xl:inline ms-1">{t(lang, 'chat.overlays.delete')}</span>
            </Button>
          </div>
        </div>

        {/* Right: Settings Transfer & Active OBS URL */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy & Paste Settings */}
          <div className="flex items-center gap-1 border-e border-rule pe-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySettings}
              className="h-7 px-2.5 text-xs"
              title={t(lang, 'chat.overlays.copySettings')}
            >
              {copiedSettingsFeedback ? (
                <>
                  <Check size={13} className="text-emerald-400 me-1 shrink-0" />
                  <span className="text-emerald-400">{t(lang, 'chat.overlays.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={13} className="me-1 shrink-0" />
                  <span>{t(lang, 'chat.overlays.copySettings')}</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteSettings}
              className="h-7 px-2.5 text-xs"
              title={t(lang, 'chat.overlays.pasteSettings')}
            >
              {pastedSettingsFeedback ? (
                <>
                  <Check size={13} className="text-emerald-400 me-1 shrink-0" />
                  <span className="text-emerald-400">{t(lang, 'chat.overlays.pasted')}</span>
                </>
              ) : (
                <>
                  <ClipboardPaste size={13} className="me-1 shrink-0" />
                  <span>{t(lang, 'chat.overlays.pasteSettings')}</span>
                </>
              )}
            </Button>
          </div>

          {/* Active Overlay Browser Source URL */}
          <div className="flex items-center gap-1 bg-surface-3 border border-white/[0.08] rounded-[4px] px-2 py-0.5 max-w-[340px]">
            <span
              className="font-mono text-[11px] text-ink/70 truncate select-all"
              title={store.overlayUrl}
            >
              {store.overlayUrl || 'Loading URL...'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyUrl}
              className="h-6 px-1.5 text-ink/70 hover:text-white"
              title={t(lang, 'chat.overlays.copyUrl')}
            >
              {copiedUrlFeedback ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </Button>
            {store.overlayUrl && (
              <a
                href={store.overlayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-6 px-1.5 text-ink/70 hover:text-white rounded-[3px] hover:bg-white/[0.06]"
                title={t(lang, 'chat.overlays.openBrowser')}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Inline Prompt: Add Overlay */}
      {isAdding && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule pt-2 bg-surface-3 p-2 rounded-[4px]">
          <span className="text-xs text-ink/80">{t(lang, 'chat.overlays.newPrompt')}</span>
          <Input
            value={newOverlayName}
            onChange={(e) => setNewOverlayName(e.target.value)}
            placeholder={t(lang, 'chat.overlays.newDefaultName')}
            className="h-7 w-52 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleConfirmAdd();
              if (e.key === 'Escape') setIsAdding(false);
            }}
          />
          <Button variant="primary" size="sm" onClick={handleConfirmAdd} className="h-7 px-2.5 text-xs">
            {t(lang, 'chat.overlays.add')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)} className="h-7 px-2 text-xs">
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Inline Prompt: Rename Overlay */}
      {isRenaming && activeOverlay && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule pt-2 bg-surface-3 p-2 rounded-[4px]">
          <span className="text-xs text-ink/80">{t(lang, 'chat.overlays.renamePrompt')}</span>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-7 w-52 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleConfirmRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
          />
          <Button variant="primary" size="sm" onClick={handleConfirmRename} className="h-7 px-2.5 text-xs">
            <Check size={14} className="me-1" />
            <span>{t(lang, 'chat.overlays.rename')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsRenaming(false)} className="h-7 px-2 text-xs">
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Inline Prompt: Delete Confirmation */}
      {isDeleting && activeOverlay && !activeOverlay.isMain && activeOverlay.id !== 'default' && (
        <div className="mt-2 flex items-center gap-2 border-t border-rule pt-2 bg-rose-950/40 border border-rose-500/20 p-2 rounded-[4px]">
          <span className="text-xs text-rose-200">
            {t(lang, 'chat.overlays.deleteConfirm').replace('{name}', activeOverlay.name)}
          </span>
          <Button variant="danger" size="sm" onClick={handleConfirmDelete} className="h-7 px-2.5 text-xs">
            <Trash2 size={13} className="me-1" />
            <span>{t(lang, 'chat.overlays.delete')}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsDeleting(false)} className="h-7 px-2 text-xs">
            <X size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
