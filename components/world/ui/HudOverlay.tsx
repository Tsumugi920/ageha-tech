"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { useWorldUI } from "../WorldUIContext";
import { Joystick } from "./Joystick";

/**
 * HUD 常态层（蓝图 §13.3，阶段 1 范围：键位提示 / 区域名牌 / 交互提示条 /
 * 三项目快捷入口 / 返回起点；不抢主视觉，全部玻璃令牌 + 深墨文字）。
 * 移动端左下为虚拟摇杆（键位提示退化为 ? 说明按钮）。
 */
export function HudOverlay() {
  const { zone, prompt, requestRespawn, isMobileLike } = useWorldUI();
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

      {/* 中下：交互提示条（有目标时） */}
      {prompt ? (
        <p className="world-hud__prompt">
          <Link href={`/projects/${prompt.slug}`} className="world-hud__prompt-link">
            按 E 或点击 · 查看 {prompt.label}
          </Link>
        </p>
      ) : null}

      {/* 左下：移动端摇杆 / 桌面键位提示 */}
      {isMobileLike ? (
        <Joystick />
      ) : hintExpanded ? (
        <div className="world-hud__hint">
          <span>WASD / 方向键 移动</span>
          <span>鼠标拖拽 观察 · 滚轮 缩放</span>
          <span>Shift 冲刺 · E 查看 · R 返回起点</span>
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

      {/* 右下：三项目快捷入口 + 返回起点（阶段 2 升级为传送与 M 面板） */}
      <div className="world-hud__quick">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="world-hud__quick-item"
          >
            <span className="world-hud__quick-name">{project.name}</span>
            <span className="world-hud__quick-status">{project.status}</span>
          </Link>
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
