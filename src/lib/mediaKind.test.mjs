import test from 'node:test';
import assert from 'node:assert/strict';
import { isVideoFile } from './mediaKind.ts';

test('mp4, webm and mov are videos, in paths, URLs and overlay media links', () => {
  assert.equal(isVideoFile('C:\\stream\\meme.mp4'), true);
  assert.equal(isVideoFile('C:\\stream\\Alert.WEBM'), true);
  assert.equal(isVideoFile('D:/clips/intro.mov'), true);
  assert.equal(isVideoFile('https://cdn.example.com/a.mp4?token=1'), true);
  assert.equal(isVideoFile(`http://127.0.0.1:49178/media?path=${encodeURIComponent('C:\\stream\\meme.mp4')}`), true);
});

test('pictures, GIFs and lookalikes are not videos', () => {
  assert.equal(isVideoFile('C:\\stream\\meme.gif'), false);
  assert.equal(isVideoFile('C:\\stream\\photo.png'), false);
  assert.equal(isVideoFile('C:\\stream\\notes.mp4.txt'), false);
  assert.equal(isVideoFile(`http://127.0.0.1:49178/media?path=${encodeURIComponent('C:\\a.webp')}`), false);
  assert.equal(isVideoFile(''), false);
  assert.equal(isVideoFile(undefined), false);
  assert.equal(isVideoFile('%E0%A4%A'), false);
});
