import "@testing-library/jest-dom/vitest";
import { clearStack } from "@reatom/core";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Same as src/main.tsx: no default global Reatom context. Every atom/action call must
// run in a frame (render from @test/render, or context.start() in non-render tests),
// otherwise it throws "missing async stack" — exactly like in production.
clearStack();

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
