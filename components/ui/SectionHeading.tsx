import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

export type SectionHeadingProps = {
  /** 小标签（Badge 内展示，等宽大写） */
  eyebrow: string;
  /** 大标题 */
  title: string;
  /** 可选描述文案 */
  description?: string;
  /** 可选右侧链接 */
  link?: {
    href: string;
    label: string;
  };
  /** 对齐方式，默认左对齐 */
  align?: "left" | "center";
  className?: string;
};

/**
 * 版块标题：小标签 + 大标题（+ 描述），可选右侧链接。
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  link,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between",
        align === "center" && "md:flex-col md:items-center",
        className,
      )}
    >
      <div
        className={cn(
          "max-w-2xl space-y-3",
          align === "center" && "mx-auto text-center",
        )}
      >
        <Badge>{eyebrow}</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-base leading-relaxed text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {link ? (
        <a
          href={link.href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-link transition-colors hover:text-link-hover"
        >
          {link.label}
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      ) : null}
    </div>
  );
}
