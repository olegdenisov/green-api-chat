import { ActionIcon, MantineProvider, rem, Textarea, TextInput } from "@mantine/core";
import { render } from "@test/render";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { cssVariablesResolver, FOCUS_CLASS_NAME, theme } from "./theme";

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

  it("renders ActionIcon variant='field' with the field background, radius 12 and size 38", () => {
    renderWithTheme(
      <ActionIcon variant="field" aria-label="Выйти">
        x
      </ActionIcon>,
    );

    const button = screen.getByRole("button", { name: "Выйти" });
    expect(button.style.getPropertyValue("--ai-bg")).toBe("var(--ga-field-bg)");
    expect(button.style.getPropertyValue("--ai-radius")).toBe(rem(12));
    expect(button.style.getPropertyValue("--ai-size")).toBe(rem(38));
    expect(button).toHaveClass(FOCUS_CLASS_NAME);
  });

  it("emits the overrides of the filled colours into the scheme blocks of Mantine's CSS", () => {
    render(
      <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        forceColorScheme="dark"
      >
        x
      </MantineProvider>,
    );

    const css = [...document.querySelectorAll("style")].map((style) => style.textContent).join("");
    const block = (scheme: string) =>
      new RegExp(`\\[data-mantine-color-scheme="${scheme}"\\][^{]*\\{([^}]*)\\}`).exec(css)?.[1] ??
      "";
    expect(block("dark")).toContain("--mantine-color-lavender-filled: #b7adff;");
    // In dark red-8 is Mantine's own filled shade (primaryShade.dark 8): only light overrides it.
    expect(block("light")).toContain("--mantine-color-red-filled: var(--mantine-color-red-8);");
  });

  it("puts --ga-on-primary text on the filled primary ActionIcon", () => {
    renderWithTheme(<ActionIcon aria-label="Создать">x</ActionIcon>);

    const button = screen.getByRole("button", { name: "Создать" });
    expect(button.style.getPropertyValue("--ai-color")).toBe("var(--ga-on-primary)");
  });
});
