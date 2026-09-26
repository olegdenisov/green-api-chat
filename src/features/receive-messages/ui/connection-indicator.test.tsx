import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@test/render";

import { type ReceiveStatus, setReceiveStatus } from "../model/receive-status";
import { ConnectionIndicator } from "./connection-indicator";

const indicator = () => screen.queryByRole("status");

describe("ConnectionIndicator", () => {
  it("is hidden by default (idle)", () => {
    render(<ConnectionIndicator />);

    expect(indicator()).toBeNull();
  });

  it.each<ReceiveStatus>(["follower", "polling"])("is hidden in %s", (status) => {
    const { frame } = render(<ConnectionIndicator />);
    frame.run(() => setReceiveStatus(status));

    expect(indicator()).toBeNull();
  });

  it("is shown while reconnecting and hides after recovery", async () => {
    const { frame } = render(<ConnectionIndicator />);

    frame.run(() => setReceiveStatus("reconnecting"));
    expect(await screen.findByRole("status")).toHaveTextContent("Соединение…");

    frame.run(() => setReceiveStatus("polling"));
    await waitFor(() => expect(indicator()).toBeNull());
  });
});
