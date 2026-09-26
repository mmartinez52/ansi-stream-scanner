// Minimal ambient declarations for the subset of Node's built-in 'stream'
// module that token-stream.ts uses. Same reasoning as node-test.d.ts: no
// @types/node dependency, so this stands in for it at compile time only.

declare module 'stream' {
  export interface TransformOptions {
    readableObjectMode?: boolean;
    writableObjectMode?: boolean;
    decodeStrings?: boolean;
  }

  export class Transform {
    constructor(opts?: TransformOptions);
    push(chunk: unknown, encoding?: string): boolean;
    write(chunk: unknown, encoding?: string, callback?: (error?: Error | null) => void): boolean;
    end(chunk?: unknown, encoding?: string, callback?: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    _transform(
      chunk: unknown,
      encoding: string,
      callback: (error?: Error | null, data?: unknown) => void
    ): void;
    _flush(callback: (error?: Error | null, data?: unknown) => void): void;
  }
}
