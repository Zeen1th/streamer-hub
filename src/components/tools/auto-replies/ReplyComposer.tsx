import { useRef } from 'react';
import { directionFromStart, insertReplyToken } from '../../../lib/autoReplyRules';

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

export function ReplyComposer({ value, placeholder, tokens, onChange, onUndo }: ReplyComposerProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const direction = directionFromStart(value);

  const addToken = (token: string, start?: number | null, end?: number | null) => {
    const editor = editorRef.current;
    const insertion = insertReplyToken(
      value,
      token,
      start ?? editor?.selectionStart ?? null,
      end ?? editor?.selectionEnd ?? null,
    );
    onChange(insertion.value);
    requestAnimationFrame(() => {
      const nextEditor = editorRef.current;
      if (!nextEditor) return;
      nextEditor.focus();
      nextEditor.setSelectionRange(insertion.caret, insertion.caret);
    });
  };

  return (
    <div>
      <textarea
        ref={editorRef}
        dir={direction}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            onUndo();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const token = event.dataTransfer.getData('text/plain');
          if (!token) return;
          addToken(token, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
        }}
        className="min-h-24 w-full resize-y whitespace-pre-wrap border border-ink/25 bg-surface-2 px-3 py-3 font-mono text-sm text-ink outline-none transition-colors placeholder:text-ink/50 focus:border-primary focus:ring-2 focus:ring-primary/25"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {tokens.map((item) => (
          <button
            key={item.token}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', item.token)}
            onClick={() => addToken(item.token)}
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
