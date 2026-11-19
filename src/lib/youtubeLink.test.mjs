import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeLink, parseYouTubeTime, parseYouTubeUrl, youTubeWatchUrl } from './youtubeLink.ts';

const ID = 'dQw4w9WgXcQ';

test('every YouTube link form gives the video id', () => {
  const forms = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&list=PL123&index=2`,
    `http://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}&si=abc`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=xyz`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtu.be/${ID}`,
    `<https://youtu.be/${ID}>`,
    `https://YOUTU.BE/${ID}`,
  ];
  for (const form of forms) {
    assert.deepEqual(parseYouTubeLink(form), { videoId: ID, startSeconds: 0 }, form);
  }
});

test('start times from t= and start=, in seconds or h/m/s', () => {
  assert.equal(parseYouTubeLink(`https://youtu.be/${ID}?t=90`).startSeconds, 90);
  assert.equal(parseYouTubeLink(`https://youtu.be/${ID}?t=90s`).startSeconds, 90);
  assert.equal(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&t=1m30s`).startSeconds, 90);
  assert.equal(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`).startSeconds, 3723);
  assert.equal(parseYouTubeLink(`https://www.youtube.com/embed/${ID}?start=42`).startSeconds, 42);
  assert.equal(parseYouTubeLink(`https://youtu.be/${ID}#t=2m`).startSeconds, 120);
  // nonsense start = from the beginning
  assert.equal(parseYouTubeLink(`https://youtu.be/${ID}?t=soon`).startSeconds, 0);
});

test('parseYouTubeTime', () => {
  assert.equal(parseYouTubeTime('90'), 90);
  assert.equal(parseYouTubeTime('1m30s'), 90);
  assert.equal(parseYouTubeTime('1h2m3s'), 3723);
  assert.equal(parseYouTubeTime('2h'), 7200);
  assert.equal(parseYouTubeTime(''), 0);
  assert.equal(parseYouTubeTime(undefined), 0);
  assert.equal(parseYouTubeTime('h'), 0);
  assert.equal(parseYouTubeTime('-5'), 0);
});

test('the link can sit anywhere in what the viewer typed', () => {
  assert.equal(parseYouTubeLink(`check this out https://youtu.be/${ID} so good`).videoId, ID);
  assert.equal(parseYouTubeLink(`(https://www.youtube.com/watch?v=${ID}).`).videoId, ID);
});

test('anything that is not a YouTube video is invalid', () => {
  const invalid = [
    '',
    '   ',
    undefined,
    'hello there',
    'https://www.twitch.tv/somechannel',
    `https://vimeo.com/${ID}`,
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=waytoolongvideoid123',
    'https://www.youtube.com/@somechannel',
    'https://www.youtube.com/channel/UC1234567890',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/',
    'https://youtu.be/',
    `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`,
    `https://www.youtube.com/watch/extra?v=${ID}`,
  ];
  for (const text of invalid) assert.equal(parseYouTubeLink(text), null, String(text));
  assert.equal(parseYouTubeUrl('not a url at all'), null);
});

test('youTubeWatchUrl', () => {
  assert.equal(youTubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
});
