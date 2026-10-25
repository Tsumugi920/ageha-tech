import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TechStackSection } from "@/components/home/TechStackSection";
import { GlassPanel } from "@/components/ui/GlassPanel";

export const metadata: Metadata = {
  title: "技术栈",
  description:
    "Ageha.tech 的技术栈：前端开发、后端与数据、开发工具与 AI 工具链 —— 表示在用 / 在学的方向，不附带任何熟练度声明。",
};

/**
 * 技术栈页：统一页头 + 复用首页「技术栈」版块 + 一条如实的边界说明。
 * 名单与首页同源（lib/tech-stack.ts），仅表示「在用 / 在学」的能力方向。
 */
export default function TechPage() {
  return (
    <>
      <div className="site-container pt-14">
        <PageHeader
          eyebrow="Tech Stack"
          title="技术栈"
          description="通过真实项目积累经验，以持续学习拓展能力边界。"
          back={{ href: "/", label: "返回首页" }}
        />
      </div>

      <TechStackSection />

      {/* 诚实边界说明：与 lib/tech-stack.ts 的数据口径一致 */}
      <div className="site-container pb-20">
        <GlassPanel className="flex flex-col items-center gap-2.5 rounded-2xl px-5 py-4 text-center sm:flex-row sm:gap-3 sm:text-left">
          <NotebookPen
            className="size-4 shrink-0 text-blue"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-text-secondary">
            以上名单表示
            <strong className="font-semibold text-text-primary">
              在用 / 在学
            </strong>
            的能力方向，不附带任何熟练度、年限或认证声明 ——
            技术栈会随项目实践持续更新。
          </p>
        </GlassPanel>
      </div>
    </>
  );
}
