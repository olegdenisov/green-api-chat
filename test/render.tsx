import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { context, type RootFrame } from "@reatom/core";
import { reatomContext } from "@reatom/react";
import {
  cleanup,
  render as testingLibraryRender,
  type RenderOptions,
} from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach } from "vitest";

// Providers are assembled here, not imported from @/app/providers, so tests
// control test-only options (env="test" disables transitions and portals).
// Mirrors production: StrictMode + Reatom frame + MantineProvider with Notifications.
//
// Reatom isolation: every render gets a fresh root frame from context.start(), so
// atom state never leaks between tests. vitest.setup.ts calls clearStack(), so any
// Reatom call outside this frame (or without wrap()) throws, as in production.
const frames = new Set<RootFrame>();

export function render(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  const frame = context.start();
  frames.add(frame);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <reatomContext.Provider value={frame}>
          <MantineProvider env="test">
            <Notifications />
            {children}
          </MantineProvider>
        </reatomContext.Provider>
      </StrictMode>
    );
  }

  return { frame, ...testingLibraryRender(ui, { wrapper: Providers, ...options }) };
}

// Unmounts rendered trees, then resets every frame created by render():
// context.reset() drops the frame's state and makes wrap()-ed callbacks and promises
// of that frame throw an AbortError ("context reset"), so timers/polling cannot leak
// into the next test. Runs automatically after each test in files that import render.
export function teardownRender() {
  cleanup();
  for (const frame of frames) frame.run(() => context.reset());
  frames.clear();
}

afterEach(teardownRender);
