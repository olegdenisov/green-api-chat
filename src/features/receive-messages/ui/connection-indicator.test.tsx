import { context } from "@reatom/core";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { creds, fetchMock, stubFetch } from "@test/green-api";
import { render } from "@test/render";

import { type ReceiveStatus, receiveStatusAtom } from "../model/status";
import { ConnectionIndicator } from "./connection-indicator";

const indicator = () => screen.queryByRole("status");

describe("ConnectionIndicator", () => {
  it("is hidden by default (idle)", () => {
    render(<ConnectionIndicator />);

    expect(indicator()).toBeNull();
  });

  it.each<ReceiveStatus>(["follower", "polling"])("is hidden in %s", (status) => {
    const { frame } = render(<ConnectionIndicator />);
    frame.run(() => receiveStatusAtom.set(status));

    expect(indicator()).toBeNull();
  });

  it("is shown while reconnecting and hides after recovery", async () => {
    const { frame } = render(<ConnectionIndicator />);

    frame.run(() => receiveStatusAtom.set("reconnecting"));
    expect(await screen.findByRole("status")).toHaveTextContent("Соединение…");

    frame.run(() => receiveStatusAtom.set("polling"));
    await waitFor(() => expect(indicator()).toBeNull());
  });

  it("does not start the polling (ReceiveMessages owns it)", async () => {
    stubFetch();
    context.start(() => credentialsAtom.set(creds));
    render(<ConnectionIndicator />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(indicator()).toBeNull();
  });
});
