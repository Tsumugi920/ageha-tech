"use client";

import { useEffect } from "react";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { site } from "@/lib/site";
import { useWorldUI } from "../WorldUIContext";

/**
 * WebGL 降级项目浏览页（蓝图 §12.3）：WebGL 不可用 / 世界初始化失败时，
 * WorldShell 渲染本组件——完整可访问的项目浏览 + 全路由导航，绝不白屏。
 * 卡片复用 /projects 列表页的共享 ProjectCard（视觉与 next/image 纪律一致）。
 */
export function FallbackProjects() {
  const { setPhase } = useWorldUI();

  // 挂载即置 fallback 相位（低频一次性副作用，加载屏随之淡出）
  useEffect(() => {
    setPhase("fallback");
  }, [setPhase]);

  return (
    <div className="world-fallback site-container">
      <p className="world-fallback__note">
        当前浏览器无法启用 3D 世界（WebGL 不可用或初始化失败），已切换为项目列表浏览模式。
      </p>
      <h2 className="world-fallback__title">全部项目</h2>
      <ul className="grid list-none grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
        {projects.map((project, index) => (
          <li key={project.slug}>
            <ProjectCard project={project} index={index + 1} headingLevel="h3" />
          </li>
        ))}
      </ul>
      <nav className="world-fallback__nav" aria-label="站内导航">
        {site.navItems
          .filter((item) => item.href !== "/")
          .map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
      </nav>
    </div>
  );
}
