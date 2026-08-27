import assert from 'node:assert/strict';
import test from 'node:test';
import { blockPositionStyle, resolveFontStack, rgba, settingsToCssVars } from './tokens.ts';
import { createDefaultChatOverlaySettings } from '../lib/chatOverlay.ts';

const base = () => createDefaultChatOverlaySettings();

test('converts hex colours to rgba with the supplied alpha', () => {
  assert.equal(rgba('#ff0000', 100), 'rgba(255, 0, 0, 1)');
  assert.equal(rgba('#ff0000', 0), 'rgba(255, 0, 0, 0)');
  assert.equal(rgba('#f00', 50), 'rgba(255, 0, 0, 0.5)');
});

test('the alpha argument overrides any alpha carried by the hex value', () => {
  assert.equal(rgba('#ff000000', 100), 'rgba(255, 0, 0, 1)');
});

test('an unparseable colour becomes transparent rather than invalid CSS', () => {
  assert.equal(rgba('not-a-colour', 100), 'transparent');
});

test('resolves built-in font stacks and quotes a custom family', () => {
  assert.match(resolveFontStack({ family: 'barlow', customName: '' }), /^"Barlow"/);
  assert.match(resolveFontStack({ family: 'custom', customName: 'Inter' }), /^"Inter",/);
});

test('a custom font with no name falls back instead of emitting empty quotes', () => {
  const stack = resolveFontStack({ family: 'custom', customName: '' });
  assert.equal(stack.includes('""'), false);
  assert.match(stack, /system-ui/);
});

test('an unknown family falls back to the system stack', () => {
  assert.match(resolveFontStack({ family: 'nonsense', customName: '' }), /system-ui/);
});

// --- sizeScale, the sharpness fix -----------------------------------------

test('sizeScale multiplies pixel tokens instead of transform-scaling', () => {
  const settings = base();
  settings.text.size = 24;
  settings.avatar.size = 32;
  settings.flow.gap = 12;

  const at100 = settingsToCssVars(settings);
  settings.flow.sizeScale = 200;
  const at200 = settingsToCssVars(settings);

  assert.equal(at100['--co-text-size'], '24px');
  assert.equal(at200['--co-text-size'], '48px');
  assert.equal(at200['--co-avatar-size'], '64px');
  assert.equal(at200['--co-gap'], '24px');

  // Nothing in the token set may introduce a transform.
  for (const value of Object.values(at200)) {
    assert.equal(String(value).includes('scale('), false);
  }
});

test('the block rect is placement, so it is not affected by sizeScale', () => {
  const settings = base();
  settings.flow.sizeScale = 200;
  const style = blockPositionStyle(settings);
  assert.equal(style.left, `${settings.block.x}px`);
  assert.equal(style.width, `${settings.block.width}px`);
  assert.equal(style.position, 'absolute');
});

// --- colour modes ----------------------------------------------------------

test('role colour modes defer to the per-message role variable', () => {
  const settings = base();
  settings.bubble.accent.colorMode = 'role';
  settings.avatar.borderColorMode = 'role';
  settings.username.colorMode = 'role';

  const vars = settingsToCssVars(settings);
  assert.equal(vars['--co-accent-color'], 'var(--co-role-color)');
  assert.equal(vars['--co-avatar-border-color'], 'var(--co-role-color)');
  assert.equal(vars['--co-username-color'], 'var(--co-role-color)');
});

test('custom colour modes emit the literal colour', () => {
  const settings = base();
  settings.bubble.accent.colorMode = 'custom';
  settings.bubble.accent.color = '#123456';
  settings.username.colorMode = 'custom';
  settings.username.color = '#abcdef';

  const vars = settingsToCssVars(settings);
  assert.equal(vars['--co-accent-color'], '#123456');
  assert.equal(vars['--co-username-color'], '#abcdef');
});

test('twitch username colour falls back to the role variable at the token level', () => {
  const settings = base();
  settings.username.colorMode = 'twitch';
  // The per-message colour is applied on the element, not here.
  assert.equal(settingsToCssVars(settings)['--co-username-color'], 'var(--co-role-color)');
});

// --- switching things off --------------------------------------------------

test('zero blur emits none so the filter is genuinely disabled', () => {
  const settings = base();
  settings.bubble.blur = 0;
  assert.equal(settingsToCssVars(settings)['--co-bubble-blur'], 'none');

  settings.bubble.blur = 8;
  assert.equal(settingsToCssVars(settings)['--co-bubble-blur'], 'blur(8px)');
});

test('shadow off emits none', () => {
  const settings = base();
  settings.bubble.shadow = 'off';
  assert.equal(settingsToCssVars(settings)['--co-bubble-shadow'], 'none');
});

test('the Bare look removes all chrome through tokens alone', () => {
  const settings = base();
  settings.bubble.background.alpha = 0;
  settings.bubble.border.width = 0;
  settings.bubble.shadow = 'off';
  settings.bubble.blur = 0;
  settings.bubble.accent.width = 0;

  const vars = settingsToCssVars(settings);
  assert.match(String(vars['--co-bubble-bg']), /, 0\)$/);
  assert.equal(vars['--co-bubble-border-width'], '0px');
  assert.equal(vars['--co-bubble-shadow'], 'none');
  assert.equal(vars['--co-bubble-blur'], 'none');
  assert.equal(vars['--co-accent-width'], '0px');
});

test('a max text width of zero fills the block', () => {
  const settings = base();
  settings.text.maxWidth = 0;
  assert.equal(settingsToCssVars(settings)['--co-text-max-width'], '100%');

  settings.text.maxWidth = 500;
  assert.equal(settingsToCssVars(settings)['--co-text-max-width'], '500px');
});

test('emote size is derived from text size and the emote scale', () => {
  const settings = base();
  settings.text.size = 20;
  settings.emotes.sizeScale = 150;
  settings.flow.sizeScale = 100;
  assert.equal(settingsToCssVars(settings)['--co-emote-size'], '30px');
});
