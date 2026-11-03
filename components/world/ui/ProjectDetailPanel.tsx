"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { useWorldUI } from "../WorldUIContext";
import { usePanelA11y } from "./usePanelA11y";

/**
 * 项目详情面板（蓝图 §13.4，右侧 380px 滑入 / 移动端底部抽屉）：
 * - 数据全部来自 lib/projects.ts 原对象（单一数据源，零复制）：
 *   封面（next/image 懒加载）+ 名称 + 分类 + 描述 + 技术栈 + 状态 + 链接；
 * - 无链接的项目（诚实边界铁律）：如实显示
 *   「本地项目 · 未公开上线，暂无公开链接」，不渲染任何外链按钮；
 * - 底部双动作：「在详情页打开」→ /projects/[slug]（SEO 路由双保险）、
 *   「返回探索」→ 关闭面板回世界（世界状态全程保持，不重置）；
 * - 面板常驻挂载（打开/关闭走 CSS 滑入滑出，280ms 同曲线）；
 *   关闭态 inert + visibility 隐藏，滑出动画期间保留最近内容不闪空。
 */
export function ProjectDetailPanel() {
  const { panel, detailSlug, closePanel } = useWorldUI();
  const open = panel === "detail";
  const panelRef = useRef<HTMLElement>(null);
  usePanelA11y({ open, onClose: closePanel, panelRef });

  // 保留最近一次打开的 slug：关闭滑出动画期间内容不闪空。
  // 渲染期状态调整（React 官方「无需 effect」模式）而非 effect 内 setState
  const [shownSlug, setShownSlug] = useState<string | null>(null);
  if (detailSlug && detailSlug !== shownSlug) {
    setShownSlug(detailSlug);
  }

  const project = shownSlug
    ? projects.find((item) => item.slug === shownSlug)
    : undefined;
  // links 可选（无链接的项目）；空数组走诚实说明文案
  const projectLinks = project?.links ?? [];

  return (
    <aside
      ref={panelRef}
      className={`world-panel world-panel--detail${open ? " world-panel--open" : ""}`}
      data-world-panel="detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-detail-title"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
    >
      {project ? (
        <>
          <header className="world-panel__header">
            <div>
              <p className="world-panel__eyebrow">{project.category}</p>
              <h2 id="world-detail-title" className="world-panel__title">
                {project.name}
              </h2>
            </div>
            <button
              type="button"
              className="world-panel__close"
              onClick={closePanel}
              aria-label="关闭详情，返回探索"
            >
              ×
            </button>
          </header>

          <div className="world-panel__body">
            <div className="world-detail__cover">
              <Image
                src={project.cover}
                alt={project.coverAlt}
                fill
                sizes="(min-width: 640px) 380px, 92vw"
                className="world-detail__cover-img"
                style={{ objectPosition: project.coverPosition ?? "center" }}
              />
            </div>

            <p className="world-detail__status" data-status={project.status}>
              {project.status}
            </p>

            <p className="world-detail__desc">{project.description}</p>

            <ul className="world-detail__tags" aria-label="技术栈">
              {project.tags.map((tag) => (
                <li key={tag} className="world-detail__tag">
                  {tag}
                </li>
              ))}
            </ul>

            {projectLinks.length > 0 ? (
              <div className="world-detail__links">
                {projectLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="world-detail__link"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="world-detail__nolink">
                本地项目 · 未公开上线，暂无公开链接
              </p>
            )}
          </div>

          <footer className="world-panel__footer">
            <Link href={`/projects/${project.slug}`} className="world-panel__primary">
              在详情页打开
            </Link>
            <button type="button" className="world-panel__ghost" onClick={closePanel}>
              返回探索
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}
