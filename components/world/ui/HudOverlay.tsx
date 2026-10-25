"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { useWorldUI } from "../WorldUIContext";
import { Joystick } from "./Joystick";

/**
 * HUD 常态层（蓝图 §13.3）：区域名牌 / 交互提示条 / 键位提示 / 项目快捷入口 /
 * 世界导航与操作说明按钮 / 返回起点——不抢主视觉，全部玻璃令牌 + 深墨文字。
 * 项目快捷入口点击打开详情面板（信息直达），传送入口在世界导航面板（M）。
 */
export function HudOverlay() {
  const {
    zone,
    prompt,
    qualityNotice,
    requestRespawn,
    openDetail,
    toggleNav,
    toggleHelp,
    isMobileLike,
  } = useWorldUI();
  const [hintExpanded, setHintExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 操作提示 10s 后收成 ? 图标（任意展开后再计时）
  useEffect(() => {
    if (!hintExpanded) return;
    timerRef.current = setTimeout(() => setHintExpanded(false), 10_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hintExpanded]);

  return (
    <div className="world-hud">
      {/* 顶中：当前区域名牌（进入区域淡入） */}
      {zone ? (
        <p key={zone} className="world-hud__zone" role="status">
          {zone}
        </p>
      ) : null}

      {/* 档位自适应一次性提示（升降档时出现 4s，§12.2 HUD 通知） */}
      {qualityNotice ? (
        <p key={qualityNotice} className="world-hud__quality" role="status">
          {qualityNotice}
        </p>
      ) : null}

      {/* 中下：交互提示条（有目标时；点击打开详情面板；触屏文案不带键盘按键） */}
      {prompt ? (
        <p className="world-hud__prompt">
          <button
            type="button"
            className="world-hud__prompt-btn"
            onClick={() => openDetail(prompt.slug)}
          >
            {isMobileLike
              ? `查看 ${prompt.label}`
              : `按 E 或点击 · 查看 ${prompt.label}`}
          </button>
        </p>
      ) : null}

      {/* 左下：移动端摇杆 / 桌面键位提示 */}
      {isMobileLike ? (
        <Joystick />
      ) : hintExpanded ? (
        <div className="world-hud__hint">
          <span>WASD / 方向键 移动 · 鼠标拖拽 观察 · 滚轮 缩放</span>
          <span>Shift 冲刺 · E 查看 · 1/2/3 传送三屿 · R 返回起点</span>
          <span>M 世界导航 · H 键位说明</span>
          <button
            type="button"
            className="world-hud__hint-close"
            onClick={() => setHintExpanded(false)}
            aria-label="收起操作提示"
          >
            收起
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="world-hud__hint-dot"
          onClick={() => setHintExpanded(true)}
          aria-label="展开操作提示"
        >
          ?
        </button>
      )}

      {/* 右下：工具行（世界导航 / 键位说明）+ 项目快捷入口 + 返回起点 */}
      <div className="world-hud__quick">
        <div className="world-hud__quick-row">
          <button
            type="button"
            className="world-hud__quick-mini"
            onClick={toggleNav}
            aria-label="打开世界导航（快捷键 M）"
          >
            导航
          </button>
          <button
            type="button"
            className="world-hud__quick-mini"
            onClick={toggleHelp}
            aria-label="查看操作说明（快捷键 H）"
          >
            说明
          </button>
        </div>
        {projects.map((project) => (
          <button
            key={project.slug}
            type="button"
            className="world-hud__quick-item"
            onClick={() => openDetail(project.slug)}
          >
            <span className="world-hud__quick-name">{project.name}</span>
            <span className="world-hud__quick-status">{project.status}</span>
          </button>
        ))}
        <div className="world-hud__quick-row">
          <Link href="/projects" className="world-hud__quick-mini">
            项目列表
          </Link>
          <button
            type="button"
            className="world-hud__quick-mini"
            onClick={requestRespawn}
          >
            返回起点
          </button>
        </div>
      </div>
    </div>
  );
}
