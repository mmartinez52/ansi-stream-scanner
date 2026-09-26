import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenStream } from './token-stream';
import type { Token } from './scanner';

function collect(stream: TokenStream): Promise<Token[]> {
  return new Promise((resolve) => {
    const tokens: Token[] = [];
    stream.on('data', (token: Token) => tokens.push(token));
    stream.on('end', () => resolve(tokens));
  });
}

test('plain text written to the stream comes out as a text token', async () => {
  const stream = new TokenStream();
  const done = collect(stream);
  stream.end('hello world');
  assert.deepEqual(await done, [{ type: 'text', value: 'hello world' }]);
});

test('an escape sequence split across separate writes reassembles into one token', async () => {
  const stream = new TokenStream();
  const done = collect(stream);
  stream.write('\x1b[1;3');
  stream.end('1m');
  assert.deepEqual(await done, [
    { type: 'csi', raw: '\x1b[1;31m', params: ['1', '31'], final: 'm' },
  ]);
});

test('multiple tokens from a single write are all emitted in order', async () => {
  const stream = new TokenStream();
  const done = collect(stream);
  stream.end('before\x1b[2Jafter');
  assert.deepEqual(await done, [
    { type: 'text', value: 'before' },
    { type: 'csi', raw: '\x1b[2J', params: ['2'], final: 'J' },
    { type: 'text', value: 'after' },
  ]);
});

test('an unterminated sequence left open when the stream ends is flushed as text', async () => {
  const stream = new TokenStream();
  const done = collect(stream);
  stream.end('\x1b[31');
  assert.deepEqual(await done, [{ type: 'text', value: '\x1b[31' }]);
});
