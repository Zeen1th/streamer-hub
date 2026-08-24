import { useRef, useState } from 'react';
import { directionFromStart, insertTemplateToken } from '../../../lib/autoReplyRules';

interface Token {
  token: string;
  label: string;
}

interface ReplyComposerProps {
  value: string;
  placeholder: string;
  tokens: Token[];
  onChange(value: string): void;
  onUndo(): void;
}

interface Marker {
  left: number;
  top: number;
  height: number;
  offset: number;
}

function caretAtPoint(editor: HTMLDivElement, x: number, y: number): { offset: number; rect: DOMRect } | null {
  const documentPoint = document.caretRangeFromPoint?.(x, y);
  if (documentPoint) {
    const range = documentPoint.cloneRange();
    const all = document.createRange();
    all.selectNodeContents(editor);
    all.setEnd(range.startContainer, range.startOffset);
    return { offset: all.toString().length, rect: range.getBoundingClientRect() };
  }
  const point = document.caretPositionFromPoint?.(x, y);
  if (!point) return null;
  const range = document.createRange();
  range.setStart(point.offsetNode, point.offset);
  range.collapse(true);
  const all = document.createRange();
  all.selectNodeContents(editor);
  all.setEnd(point.offsetNode, point.offset);
  return { offset: all.toString().length, rect: range.getBoundingClientRect() };
}

export function ReplyComposer({ value, placeholder, tokens, onChange, onUndo }: ReplyComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const direction = directionFromStart(value);

  const updateFromEditor = (editor: HTMLDivElement) => onChange(editor.innerText.replace(/\n$/, ''));

  return (
    <div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        dir={direction}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={(event) => updateFromEditor(event.currentTarget)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            onUndo();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          const editor = editorRef.current;
          if (!editor) return;
          const caret = caretAtPoint(editor, event.clientX, event.clientY);
          if (!caret) return;
          const bounds = editor.getBoundingClientRect();
          setMarker({ left: caret.rect.left - bounds.left, top: caret.rect.top - bounds.top, height: caret.rect.height || 20, offset: caret.offset });
        }}
        onDragLeave={() => setMarker(null)}
        onDrop={(event) => {
          event.preventDefault();
          const token = event.dataTransfer.getData('text/plain');
          if (!token) return;
          const next = insertTemplateToken(value, token, marker?.offset ?? null);
          onChange(next);
          setMarker(null);
        }}
        className="relative min-h-24 w-full whitespace-pre-wrap border border-ink/25 bg-surface-2 px-3 py-3 font-mono text-sm text-ink outline-none transition-colors empty:before:pointer-events-none empty:before:text-ink/50 empty:before:content-[attr(data-placeholder)] focus:border-primary focus:ring-2 focus:ring-primary/25"
      >
        {value}
        {marker && <span aria-hidden className="pointer-events-none absolute w-0.5 bg-primary ember-glow" style={{ left: marker.left, top: marker.top, height: marker.height }} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tokens.map((item) => (
          <button
            key={item.token}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', item.token)}
            onClick={() => onChange(insertTemplateToken(value, item.token, null))}
            className="border border-ink/25 bg-surface px-3 py-2 text-start font-sans text-xs font-bold text-ink transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="block">{item.label}</span>
            <span dir="ltr" className="mt-0.5 block font-mono text-xs font-normal text-ink/60">{item.token}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
