import { notifications } from "@mantine/notifications";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { credentialsAtom } from "@/entities/session";

import { getSettingsResponse } from "@test/fixtures/green-api/get-settings";
import { getStateInstanceResponse } from "@test/fixtures/green-api/get-state-instance";
import { setSettingsResponse } from "@test/fixtures/green-api/set-settings";
import {
  calledMethods,
  creds,
  fetchMock,
  hangUntilAbort,
  respondByMethod,
  stubFetch,
} from "@test/green-api";
import { render } from "@test/render";

import { LoginForm } from "./login-form";

const ok = {
  getStateInstance: { body: getStateInstanceResponse },
  getSettings: { body: getSettingsResponse },
};

const idInput = () => screen.getByLabelText("idInstance");
const tokenInput = () => screen.getByLabelText("apiTokenInstance");
const apiUrlInput = () => screen.getByLabelText("apiUrl");
const submitButton = () => screen.getByRole("button", { name: "Войти" });

beforeEach(stubFetch);
// The toast store is module-wide in @mantine/notifications: drop toasts between tests.
afterEach(() => notifications.clean());

async function fillCreds(user: ReturnType<typeof userEvent.setup>) {
  await user.type(idInput(), creds.idInstance);
  await user.type(tokenInput(), creds.apiTokenInstance);
}

describe("LoginForm", () => {
  it("logs in on Enter and saves the credentials", async () => {
    respondByMethod(ok);
    const user = userEvent.setup();
    const { frame } = render(<LoginForm />);

    await fillCreds(user);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(frame.run(() => credentialsAtom())).toEqual(creds));
    expect(calledMethods()).toEqual(["getStateInstance", "getSettings"]);
  });

  it("logs in with the submit button and a manual apiUrl", async () => {
    respondByMethod(ok);
    const user = userEvent.setup();
    const { frame } = render(<LoginForm />);

    await fillCreds(user);
    await user.type(apiUrlInput(), "https://api.example.com/");
    await user.click(submitButton());

    await waitFor(() =>
      expect(frame.run(() => credentialsAtom())).toEqual({
        ...creds,
        apiUrl: "https://api.example.com",
      }),
    );
  });

  it("shows the derived apiUrl as the placeholder", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    expect(apiUrlInput()).toHaveAttribute("placeholder", "https://XXXX.api.green-api.com");
    await user.type(idInput(), "7103");
    expect(apiUrlInput()).toHaveAttribute("placeholder", "https://7103.api.green-api.com");
  });

  it("shows field errors and no alert on an empty submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(submitButton());

    expect(await screen.findByText("Введите idInstance (только цифры)")).toBeInTheDocument();
    expect(screen.getByText("Введите apiTokenInstance")).toBeInTheDocument();
    // The invalid idInstance has its own error; apiUrl does not repeat it.
    expect(screen.queryByText("Укажите apiUrl из консоли GREEN-API")).not.toBeInTheDocument();
    expect(idInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show an alert after fixing a field following a failed validation", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // The only invalid field: once it is fixed, no field has an error left.
    await user.type(idInput(), creds.idInstance);
    await user.click(submitButton());
    await screen.findByText("Введите apiTokenInstance");
    await user.type(tokenInput(), "token");

    expect(screen.queryByText("Введите apiTokenInstance")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error text in an alert on 401", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    const user = userEvent.setup();
    const { frame } = render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный idInstance или apiTokenInstance",
    );
    expect(frame.run(() => credentialsAtom())).toBeNull();
  });

  it("hides the alert on edit and does not show it for a failed validation", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());
    await screen.findByRole("alert");

    await user.clear(idInput());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(submitButton());
    expect(await screen.findByText("Введите idInstance (только цифры)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the instance state in an alert", async () => {
    respondByMethod({ getStateInstance: { body: { stateInstance: "notAuthorized" } } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Инстанс не авторизован в Telegram");
  });

  it("shows a generic alert for an unexpected error", async () => {
    respondByMethod(ok);
    vi.spyOn(credentialsAtom, "set").mockImplementation(() => {
      throw new TypeError("boom");
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось войти");
  });

  it("hides the old alert while a retry is pending", async () => {
    respondByMethod({ getStateInstance: { body: {}, status: 401 } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());
    await screen.findByRole("alert");

    hangUntilAbort();
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toHaveAttribute("data-loading", "true"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the loader and disables the fields while the request is pending", async () => {
    hangUntilAbort();
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toHaveAttribute("data-loading", "true"));
    expect(submitButton()).toBeDisabled();
    expect(idInput()).toBeDisabled();
    expect(tokenInput()).toBeDisabled();
    expect(apiUrlInput()).toBeDisabled();
  });

  it("makes the form usable again after a failed request", async () => {
    let answer: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());
    await waitFor(() => expect(idInput()).toBeDisabled());

    answer(new Response("{}", { status: 401 }));

    await screen.findByRole("alert");
    expect(submitButton()).not.toHaveAttribute("data-loading");
    expect(submitButton()).toBeEnabled();
    expect(idInput()).toBeEnabled();
    expect(tokenInput()).toBeEnabled();
    expect(apiUrlInput()).toBeEnabled();
  });

  it("shows a toast after turning on the notification settings", async () => {
    respondByMethod({
      ...ok,
      getSettings: { body: { ...getSettingsResponse, incomingWebhook: "no" } },
      setSettings: { body: setSettingsResponse },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCreds(user);
    await user.click(submitButton());

    expect(
      await screen.findByText(
        "Настройки инстанса обновлены. Входящие сообщения начнут приходить в течение ~5 минут",
      ),
    ).toBeInTheDocument();
    expect(calledMethods()).toEqual(["getStateInstance", "getSettings", "setSettings"]);
  });
});
