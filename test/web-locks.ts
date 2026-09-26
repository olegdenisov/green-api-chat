import { onTestFinished } from "vitest";

type Request = {
  callback: LockGrantedCallback<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

/**
 * Installs a minimal exclusive `navigator.locks` (jsdom has none) for the current test and
 * removes it when the test finishes. Requests for one name are granted in order; the callback
 * is called asynchronously (a microtask), as in browsers; a `signal` aborted before the grant
 * removes the request and rejects it with `signal.reason`. Returns `held(name)` — whether the
 * lock is currently held — and `waiting(name)` — the number of queued requests.
 */
export function stubWebLocks() {
  const held = new Set<string>();
  const queues = new Map<string, Request[]>();

  function grantNext(name: string) {
    if (held.has(name)) return;
    const next = queues.get(name)?.shift();
    if (!next) return;
    held.add(name);
    queueMicrotask(() => {
      Promise.resolve()
        .then(() => next.callback({ name, mode: "exclusive" }))
        .then(next.resolve, next.reject)
        .finally(() => {
          held.delete(name);
          grantNext(name);
        });
    });
  }

  const locks = {
    request(
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>,
    ): Promise<unknown> {
      const { signal } = options;
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise((resolve, reject) => {
        const request: Request = { callback, resolve, reject };
        const queue = queues.get(name) ?? [];
        queues.set(name, queue);
        queue.push(request);
        signal?.addEventListener(
          "abort",
          () => {
            const index = queue.indexOf(request);
            if (index === -1) return; // Already granted: the signal no longer applies.
            queue.splice(index, 1);
            reject(signal.reason);
          },
          { once: true },
        );
        grantNext(name);
      });
    },
  };

  Object.defineProperty(navigator, "locks", { configurable: true, value: locks });
  onTestFinished(() => {
    delete (navigator as { locks?: unknown }).locks;
  });

  return {
    held: (name: string) => held.has(name),
    waiting: (name: string) => queues.get(name)?.length ?? 0,
  };
}
