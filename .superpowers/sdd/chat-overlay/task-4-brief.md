## Task 4: Connect native events and overlay RPC

Files: core/Host/HostController.cs, core/MainForm.cs, src/rpc/contracts.ts, src/rpc/mockHost.ts.

- [ ] Add failing RPC/event tests for state hydration, settings save, URL retrieval, and live forwarding.
- [ ] Register ChatOverlayGetState, ChatOverlaySaveSettings, and ChatOverlayGetUrl channels with typed payloads.
- [ ] Start the server during host initialization, pass settings and normalized Twitch messages, and broadcast connection state.
- [ ] Preserve existing Feed/log/counter/trigger handling while publishing each chat message to the overlay.
- [ ] Return safe disconnected state and retain the overlay shell during reconnects.
- [ ] Update mock host for browser/dev mode.
- [ ] Run frontend and native tests/builds.
- [ ] Commit: Wire chat overlay into host events and RPC.
