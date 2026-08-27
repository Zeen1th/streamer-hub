## Task 2: Extend Twitch identity data and avatar resolution

Files: core/Twitch/TwitchIrcClient.cs, core/Twitch/ITwitchClient.cs, core/Host/HostController.cs, new core/Twitch/TwitchUserProfileCache.cs, and native tests or a pure helper test if native test infrastructure is unavailable.

- [ ] Add a failing test for parsing IRC user-id tags while preserving permission flags and message text.
- [ ] Parse user-id from PRIVMSG without changing existing matching or permission behavior.
- [ ] Add a bounded Helix users lookup accepting user IDs, returning profile image URLs, and caching by ID for the current session.
- [ ] Emit normalized messages promptly; avatar enrichment may arrive afterward and failures must use fallback and be logged at most once per user/session.
- [ ] Preserve broadcaster and bot authorization/client-ID behavior.
- [ ] Run parser/cache tests and the native build.
- [ ] Commit: Add Twitch chat identity and avatar enrichment.
