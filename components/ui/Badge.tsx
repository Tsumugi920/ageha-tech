import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

/**
 * 小徽章 / 标签：等宽字体、大写字距、玻璃细边胶囊。
 * 用于 SectionHeading 的小标签与状态标记。
 */
export function Badge({ className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-white/55 px-3 py-1 font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-text-secondary",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
