import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scanner } from './scanner';
import type { Token } from './scanner';

function run(chunks: string[]): Token[] {
  const tokens: Token[] = [];
  const scanner = new Scanner((token) => tokens.push(token));
  for (const chunk of chunks) {
    scanner.push(chunk);
  }
  return tokens;
}

test('plain text passes through untouched', () => {
  const tokens = run(['hello world']);
  assert.deepEqual(tokens, [{ type: 'text', value: 'hello world' }]);
});

test('newline and tab stay in text rather than becoming control tokens', () => {
  const tokens = run(['a\nb\tc']);
  assert.deepEqual(tokens, [{ type: 'text', value: 'a\nb\tc' }]);
});

test('other C0 bytes are emitted as individual control tokens', () => {
  const tokens = run(['a\x07b\x08c']);
  assert.deepEqual(tokens, [
    { type: 'text', value: 'a' },
    { type: 'control', char: '\x07' },
    { type: 'text', value: 'b' },
    { type: 'control', char: '\x08' },
    { type: 'text', value: 'c' },
  ]);
});

test('CSI sequence with multiple params completes in one chunk', () => {
  const tokens = run(['\x1b[1;31m']);
  assert.deepEqual(tokens, [
    { type: 'csi', raw: '\x1b[1;31m', params: ['1', '31'], final: 'm' },
  ]);
});

test('CSI sequence with no params reports an empty params array', () => {
  const tokens = run(['\x1b[H']);
  assert.deepEqual(tokens, [{ type: 'csi', raw: '\x1b[H', params: [], final: 'H' }]);
});

test('CSI sequence split across chunk boundaries reassembles correctly', () => {
  const tokens = run(['\x1b[', '1', ';', '3', '1', 'm']);
  assert.deepEqual(tokens, [
    { type: 'csi', raw: '\x1b[1;31m', params: ['1', '31'], final: 'm' },
  ]);
});

test('CSI final byte split from its own chunk still resolves', () => {
  const tokens = run(['\x1b[38;5;200', 'm']);
  assert.deepEqual(tokens, [
    { type: 'csi', raw: '\x1b[38;5;200m', params: ['38', '5', '200'], final: 'm' },
  ]);
});

test('two-byte escape sequence emits with its final byte', () => {
  const tokens = run(['\x1bc']);
  assert.deepEqual(tokens, [{ type: 'escape', raw: '\x1bc', final: 'c' }]);
});

test('OSC sequence terminated with BEL', () => {
  const tokens = run(['\x1b]0;title\x07']);
  assert.deepEqual(tokens, [
    { type: 'osc', raw: '\x1b]0;title\x07', payload: '0;title' },
  ]);
});

test('OSC sequence terminated with ESC backslash (ST)', () => {
  const tokens = run(['\x1b]0;title\x1b\\']);
  assert.deepEqual(tokens, [
    { type: 'osc', raw: '\x1b]0;title\x1b\\', payload: '0;title' },
  ]);
});

test('OSC split across chunks, including a split ST terminator', () => {
  const tokens = run(['\x1b]0;ti', 'tle', '\x1b', '\\']);
  assert.deepEqual(tokens, [
    { type: 'osc', raw: '\x1b]0;title\x1b\\', payload: '0;title' },
  ]);
});

test('an ESC inside OSC data that is not followed by backslash stays in the payload', () => {
  const tokens = run(['\x1b]0;a', '\x1b', 'b\x07']);
  assert.deepEqual(tokens, [
    { type: 'osc', raw: '\x1b]0;a\x1bb\x07', payload: '0;a\x1bb' },
  ]);
});

test('text surrounding a sequence in the same chunk is split into separate tokens', () => {
  const tokens = run(['before\x1b[2Jafter']);
  assert.deepEqual(tokens, [
    { type: 'text', value: 'before' },
    { type: 'csi', raw: '\x1b[2J', params: ['2'], final: 'J' },
    { type: 'text', value: 'after' },
  ]);
});

test('end() flushes an unterminated CSI sequence as text instead of dropping it', () => {
  const tokens: Token[] = [];
  const scanner = new Scanner((token) => tokens.push(token));
  scanner.push('\x1b[31');
  scanner.end();
  assert.deepEqual(tokens, [{ type: 'text', value: '\x1b[31' }]);
});

test('end() flushes an unterminated OSC sequence as text instead of dropping it', () => {
  const tokens: Token[] = [];
  const scanner = new Scanner((token) => tokens.push(token));
  scanner.push('\x1b]0;half-written title');
  scanner.end();
  assert.deepEqual(tokens, [{ type: 'text', value: '\x1b]0;half-written title' }]);
});

test('end() flushes a bare unterminated escape as text', () => {
  const tokens: Token[] = [];
  const scanner = new Scanner((token) => tokens.push(token));
  scanner.push('\x1b');
  scanner.end();
  assert.deepEqual(tokens, [{ type: 'text', value: '\x1b' }]);
});

test('scanner resets to ground state after end(), ready for more input', () => {
  const tokens: Token[] = [];
  const scanner = new Scanner((token) => tokens.push(token));
  scanner.push('\x1b[31');
  scanner.end();
  scanner.push('plain text');
  scanner.end();
  assert.deepEqual(tokens, [
    { type: 'text', value: '\x1b[31' },
    { type: 'text', value: 'plain text' },
  ]);
});
