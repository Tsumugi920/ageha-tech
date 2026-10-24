import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type GlassPanelProps = HTMLAttributes<HTMLDivElement>;

/**
 * 玻璃拟态基础面板：半透明白底 + 细边框 + backdrop-blur + 柔和投影。
 * 用作页面区块容器 / 导航条底座。
 */
export function GlassPanel({ className, children, ...rest }: GlassPanelProps) {
  return (
    <div className={cn("glass-panel rounded-3xl", className)} {...rest}>
      {children}
    </div>
  );
}
