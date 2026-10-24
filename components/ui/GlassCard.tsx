import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type GlassCardProps = HTMLAttributes<HTMLDivElement>;

/**
 * 玻璃拟态卡片：比 GlassPanel 更实的白底与更柔的投影，自带悬浮反馈。
 * 用作内容卡片（项目、笔记、联系方式等）。
 */
export function GlassCard({ className, children, ...rest }: GlassCardProps) {
  return (
    <div className={cn("glass-card rounded-3xl", className)} {...rest}>
      {children}
    </div>
  );
}
