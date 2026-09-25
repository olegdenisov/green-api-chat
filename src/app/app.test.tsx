import { notifications } from "@mantine/notifications";
import { context } from "@reatom/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { creds, respondByMethod, stubFetch } from "@test/green-api";

import { App } from "./app";

const chatStub = () => screen.queryByText("Чаты появятся здесь");
const idInput = () => screen.getByLabelText("idInstance");

beforeEach(stubFetch);
afterEach(() => notifications.clean());

// App owns its providers (its own Reatom frame), so it uses plain RTL render.
describe("App", () => {
  it("shows the login form without credentials", () => {
    render(<App />);

    expect(idInput()).toBeInTheDocument();
    expect(chatStub()).not.toBeInTheDocument();
  });

  it("shows the chat when credentials were saved before", () => {
    // Another frame persists the credentials to localStorage, as a previous page load would.
    context.start(() => credentialsAtom.set(creds));

    render(<App />);

    expect(chatStub()).toBeInTheDocument();
    expect(screen.queryByLabelText("idInstance")).not.toBeInTheDocument();
  });

  it("opens the chat after login and returns to an empty form after logout", async () => {
    respondByMethod({
      getStateInstance: { body: getStateInstanceResponse },
      getSettings: { body: getSettingsResponse },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(idInput(), creds.idInstance);
    await user.type(screen.getByLabelText("apiTokenInstance"), creds.apiTokenInstance);
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Чаты появятся здесь")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Выйти" }));

    expect(idInput()).toHaveValue("");
    expect(screen.getByLabelText("apiTokenInstance")).toHaveValue("");
    expect(screen.getByLabelText("apiUrl")).toHaveValue("");
    expect(chatStub()).not.toBeInTheDocument();
    // A reload (a fresh frame reading localStorage) stays logged out.
    context.start(() => expect(credentialsAtom()).toBeNull());
  });
});
