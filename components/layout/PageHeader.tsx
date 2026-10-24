import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  /** 顶部小标签（Badge 内展示，等宽大写） */
  eyebrow: string;
  /** 页面主标题（h1） */
  title: string;
  /** 页面描述（与首页设计语言一致的过程性文案） */
  description?: string;
  /** 返回链接（面包屑级，置于最上方） */
  back?: {
    href: string;
    label: string;
  };
  className?: string;
};

/**
 * 内页页头：返回链接 + Badge 小标签 + h1 标题 + 描述。
 * 供 /projects、/about、/tech、/articles、/contact 统一页头结构，
 * 与首页版块共用同一套玻璃设计令牌与字体层级。
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  back,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4", className)}>
      {back ? (
        <Link
          href={back.href}
          /* py-3 + -my-3：真实命中高度 ≥44px，负外边距抵消布局位移（视觉不变） */
          className="group -my-3 inline-flex items-center gap-1.5 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-blue"
        >
          <ArrowLeft
            className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          {back.label}
        </Link>
      ) : null}
      <Badge>{eyebrow}</Badge>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-[1.95] text-text-secondary md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
