## Task 3: Implement the loopback OBS overlay server

Files: new core/Overlay/ChatOverlayServer.cs, new core/Overlay/ChatOverlayProtocol.cs, core/MainForm.cs, core/Host/HostController.cs, core/StreamerHub.csproj, new src/chat-overlay.html, new src/chat-overlay.tsx, vite.config.ts.

- [ ] Write failing protocol/server tests for HTTP bootstrap, loopback binding, WebSocket connect, message delivery, settings update, reconnect, and duplicate suppression.
- [ ] Build a Vite multi-page entry for chat-overlay.html that emits a standalone production bundle copied into native wwwroot.
- [ ] Implement HttpListener on 127.0.0.1 using an available local port; return the overlay URL through RPC.
- [ ] Serve the overlay page and WebSocket endpoint, rejecting non-loopback requests and unsupported paths/methods.
- [ ] Broadcast versioned hello, chat-message, settings, connected, and disconnected messages with message IDs.
- [ ] Stop and dispose the server during app shutdown; when the app is not running, show a clear recovery message.
- [ ] Run server tests, npm run build, and dotnet build core\\StreamerHub.csproj --no-restore -p:OutputPath=bin\\ChatOverlayBuild\\ -p:UseAppHost=false.
- [ ] Commit: Add local OBS chat overlay server.
