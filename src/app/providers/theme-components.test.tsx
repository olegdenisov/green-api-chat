import { ActionIcon, MantineProvider, Textarea, TextInput } from "@mantine/core";
import { render } from "@test/render";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { FOCUS_CLASS_NAME, theme } from "./theme";

// `render` from @test/render uses Mantine's default theme: the app theme is added here.
function renderWithTheme(ui: ReactNode) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

describe("theme components", () => {
  it("renders inputs filled with the field background and keeps the error state", () => {
    renderWithTheme(<TextInput label="Номер" error="Неверный номер" />);

    const input = screen.getByRole("textbox", { name: "Номер" });
    expect(input).toHaveAttribute("data-variant", "filled");
    expect(input).toHaveAttribute("data-error", "true");
    expect(screen.getByText("Неверный номер")).toBeInTheDocument();
    const wrapper = input.parentElement;
    expect(wrapper?.style.getPropertyValue("--input-bg")).toBe("var(--ga-field-bg)");
    // The error border is Mantine's: --input-bd is not overridden inline.
    expect(wrapper?.style.getPropertyValue("--input-bd")).toBe("");
  });

  it("keeps the unstyled input transparent", () => {
    renderWithTheme(<Textarea aria-label="Сообщение" variant="unstyled" />);

    const wrapper = screen.getByRole("textbox", { name: "Сообщение" }).parentElement;
    expect(wrapper?.style.getPropertyValue("--input-bg")).toBe("");
  });

  it("renders ActionIcon variant='field' with the field background and radius 12", () => {
    renderWithTheme(
      <ActionIcon variant="field" aria-label="Выйти">
        x
      </ActionIcon>,
    );

    const button = screen.getByRole("button", { name: "Выйти" });
    expect(button.style.getPropertyValue("--ai-bg")).toBe("var(--ga-field-bg)");
    expect(button.style.getPropertyValue("--ai-radius")).not.toBe("");
    expect(button).toHaveClass(FOCUS_CLASS_NAME);
  });

  it("puts --ga-on-primary text on the filled primary ActionIcon", () => {
    renderWithTheme(<ActionIcon aria-label="Создать">x</ActionIcon>);

    const button = screen.getByRole("button", { name: "Создать" });
    expect(button.style.getPropertyValue("--ai-color")).toBe("var(--ga-on-primary)");
  });
});
