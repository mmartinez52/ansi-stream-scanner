// Node Transform-stream wrapper around Scanner, for callers who'd rather
// pipe a stream than drive push()/end() themselves. Readable side is object
// mode (one Token per readable chunk); writable side takes raw text/bytes.

import { Transform, TransformOptions } from 'stream';
import { Scanner, Token } from './scanner';

interface BufferLike {
  toString(encoding: string): string;
}

export class TokenStream extends Transform {
  private readonly scanner: Scanner;

  constructor(opts: TransformOptions = {}) {
    // decodeStrings: false keeps string writes as strings instead of Node
    // re-encoding them to a Buffer before _transform sees them; Scanner
    // wants strings either way, and this avoids a redundant decode step
    // when the source is already text.
    super({ ...opts, readableObjectMode: true, writableObjectMode: false, decodeStrings: false });
    this.scanner = new Scanner((token: Token) => this.push(token));
  }

  _transform(
    chunk: string | BufferLike,
    encoding: string,
    callback: (error?: Error | null) => void
  ): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString(encoding === 'buffer' ? 'utf8' : encoding);
    this.scanner.push(text);
    callback();
  }

  _flush(callback: (error?: Error | null) => void): void {
    this.scanner.end();
    callback();
  }
}
