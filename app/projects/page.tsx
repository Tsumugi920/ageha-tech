import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { projects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "项目",
  description:
    "Ageha.tech 正在构建与持续打磨中的项目：Web OS 桌面体验、CS 饰品虚拟投资模拟器与 Moss World 交互式数字生态 —— 均为技术探索中的作品。",
};

/** 右上两行小注记（与首页精选项目版块同一过程性定位，非成果宣言） */
const PAGE_NOTE = [
  "一些正在构建、持续打磨，",
  "或记录我技术探索过程的作品。",
] as const;

/**
 * 全部项目列表页：页头 + 与首页「精选项目」同一套玻璃大板与 ProjectCard 网格。
 * 数据来自 lib/projects.ts（三个探索中的项目，无上线状态 / 演示 / 源码链接）。
 */
export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 md:px-8">
      <GlassPanel className="relative overflow-hidden p-5 sm:p-7 lg:p-9">
        {/* 面板顶部弧形高光：与首页精选项目大板同款 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white/95 to-transparent"
        />

        <div className="relative mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
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

        {/* 三等列卡片网格：与首页精选项目共用 ProjectCard，保证视觉一致；
            页面 h1 下无中间层级，卡片标题升为 h2 避免标题跳级 */}
        <ul className="relative grid list-none gap-6 md:grid-cols-3">
          {projects.map((project, index) => (
            <li key={project.slug}>
              <ProjectCard project={project} index={index + 1} headingLevel="h2" />
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
