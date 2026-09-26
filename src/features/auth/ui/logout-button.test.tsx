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

  it("keeps its accessible name while the tooltip is shown on hover", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);
    const button = screen.getByRole("button", { name: "Выйти" });

    await user.hover(button);

    expect(await screen.findByText("Выйти")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBe(button);
  });
});
