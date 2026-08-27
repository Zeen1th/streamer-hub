import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatOverlaySettings } from '../../../rpc/contracts';
import { useChatOverlayStore } from '../../../store/chatOverlayStore';

/**
 * Undo/redo over settings snapshots.
 *
 * Rather than asking every control to record its own history entry, this watches
 * the store and pushes the PREVIOUS value whenever settings change from a source
 * other than undo/redo itself. Continuous gestures (drag, resize, slider scrub)
 * therefore produce one entry each, because they only write to the store on
 * release.
 */
export function useSettingsHistory(limit = 50) {
  const settings = useChatOverlayStore((s) => s.settings);
  const loadState = useChatOverlayStore((s) => s.loadState);
  const updateSettings = useChatOverlayStore((s) => s.updateSettings);

  const past = useRef<ChatOverlaySettings[]>([]);
  const future = useRef<ChatOverlaySettings[]>([]);
  const previous = useRef(settings);
  const applying = useRef(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (previous.current === settings) return;

    // Hydration from the host is not a user edit, so it must not become an
    // undo step - otherwise the first Ctrl+Z would revert to factory defaults.
    if (loadState !== 'ready') {
      previous.current = settings;
      return;
    }

    if (applying.current) {
      applying.current = false;
    } else {
      past.current.push(previous.current);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
    }

    previous.current = settings;
    bump((v) => v + 1);
  }, [settings, loadState, limit]);

  const undo = useCallback(() => {
    const entry = past.current.pop();
    if (!entry) return;
    future.current.push(previous.current);
    applying.current = true;
    void updateSettings(entry);
  }, [updateSettings]);

  const redo = useCallback(() => {
    const entry = future.current.pop();
    if (!entry) return;
    past.current.push(previous.current);
    applying.current = true;
    void updateSettings(entry);
  }, [updateSettings]);

  return {
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
