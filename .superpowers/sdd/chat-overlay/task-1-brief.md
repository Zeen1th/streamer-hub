## Task 1: Add contracts and persisted overlay settings

Files: core/Rpc/Contracts.cs, core/Storage/SettingsStore.cs, src/rpc/contracts.ts, new src/lib/chatOverlay.ts, new src/lib/chatOverlay.test.mjs

- [ ] Write failing tests for default settings, bounds/clamping, message normalization, and avatar fallback.
- [ ] Run node --test src/lib/chatOverlay.test.mjs and confirm failure.
- [ ] Add ChatOverlaySettings with enabled, maxMessages, durationSeconds, displayMode, fontSize, avatarSize, spacing, showUsernames, showAvatars, theme, messageStyle, and animation.
- [ ] Add optional UserId and AvatarUrl to native and TypeScript ChatMessage contracts.
- [ ] Add safe defaults and immutable get/set methods to SettingsStore; old JSON must deserialize with defaults.
- [ ] Implement pure normalization helpers that trim fields, cap display data, validate settings, and select a neutral avatar fallback.
- [ ] Run the new tests and node --test src/lib/*.test.mjs.
- [ ] Commit: Add chat overlay contracts and settings.
