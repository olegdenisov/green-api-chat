import { context } from "@reatom/core";
import { describe, expect, it, vi } from "vitest";

import { creds } from "@test/green-api";

import { credentialsAtom, logout } from "./session";

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
    warn.mockRestore();
  });
});
