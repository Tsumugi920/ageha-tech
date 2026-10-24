import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type GlassButtonVariant = "primary" | "ghost";

const glassButtonVariants: Record<GlassButtonVariant, string> = {
  primary:
    "bg-linear-to-r from-blue to-purple text-white border border-white/50 shadow-[0_10px_30px_rgba(38,157,255,0.35)] hover:shadow-[0_14px_38px_rgba(38,157,255,0.45)]",
  ghost:
    "glass-panel text-text-secondary hover:bg-glass-strong hover:text-text-primary",
};

type GlassButtonCommonProps = {
  variant?: GlassButtonVariant;
  children?: ReactNode;
};

/**
 * 玻璃拟态按钮：传入 `href` 渲染为 <a>（跳转锚点/外链），
 * 否则渲染为 <button>。primary 为蓝紫渐变主按钮，ghost 为玻璃描边按钮。
 */
export type GlassButtonProps = GlassButtonCommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonHTMLAttributes<HTMLButtonElement>;

export function GlassButton({
  variant = "primary",
  className,
  children,
  href,
  type,
  ...rest
}: GlassButtonProps) {
  const classes = cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
    glassButtonVariants[variant],
    className,
  );

  if (href !== undefined) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {children}
    </button>
  );
}
