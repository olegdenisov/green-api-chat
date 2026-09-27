import type { ActionIconVariant } from "@mantine/core";

// The custom `field` variant (variantColorResolver in theme.ts), typed as Mantine's guide on
// custom variants suggests: a typo in `variant` fails the typecheck instead of silently
// rendering Mantine's default.
declare module "@mantine/core" {
  export interface ActionIconProps {
    variant?: ActionIconVariant | "field";
  }
}
