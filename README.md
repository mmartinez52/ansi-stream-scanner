# ansi-stream-scanner

A dependency-free TypeScript library for parsing and generating ANSI/VT100
terminal escape sequences.

## The problem

Terminal output is not clean text. A shell, a pty, or `docker logs -f` mixes
plain characters with control codes inline: cursor moves, colors, window
title changes, screen clears. If you want to do anything with that
output programmatically — strip color codes for a log file, extract a
progress bar's position, re-render it in a web terminal — you have to
parse those escape sequences back out.

The catch is that this output is usually a live stream, not a complete
string. A `child_process.spawn(...).stdout`, a websocket relaying a pty, or
`tail -f` never hands you the whole thing at once, and some of these
processes run indefinitely. A parser that waits for the stream to end, or
that concatenates every chunk into one buffer before parsing, will either
never produce output or will grow without bound. It also has to cope with a
single escape sequence being split across two chunks, which happens
whenever the writer's buffer flushes mid-sequence.

`Scanner` here is a small state machine that consumes one chunk at a time
and emits tokens as soon as they're complete. It holds onto nothing but the
current chunk's plain-text run and, at most, one in-progress escape
sequence — never the history of the stream.

## Usage

```ts
import { Scanner, Token } from 'ansi-stream-scanner';
import { spawn } from 'child_process';

const child = spawn('some-long-running-tool');

const scanner = new Scanner((token: Token) => {
  switch (token.type) {
    case 'text':
      process.stdout.write(token.value);
      break;
    case 'csi':
      if (token.final === 'H') {
        console.error('cursor moved to', token.params.join(','));
      }
      break;
    case 'osc':
      console.error('OSC payload:', token.payload);
      break;
  }
});

child.stdout.on('data', (chunk: Buffer) => {
  scanner.push(chunk.toString('utf8'));
});

child.stdout.on('end', () => {
  scanner.end();
});
```

Memory use here stays flat regardless of how long `some-long-running-tool`
runs, because `scanner.push()` only ever holds the bytes for the chunk it
was just given plus, at most, one unterminated escape sequence waiting for
its final byte.

If you'd rather pipe a stream than call `push`/`end` yourself, `TokenStream`
wraps a `Scanner` in a Node `Transform`. It's a plain object-mode readable on
the output side — one `Token` per readable chunk — so it composes with
whatever else you already do with streams:

```ts
import { TokenStream, Token } from 'ansi-stream-scanner';

child.stdout
  .pipe(new TokenStream())
  .on('data', (token: Token) => {
    if (token.type === 'osc') console.error('OSC payload:', token.payload);
  });
```

Building sequences to send works the same way, without any parsing at all:

```ts
import { sequences } from 'ansi-stream-scanner';

process.stdout.write(sequences.eraseScreen());
process.stdout.write(sequences.cursorTo(1, 1));
process.stdout.write(sequences.sgr.bold + 'hello' + sequences.sgr.reset + '\n');
```

## Status

Early. The scanner currently covers CSI (`ESC [ ... final`), the three
ECMA-48 control strings — OSC (`ESC ] ...`), DCS (`ESC P ...`), and APC
(`ESC _ ...`), each terminated by ST (`ESC \`), with OSC additionally
accepting a bare BEL per the common xterm convention — two-byte escapes,
and C0 control characters, plus a `TokenStream` Transform-stream wrapper for
Node pipelines. See the issue tracker for what's planned next.

## License

MIT
