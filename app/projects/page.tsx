import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "项目",
  description:
    "Momori 的全部作品：小而可用的网页工具与实验项目，含 CS MAJOR ARCHIVE、calendar、blog-cms 等 21 个作品。",
};

/** 右上两行小注记（与首页精选项目版块同一过程性定位，非成果宣言） */
const PAGE_NOTE = [
  "一些正在构建、持续打磨，",
  "或记录我技术探索过程的作品。",
] as const;

/**
 * 全部项目列表页：页头 + 与首页「精选项目」同一套 ProjectCard 网格，
 * 直接坐在统一 .site-container 全宽内容网格上（不再包整段玻璃大板）。
 * 数据来自 lib/projects.ts（21 个核实过的作品；封面为概念视觉占位）。
 */
export default function ProjectsPage() {
  return (
    <div className="site-container pb-20 pt-14">
      <div className="mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          eyebrow="Projects"
          title="全部项目"
          back={{ href: "/", label: "返回首页" }}
        />
        <p className="max-w-xs text-center text-xs leading-[1.9] text-text-secondary lg:max-w-none lg:pt-1 lg:text-right">
          <span className="flex items-center justify-center gap-2.5 lg:justify-end">
            <span
              aria-hidden="true"
              className="h-px w-9 shrink-0 bg-text-secondary/45"
            />
            {PAGE_NOTE[0]}
          </span>
          {PAGE_NOTE[1]}
        </p>
      </div>

      {/* 项目卡网格：与首页精选项目共用 ProjectCard，保证视觉一致
          （md 两列 / xl 三等列，1024 档两列防窄卡截断——同首页）；
          页面 h1 下无中间层级，卡片标题升为 h2 避免标题跳级。
          显式 grid-cols-1 与首页同款：防移动端隐式 auto 轨道被标签行撑宽 */}
      <ul className="grid list-none grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
        {projects.map((project, index) => (
          <li key={project.slug}>
            <ProjectCard project={project} index={index + 1} headingLevel="h2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
