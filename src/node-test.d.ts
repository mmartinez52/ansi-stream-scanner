// Minimal ambient declarations for the subset of Node's built-in test runner
// and assert module this package's tests use. There is no @types/node
// dependency here on purpose (this library has zero third-party deps), so
// these stand in for it rather than pulling in a types package just for
// test-time type checking. Node provides the real implementations at
// runtime; these types are erased at compile time either way.

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}
