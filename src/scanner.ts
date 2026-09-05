// Incrementally splits a stream of terminal output into plain text and escape
// sequence tokens. Designed for input that arrives in arbitrary-sized chunks
// (a socket, a pty, a child process's stdout) and that may never close, so it
// must never accumulate more than the current chunk plus a possibly
// in-progress escape sequence.

export type Token =
  | { type: 'text'; value: string }
  | { type: 'control'; char: string }
  | { type: 'escape'; raw: string; final: string }
  | { type: 'csi'; raw: string; params: string[]; final: string }
  | { type: 'osc'; raw: string; payload: string };

type State = 'ground' | 'escape' | 'csi' | 'osc' | 'osc-esc';

const ESC = '\x1b';
const BEL = '\x07';

export class Scanner {
  private state: State = 'ground';
  private textBuffer = '';
  private seqBuffer = '';

  constructor(private readonly emit: (token: Token) => void) {}

  // Feed the next chunk of a stream. Safe to call repeatedly as data arrives;
  // never buffers previously emitted chunks.
  push(chunk: string): void {
    for (const ch of chunk) {
      this.step(ch);
    }
    this.flushText();
  }

  // Call once the underlying stream has ended. Anything left in an
  // unterminated escape sequence is surfaced as text rather than dropped
  // silently, since a truncated stream is still real data.
  end(): void {
    this.flushText();
    if (this.seqBuffer.length > 0) {
      this.emit({ type: 'text', value: this.seqBuffer });
      this.seqBuffer = '';
    }
    this.state = 'ground';
  }

  private flushText(): void {
    if (this.textBuffer.length > 0) {
      this.emit({ type: 'text', value: this.textBuffer });
      this.textBuffer = '';
    }
  }

  private step(ch: string): void {
    switch (this.state) {
      case 'ground':
        this.stepGround(ch);
        break;
      case 'escape':
        this.stepEscape(ch);
        break;
      case 'csi':
        this.stepCsi(ch);
        break;
      case 'osc':
        this.stepOsc(ch);
        break;
      case 'osc-esc':
        this.stepOscEsc(ch);
        break;
    }
  }

  private stepGround(ch: string): void {
    if (ch === ESC) {
      this.flushText();
      this.seqBuffer = ESC;
      this.state = 'escape';
      return;
    }
    // Other C0 control bytes (backspace, bell, carriage return, ...) are
    // handed to the caller individually rather than folded into text, since
    // they usually need distinct handling (cursor movement, alerts).
    if (ch < ' ' && ch !== '\n' && ch !== '\t') {
      this.flushText();
      this.emit({ type: 'control', char: ch });
      return;
    }
    this.textBuffer += ch;
  }

  private stepEscape(ch: string): void {
    this.seqBuffer += ch;
    if (ch === '[') {
      this.state = 'csi';
      return;
    }
    if (ch === ']') {
      this.state = 'osc';
      return;
    }
    // Anything else is a two-byte escape sequence (ESC + final byte), such
    // as ESC c (reset) or ESC 7 (save cursor).
    this.emit({ type: 'escape', raw: this.seqBuffer, final: ch });
    this.seqBuffer = '';
    this.state = 'ground';
  }

  private stepCsi(ch: string): void {
    this.seqBuffer += ch;
    const code = ch.charCodeAt(0);
    // CSI sequences end at the first byte in the 0x40-0x7e range; everything
    // before that is parameter or intermediate bytes.
    if (code >= 0x40 && code <= 0x7e) {
      const body = this.seqBuffer.slice(2, -1);
      const params = body.length > 0 ? body.split(';') : [];
      this.emit({ type: 'csi', raw: this.seqBuffer, params, final: ch });
      this.seqBuffer = '';
      this.state = 'ground';
    }
  }

  private stepOsc(ch: string): void {
    this.seqBuffer += ch;
    if (ch === BEL) {
      this.emitOsc(this.seqBuffer);
      return;
    }
    if (ch === ESC) {
      this.state = 'osc-esc';
    }
  }

  private stepOscEsc(ch: string): void {
    this.seqBuffer += ch;
    if (ch === '\\') {
      this.emitOsc(this.seqBuffer);
      return;
    }
    // Not a valid string terminator (ESC \); the ESC we saw belongs to plain
    // OSC data, keep accumulating.
    this.state = 'osc';
  }

  private emitOsc(raw: string): void {
    const terminatorLength = raw.endsWith(BEL) ? 1 : 2;
    const payload = raw.slice(2, raw.length - terminatorLength);
    this.emit({ type: 'osc', raw, payload });
    this.seqBuffer = '';
    this.state = 'ground';
  }
}
