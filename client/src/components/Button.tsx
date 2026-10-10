import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "line" | "solid" | "text";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  block?: boolean;
  small?: boolean;
  children: ReactNode;
}

export function Button({ variant = "line", icon, block, small, className = "", children, ...rest }: Props) {
  const cls = ["btn", variant !== "line" && variant, block && "block", small && "small", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </button>
  );
}
