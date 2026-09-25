import "@testing-library/jest-dom/vitest";

import { clearStack } from "@reatom/core";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Same as src/main.tsx: no default global Reatom context. Every atom/action call must
// run in a frame (render from @test/render, or context.start() in non-render tests),
// otherwise it throws "missing async stack" — exactly like in production.
clearStack();

// jsdom replaces the global DOMException with its own class, whose prototype chain ends in
// jsdom's Error from another realm, so `new DOMException(...) instanceof Error` is false —
// unlike browsers and Node. Reatom's toAbortError() creates `new DOMException(..., "AbortError")`
// and its isAbort() checks `instanceof Error`, so submit.abort() and other Reatom aborts would
// be treated as ordinary errors in tests. AbortController stays Node's in the jsdom
// environment; restore Node's DOMException (the class of its abort reason) to match.
// Caveat: DOM APIs implemented by jsdom (querySelector, etc.) still throw jsdom's own
// DOMException, so `instanceof DOMException` / `toThrow(DOMException)` is false for those
// errors — check `error.name` instead.
globalThis.DOMException = AbortSignal.abort().reason.constructor;

// Testing Library auto-cleanup needs global afterEach; vitest globals are off.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom mocks required by Mantine: https://mantine.dev/guides/vitest/
// Plain no-ops instead of vi.fn(): nothing asserts on these calls.
const noop = () => {};

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);
window.HTMLElement.prototype.scrollIntoView = noop;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
  }),
});

if (!document.fonts) {
  Object.defineProperty(document, "fonts", {
    writable: true,
    value: { addEventListener: noop, removeEventListener: noop },
  });
}

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
