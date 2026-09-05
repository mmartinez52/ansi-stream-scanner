// Builders for the escape sequences a terminal application actually needs to
// send. Kept separate from scanner.ts because generating and parsing have
// different shapes of API, even though they cover the same wire format.

const ESC = '\x1b';
const CSI = `${ESC}[`;

export function cursorTo(row: number, col: number): string {
  return `${CSI}${row};${col}H`;
}

export function cursorUp(n = 1): string {
  return `${CSI}${n}A`;
}

export function cursorDown(n = 1): string {
  return `${CSI}${n}B`;
}

export function cursorForward(n = 1): string {
  return `${CSI}${n}C`;
}

export function cursorBack(n = 1): string {
  return `${CSI}${n}D`;
}

export function eraseScreen(): string {
  return `${CSI}2J`;
}

export function eraseLine(): string {
  return `${CSI}2K`;
}

export const sgr = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,
} as const;

export function fg256(code: number): string {
  return `${CSI}38;5;${code}m`;
}

export function bg256(code: number): string {
  return `${CSI}48;5;${code}m`;
}
