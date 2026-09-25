import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { creds } from "@test/green-api";
import { render } from "@test/render";

import { LogoutButton } from "./logout-button";

describe("LogoutButton", () => {
  it("clears the credentials on click", async () => {
    const user = userEvent.setup();
    const { frame } = render(<LogoutButton />);
    frame.run(() => credentialsAtom.set(creds));

    await user.click(screen.getByRole("button", { name: "Выйти" }));

    expect(frame.run(() => credentialsAtom())).toBeNull();
  });
});
