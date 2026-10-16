/*
 * The key a keyboard shortcut means, whatever keyboard layout is active.
 *
 * With an Arabic layout switched on, Ctrl+Z reports `key` = 'ئ' instead of 'z', so a shortcut that compares the
 * typed character never fires for bilingual users. When the typed character is not a Latin letter or digit we
 * fall back to the physical key (`code`), which is the same on every layout. When it is Latin we keep it, so
 * layouts that move letters around (AZERTY, Dvorak) still follow the letter printed on their keys.
 */
export function shortcutKey(event: { key: string; code?: string }): string {
  const typed = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (typed.length !== 1 || /^[a-z0-9=+\-_]$/.test(typed)) return typed;

  const code = event.code ?? '';
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) return digit[1];
  switch (code) {
    case 'Equal':
      return '=';
    case 'NumpadAdd':
      return '+';
    case 'Minus':
    case 'NumpadSubtract':
      return '-';
    default:
      return typed;
  }
}
