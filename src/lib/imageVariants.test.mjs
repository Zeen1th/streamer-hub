import assert from 'node:assert/strict';
import test from 'node:test';
import { twitchAvatarUrl, twitchEmoteUrl } from './imageVariants.ts';

test('upgrades a Twitch profile image to a larger variant', () => {
  assert.equal(
    twitchAvatarUrl('https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-70x70.png'),
    'https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png',
  );
});

test('honours a requested size and preserves the file extension', () => {
  assert.equal(
    twitchAvatarUrl('https://cdn.test/x-profile_image-70x70.jpeg', 600),
    'https://cdn.test/x-profile_image-600x600.jpeg',
  );
});

test('leaves URLs that do not match the pattern untouched', () => {
  const untouched = [
    'https://cdn.test/avatar.png',
    'https://static-cdn.jtvnw.net/user-default-pictures/default.png',
    'data:image/svg+xml,%3Csvg%3E%3C/svg%3E',
    '',
  ];
  for (const url of untouched) {
    assert.equal(twitchAvatarUrl(url), url);
  }
});

test('only rewrites a size suffix at the very end of the URL', () => {
  const url = 'https://cdn.test/70x70.png/actual-image.png';
  assert.equal(twitchAvatarUrl(url), url);
});

test('survives a non-string input', () => {
  assert.equal(twitchAvatarUrl(null), null);
  assert.equal(twitchAvatarUrl(undefined), undefined);
});

test('builds the largest emote variant by default', () => {
  assert.equal(
    twitchEmoteUrl('25'),
    'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/3.0',
  );
});

test('accepts an explicit emote scale', () => {
  assert.match(twitchEmoteUrl('25', '1.0'), /\/1\.0$/);
});

test('escapes an emote id so it cannot alter the URL path', () => {
  assert.equal(twitchEmoteUrl('../../evil').includes('../'), false);
});
