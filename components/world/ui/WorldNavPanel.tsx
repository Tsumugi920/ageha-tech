"use client";

import { useRef } from "react";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { site } from "@/lib/site";
import { CHRYSALIS_NOOK, PROJECT_ISLES } from "@/lib/world/layout";
import { useWorldUI } from "../WorldUIContext";
import { usePanelA11y } from "./usePanelA11y";

/**
 * 世界导航面板（蓝图 §13.5，M 键 / HUD 按钮打开）：
 * - 三项目传送卡（名称 + 状态 + 「传送」/「详情」双入口）；
 * - 主岛回航、茧居所（发现后出现——隐藏彩蛋纪律）；
 * - 站点路由区（数据单源 site.navItems）+ 联系入口（configured 渠道，
 *   当前仅 GitHub，链接运行时来自 lib/site.ts，不在组件内写死）。
 * 探索不是获取信息的唯一路径（brief §7）。
 */
export function WorldNavPanel() {
  const {
    panel,
    closePanel,
    openDetail,
    requestTeleport,
    nookDiscovered,
  } = useWorldUI();
  const open = panel === "nav";
  const panelRef = useRef<HTMLElement>(null);
  usePanelA11y({ open, onClose: closePanel, panelRef });

  const teleportAndClose = (targetId: string) => {
    closePanel();
    requestTeleport(targetId);
  };

  return (
    <aside
      ref={panelRef}
      className={`world-panel world-panel--nav${open ? " world-panel--open" : ""}`}
      data-world-panel="nav"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-nav-title"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
    >
      <header className="world-panel__header">
        <div>
          <p className="world-panel__eyebrow">World Navigation</p>
          <h2 id="world-nav-title" className="world-panel__title">
            世界导航
          </h2>
        </div>
        <button
          type="button"
          className="world-panel__close"
          onClick={closePanel}
          aria-label="关闭世界导航"
        >
          ×
        </button>
      </header>

      <div className="world-panel__body">
        <section className="world-nav__section" aria-label="项目屿传送">
          <h3 className="world-nav__heading">项目屿</h3>
          <ul className="world-nav__list">
            {PROJECT_ISLES.map((isle, index) => {
              const project = projects.find((item) => item.slug === isle.slug);
              return (
                <li key={isle.id} className="world-nav__card">
                  <div className="world-nav__card-text">
                    <p className="world-nav__card-name">{project?.name ?? isle.name}</p>
                    <p className="world-nav__card-status">
                      {project?.status ?? ""}
                      <span className="world-nav__card-key"> · 快捷键 {index + 1}</span>
                    </p>
                  </div>
                  <div className="world-nav__card-actions">
                    <button
                      type="button"
                      className="world-nav__card-btn"
                      onClick={() => teleportAndClose(isle.id)}
                    >
                      传送
                    </button>
                    <button
                      type="button"
                      className="world-nav__card-btn"
                      onClick={() => openDetail(isle.slug)}
                      disabled={!project}
                    >
                      详情
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="world-nav__section" aria-label="回航与彩蛋">
          <h3 className="world-nav__heading">回航</h3>
          <div className="world-nav__row">
            <button
              type="button"
              className="world-nav__card-btn"
              onClick={() => teleportAndClose("spawn")}
            >
              返回主岛 · 苏醒环礁
            </button>
            {nookDiscovered ? (
              <button
                type="button"
                className="world-nav__card-btn"
                onClick={() => teleportAndClose(CHRYSALIS_NOOK.id)}
              >
                茧居所 · 已发现
              </button>
            ) : null}
          </div>
        </section>

        <section className="world-nav__section" aria-label="站点导航">
          <h3 className="world-nav__heading">站点页面</h3>
          <nav className="world-nav__links" aria-label="站内路由">
            {site.navItems
              .filter((item) => item.href !== "/")
              .map((item) => (
                <Link key={item.href} href={item.href} className="world-nav__link">
                  {item.label}
                </Link>
              ))}
            {/* 联系页：与 Navbar「联系我」按钮同源 site.contactRoute（蓝图 §13.5） */}
            <Link href={site.contactRoute.href} className="world-nav__link">
              {site.contactRoute.label}
            </Link>
          </nav>
        </section>

        <section className="world-nav__section" aria-label="联系方式">
          <h3 className="world-nav__heading">联系</h3>
          <nav className="world-nav__links" aria-label="联系方式">
            {site.contacts
              .filter((contact) => contact.configured && contact.href)
              .map((contact) => (
                <a
                  key={contact.label}
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                  className="world-nav__link"
                >
                  {contact.label}
                </a>
              ))}
          </nav>
        </section>
      </div>
    </aside>
  );
}
