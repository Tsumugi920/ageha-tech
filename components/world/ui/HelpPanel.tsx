"use client";

import { useRef } from "react";
import Link from "next/link";
import { useWorldUI } from "../WorldUIContext";
import { usePanelA11y } from "./usePanelA11y";

/**
 * 操作说明面板（蓝图 §13.6，H / ? 键随时可查）：
 * 桌面键位表 / 触屏手势 / reduced-motion 与降级说明 /
 * 「跳过探索，直接看项目列表」入口（3D 世界不能成为获取信息的障碍）。
 */
export function HelpPanel() {
  const { panel, closePanel, isMobileLike } = useWorldUI();
  const open = panel === "help";
  const panelRef = useRef<HTMLElement>(null);
  usePanelA11y({ open, onClose: closePanel, panelRef });

  return (
    <aside
      ref={panelRef}
      className={`world-panel world-panel--help${open ? " world-panel--open" : ""}`}
      data-world-panel="help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="world-help-title"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
    >
      <header className="world-panel__header">
        <div>
          <p className="world-panel__eyebrow">Controls</p>
          <h2 id="world-help-title" className="world-panel__title">
            操作说明
          </h2>
        </div>
        <button
          type="button"
          className="world-panel__close"
          onClick={closePanel}
          aria-label="关闭操作说明"
        >
          ×
        </button>
      </header>

      <div className="world-panel__body">
        {isMobileLike ? (
          <section className="world-help__section" aria-label="触屏手势">
            <h3 className="world-help__heading">触屏手势</h3>
            <ul className="world-help__list">
              <li>左下摇杆拖动 —— 移动</li>
              <li>右半屏拖动 —— 观察视角</li>
              <li>点按项目设施或提示条 —— 打开项目详情</li>
              <li>右上按钮 —— 世界导航 / 操作说明</li>
            </ul>
          </section>
        ) : (
          <section className="world-help__section" aria-label="键位说明">
            <h3 className="world-help__heading">键位</h3>
            <dl className="world-help__table">
              <dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键</dt>
              <dd>移动（相对观察方向）</dd>
              <dt><kbd>Shift</kbd></dt>
              <dd>冲刺</dd>
              <dt>鼠标左键拖拽</dt>
              <dd>观察视角（不锁定指针）</dd>
              <dt>滚轮</dt>
              <dd>拉近 / 拉远</dd>
              <dt><kbd>E</kbd> 或点击</dt>
              <dd>查看最近的项目详情</dd>
              <dt><kbd>R</kbd></dt>
              <dd>返回起点</dd>
              <dt><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></dt>
              <dd>传送三座项目屿</dd>
              <dt><kbd>M</kbd></dt>
              <dd>世界导航面板</dd>
              <dt><kbd>H</kbd> / <kbd>?</kbd></dt>
              <dd>操作说明（本面板）</dd>
              <dt><kbd>Esc</kbd></dt>
              <dd>关闭面板</dd>
            </dl>
          </section>
        )}

        <section className="world-help__section" aria-label="探索指引">
          <h3 className="world-help__heading">探索指引</h3>
          <ul className="world-help__list">
            <li>三条蝶径各通向一座作品之屿，靠近设施出现「按 E 或点击」提示。</li>
            <li>主岛西北缘的窄径通往海面下的隐藏角落——发现后可从世界导航直达。</li>
            <li>偏好减弱动态效果时，场景动画自动静止，操作不受影响。</li>
          </ul>
        </section>

        <section className="world-help__section" aria-label="跳过探索">
          <h3 className="world-help__heading">不想探索？</h3>
          <p className="world-help__note">
            3D 世界只是入口，不是门槛——项目信息随时可以从列表直接看。
          </p>
          <Link href="/projects" className="world-panel__primary">
            跳过探索，直接看项目列表
          </Link>
        </section>
      </div>
    </aside>
  );
}
