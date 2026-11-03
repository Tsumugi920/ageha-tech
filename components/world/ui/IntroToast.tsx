"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useWorldUI } from "../WorldUIContext";

/**
 * 首次引导卡 IntroToast（蓝图 §13.1 / §13.3；原 Hero 首屏文案的迁移新家）：
 * - 个人简介、统计口径（14+ / 16 / ∞）、双按钮
 *   （查看我的项目 / 了解我）自退役的 Hero.tsx 逐字搬迁（hero.test.mjs 契约）；
 * - 可关闭、可跳过、任意移动操作即隐；会话内关闭后不再自动弹出。
 * - R4：内容区与底部「开始探索」分离，移动端卡片限高 + 内部滚动，
 *   且整卡抬到摇杆 / 导航按钮之上；卡内滚动 / 点按不会误关。
 */
const STATS = [
  { value: "14+", label: "收录作品" },
  { value: "16", label: "在用/在学技术" },
  { value: "∞", label: "持续探索" },
] as const;

const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function IntroToast() {
  const { introOpen, closeIntro, isMobileLike } = useWorldUI();
  const toastRef = useRef<HTMLElement>(null);

  // 卡外任意操作即隐；卡内点按 / 滚动留给内容本身。
  useEffect(() => {
    if (!introOpen) return;
    const onActivity = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        toastRef.current?.contains(event.target)
      ) {
        return;
      }
      closeIntro();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeIntro();
      else if (MOVE_KEYS.has(event.key)) closeIntro();
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
    <section className="world-toast" aria-label="探索引导" ref={toastRef}>
      <div className="world-toast__head">
        <p className="world-toast__eyebrow">Digital Garden · 数字花园</p>
        <button type="button" className="world-toast__cancel" onClick={closeIntro} aria-label="关闭引导卡">
          ×
        </button>
      </div>

      <div className="world-toast__scroll">
        <p className="world-toast__intro">
          我是 Momori，在做小而可用的网页工具和实验项目，欢迎在群岛里逛逛
          <span className="world-toast__accent">我的作品</span>。
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
        <p className="world-toast__guide">
          <span className="world-toast__guide-dot" aria-hidden="true" />
          {isMobileLike
            ? "左下摇杆移动 · 你操控的是暖色信灯"
            : "WASD 移动 · 拖拽观察 · 你操控的是暖色信灯"}
        </p>
      </div>

      <div className="world-toast__foot">
        <button type="button" className="world-toast__close" onClick={closeIntro}>
          开始探索 →
        </button>
      </div>
    </section>
  );
}
