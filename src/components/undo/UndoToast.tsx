import { Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { t } from '../../i18n/translations';
import { useSettingsStore } from '../../store/settingsStore';
import { useUndoStore } from '../../store/undoStore';

/** Short confirmation after Ctrl+Z / Ctrl+Y: what was undone or redone. */
export function UndoToast() {
  const toast = useUndoStore((s) => s.toast);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => useUndoStore.setState({ toast: null }), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  let text: string;
  if (toast.type === 'nothing-to-undo') text = t(lang, 'undo.nothingToUndo');
  else if (toast.type === 'nothing-to-redo') text = t(lang, 'undo.nothingToRedo');
  else if ('label' in toast) {
    const what = t(lang, `undo.what.${toast.label.kind}.${toast.label.action}`, { name: toast.label.name || '…' });
    text = t(lang, toast.type === 'undone' ? 'undo.undone' : 'undo.redone', { what });
  } else {
    return null;
  }

  return (
    <div
      role="status"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="pointer-events-none fixed bottom-4 start-1/2 z-[58] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-white/[0.14] bg-[#171e25]/95 px-3.5 py-2 text-[12.5px] text-ink shadow-2xl backdrop-blur-md rtl:translate-x-1/2"
    >
      <Undo2 size={15} className="shrink-0 text-accent" />
      <span dir="auto" className="truncate">{text}</span>
    </div>
  );
}
