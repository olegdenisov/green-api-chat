import { context, sleep, wrap } from "@reatom/core";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { BASE, creds, fetchMock, respondJson, stubFetch, TOKEN } from "@test/green-api";

import { credentialsAtom, greenApiAtom, logout, requireApi } from "./session";

const DAY = 24 * 60 * 60 * 1000;

describe("session", () => {
  it("has no credentials by default", () => {
    context.start(() => {
      expect(credentialsAtom()).toBeNull();
    });
  });

  it("persists credentials across frames", () => {
    context.start(() => {
      credentialsAtom.set(creds);
    });
    expect(localStorage.getItem("ga.credentials")).toContain(creds.apiTokenInstance);

    context.start(() => {
      expect(credentialsAtom()).toEqual(creds);
    });
  });

  it("keeps credentials for more than a year", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    context.start(() => {
      credentialsAtom.set(creds);
    });
    vi.setSystemTime(Date.now() + 400 * DAY);

    context.start(() => {
      expect(credentialsAtom()).toEqual(creds);
    });
  });

  it("logout clears credentials, also for a new frame", () => {
    context.start(() => {
      credentialsAtom.set(creds);
      logout();
      expect(credentialsAtom()).toBeNull();
    });

    context.start(() => {
      expect(credentialsAtom()).toBeNull();
    });
    expect(localStorage.getItem("ga.credentials")).not.toContain(creds.apiTokenInstance);
  });

  it("falls back to null on a corrupted storage value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem("ga.credentials", "{not json");

    context.start(() => {
      expect(credentialsAtom()).toBeNull();
    });
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to null on incomplete stored credentials", () => {
    // Write a valid record with the wrong shape through the atom itself (no manual PersistRecord).
    context.start(() => {
      credentialsAtom.set({ ...creds, apiTokenInstance: "" });
    });

    context.start(() => {
      expect(credentialsAtom()).toBeNull();
    });
  });

  it("follows a logout made in another tab", async () => {
    await context.start(async () => {
      credentialsAtom.set(creds);
      const loggedIn = localStorage.getItem("ga.credentials");
      // The storage subscription lives while the atom is connected; connection is async.
      onTestFinished(credentialsAtom.subscribe(() => {}));
      await wrap(sleep(0));

      // Another tab logs out: it rewrites the key and the browser fires `storage` here.
      context.start(() => logout());
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "ga.credentials",
          oldValue: loggedIn,
          newValue: localStorage.getItem("ga.credentials"),
          storageArea: localStorage,
        }),
      );

      expect(credentialsAtom()).toBeNull();
    });
  });

  describe("greenApiAtom", () => {
    beforeEach(stubFetch);

    it("is null without credentials", () => {
      context.start(() => {
        expect(greenApiAtom()).toBeNull();
      });
    });

    it("gives a client bound to the credentials", async () => {
      respondJson({ stateInstance: "authorized" });

      await context.start(async () => {
        credentialsAtom.set(creds);
        const api = greenApiAtom();
        expect(api).not.toBeNull();

        await wrap(api!.getStateInstance());
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(String(fetchMock.mock.calls[0]![0])).toBe(`${BASE}/getStateInstance/${TOKEN}`);
    });

    it("is null after logout", () => {
      context.start(() => {
        credentialsAtom.set(creds);
        expect(greenApiAtom()).not.toBeNull();
        logout();
        expect(greenApiAtom()).toBeNull();
      });
    });

    it("creates a new client for new credentials", () => {
      context.start(() => {
        credentialsAtom.set(creds);
        const first = greenApiAtom();
        expect(greenApiAtom()).toBe(first);

        credentialsAtom.set({ ...creds, idInstance: "1101000002" });
        const second = greenApiAtom();
        expect(second).not.toBeNull();
        expect(second).not.toBe(first);
      });
    });
  });

  describe("requireApi", () => {
    it("returns the current client", () => {
      context.start(() => {
        credentialsAtom.set(creds);
        expect(requireApi()).toBe(greenApiAtom());
      });
    });

    it("throws when logged out", () => {
      context.start(() => {
        expect(() => requireApi()).toThrow("No GREEN-API client");
      });
    });
  });
});
