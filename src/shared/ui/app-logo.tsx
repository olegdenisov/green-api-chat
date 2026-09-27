import { rem } from "@mantine/core";
import type { CSSProperties } from "react";

import classes from "./app-logo.module.css";
import { IconMessageCircle } from "./icons";

interface AppLogoProps {
  /** Side of the square, px. */
  size: number;
  /** Corner radius, px. */
  radius: number;
  /** Side of the icon, px. */
  iconSize: number;
  className?: string;
}

/** App logo: `IconMessageCircle` in a soft square (`--ga-primary-soft`). Decorative. */
export function AppLogo({ size, radius, iconSize, className }: AppLogoProps) {
  const style = { "--app-logo-size": rem(size), "--app-logo-radius": rem(radius) } as CSSProperties;
  return (
    <div className={className ? `${classes.logo} ${className}` : classes.logo} style={style}>
      <IconMessageCircle size={iconSize} />
    </div>
  );
}
