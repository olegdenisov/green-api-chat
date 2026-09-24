import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library auto-cleanup needs global afterEach; vitest globals are off.
afterEach(() => {
  cleanup();
});

// jsdom mocks required by Mantine: https://mantine.dev/guides/vitest/
// Plain no-ops instead of vi.fn(): nothing asserts on these calls.
const noop = () => {};

const { getComputedStyle } = window;
window.getComputedStyle = (elt) => getComputedStyle(elt);
window.HTMLElement.prototype.scrollIntoView = () => {};

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
