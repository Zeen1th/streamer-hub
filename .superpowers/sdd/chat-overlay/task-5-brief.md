## Task 5: Add Chat navigation, preview, and customization UI

Files: src/store/toolStore.ts, src/components/layout/Sidebar.tsx, src/App.tsx, new src/store/chatOverlayStore.ts, new src/components/tools/chat/ChatView.tsx, new src/components/tools/chat/ChatPreview.tsx, new src/components/tools/chat/ChatSettingsPanel.tsx, src/index.css, src/i18n/translations.ts.

- [ ] Add failing store/component tests for hydration, insertion, max-message trimming, duration removal, display mode, and reconnect state.
- [ ] Register Chat without disturbing Feed.
- [ ] Build a clear Chat page with live preview, enable switch, connection state, and copyable OBS URL.
- [ ] Add controls for max messages, duration, stacked/newest-only, font/avatar size, spacing, username/avatar visibility, theme, message shape, and animation.
- [ ] Persist through native RPC and update preview and future overlay clients.
- [ ] Add English and Arabic labels/help text with direction-safe message rendering; preserve title bar/window controls.
- [ ] Include empty, disconnected, avatar-fallback, and server-unavailable states.
- [ ] Run npm run typecheck, npm run build, and node --test src/lib/*.test.mjs.
- [ ] Commit: Add customizable Chat overlay page.
