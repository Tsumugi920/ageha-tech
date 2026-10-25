"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWorldUI } from "../WorldUIContext";

/**
 * 首次引导卡 IntroToast（蓝图 §13.1 / §13.3；原 Hero 首屏文案的迁移新家）：
 * - 个人简介与「有趣且优雅」高亮、统计口径（3+ / 16 / ∞）、双按钮
 *   （查看我的项目 / 了解我）自退役的 Hero.tsx 逐字搬迁（hero.test.mjs 契约）；
 * - 可关闭、可跳过、任意移动操作即隐；会话内关闭后不再自动弹出。
 */
const STATS = [
  { value: "3+", label: "代表项目" },
  { value: "16", label: "在用/在学技术" },
  { value: "∞", label: "持续探索" },
] as const;

export function IntroToast() {
  const { introOpen, closeIntro, isMobileLike } = useWorldUI();

  // 任意操作即隐（键盘 / 指针 / 触摸）；Esc 同样关闭
  useEffect(() => {
    if (!introOpen) return;
    const onActivity = () => closeIntro();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || !event.repeat) closeIntro();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onActivity);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, [introOpen, closeIntro]);

  if (!introOpen) return null;

  return (
    <section
      className="world-toast"
      aria-label="探索引导"
    >
      <p className="world-toast__intro">
        我是 Ageha，一名独立开发者，热爱探索技术与设计的边界，致力于构建有价值、
        <span className="world-toast__accent">有趣且优雅</span>
        的数字产品。
      </p>
      <ul className="world-toast__stats" aria-label="站点统计">
        {STATS.map((stat) => (
          <li key={stat.label}>
            <span className="world-toast__value">{stat.value}</span>
            <span className="world-toast__label">{stat.label}</span>
          </li>
        ))}
      </ul>
      <div className="world-toast__actions">
        <Link href="/projects" className="world-toast__primary">
          查看我的项目
        </Link>
        <Link href="/about" className="world-toast__ghost">
          了解我
        </Link>
      </div>
      <p className="world-toast__keys">
        {isMobileLike
          ? "左下摇杆移动 · 右半屏拖动观察 · 靠近项目出现查看入口"
          : "WASD / 方向键 移动 · 鼠标拖拽 观察 · 滚轮 缩放 · E 查看 · R 返回起点"}
      </p>
      <button type="button" className="world-toast__close" onClick={closeIntro}>
        开始探索
      </button>
    </section>
  );
}
