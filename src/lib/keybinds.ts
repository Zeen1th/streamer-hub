export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta';

export interface KeyChord {
  key: string;
  modifier?: KeyModifier;
}

export interface KeyboardChordEvent {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat: boolean;
}

export interface ActionBindingLike {
  id: string;
  targetType: 'counter' | 'title';
  targetId: string;
  chord: KeyChord;
}

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight',
]);

export function canonicalChord(chord: KeyChord): string {
  const modifier = chord.modifier?.toLowerCase() as KeyModifier | undefined;
  return `${modifier ? `${modifier}+` : ''}${chord.key.trim()}`;
}

export function chordFromKeyboardEvent(event: KeyboardChordEvent): KeyChord | null {
  if (event.repeat || !event.code || MODIFIER_CODES.has(event.code)) return null;
  const modifiers: KeyModifier[] = [];
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey) modifiers.push('shift');
  if (event.metaKey) modifiers.push('meta');
  if (modifiers.length > 1) return null;
  return modifiers[0] ? { modifier: modifiers[0], key: event.code } : { key: event.code };
}

export function chordConflict(chord: KeyChord, bindings: ReadonlyArray<{ id: string; chord: KeyChord }>, exceptId?: string): string | null {
  const canonical = canonicalChord(chord);
  return bindings.find((binding) => binding.id !== exceptId && canonicalChord(binding.chord) === canonical)?.id ?? null;
}

export function bindingAvailability(
  binding: ActionBindingLike,
  counters: ReadonlyArray<{ id: string }>,
  titleRules: ReadonlyArray<{ id: string }>,
): 'available' | 'orphaned' {
  const targets = binding.targetType === 'counter' ? counters : titleRules;
  return targets.some((target) => target.id === binding.targetId) ? 'available' : 'orphaned';
}
