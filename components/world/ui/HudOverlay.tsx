"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { projects } from "@/lib/projects";
import {
  EXPERIENCE_NOTES,
  EXPERIENCE_RESET_LABELS,
  EXPERIENCE_TITLES,
  getExperienceOptions,
  isExperienceProjectSlug,
} from "@/lib/world/experiences";
import { useWorldUI } from "../WorldUIContext";
import { Joystick } from "./Joystick";
import { useWorldAudio } from "../systems/WorldAudio";

/**
 * HUD 常态层（R3 精简）：
 * - 顶中区域名牌、交互提示条、左下操作提示、右下工具栏；
 * - 项目屿列表改为「按需展开」的小抽屉，不再常驻遮挡场景；
 *   默认只保留项目屿 / 导航 / 说明三个按钮；
 * - 桌面端保留项目列表与返回起点两个次级入口，移动端收敛到导航面板。
 * 所有交互控件 ≥44px 触控高度，面板打开时整层 HUD 淡出（根部 data 属性）。
 */
export function HudOverlay() {
  const {
    zone,
    prompt,
    qualityNotice,
    progressNotice,
    openDetail,
    activateRelay,
    experiences,
    setExperience,
    toggleNav,
    toggleHelp,
    isMobileLike,
  } = useWorldUI();
  // P1：首访由引导卡承担键位说明，HUD 常态只留一个 ? ；展开后 8s 自动收起
  const [hintExpanded, setHintExpanded] = useState(false);
  const { muted, toggleMuted } = useWorldAudio();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 操作提示 8s 后收成 ? 图标（任意展开后再计时）
  useEffect(() => {
    if (!hintExpanded || isMobileLike) return;
    timerRef.current = setTimeout(() => setHintExpanded(false), 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hintExpanded, isMobileLike]);

  const openNav = () => {
    setProjectsOpen(false);
    toggleNav();
  };
  const openHelp = () => {
    setProjectsOpen(false);
    toggleHelp();
  };

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

      {/* 探索目标完成：低频一次性提示；已完成的复访不重复出现 */}
      {progressNotice ? (
        <p key={progressNotice} className="world-hud__progress" role="status">
          {progressNotice}
        </p>
      ) : null}

      {/* 中下：交互提示条（有目标时；点击打开详情面板；触屏文案不带键盘按键） */}
      {prompt ? (
        <div className="world-hud__prompt">
          {prompt.kind === "project" ? (
            <ExperienceStrip
              slug={prompt.slug}
              activeId={experiences[prompt.slug] ?? null}
              onSelect={(optionId) => setExperience(prompt.slug, optionId)}
              onReset={() => setExperience(prompt.slug, null)}
            />
          ) : null}
          <button
            type="button"
            className="world-hud__prompt-btn"
            onClick={() => {
              if (prompt.kind === "project") openDetail(prompt.slug);
              else activateRelay();
            }}
          >
            {prompt.kind === "project"
              ? isMobileLike
                ? `查看 ${prompt.label}`
                : `按 E 或点击 · 查看 ${prompt.label}`
              : isMobileLike
                ? "点亮北径"
                : "按 E 或点击 · 点亮北径"}
          </button>
        </div>
      ) : null}

      {/* 左下：移动端摇杆 / 桌面单行键位提示（8s 后收成 ?） */}
      {isMobileLike ? (
        <Joystick />
      ) : hintExpanded ? (
        <div className="world-hud__hint">
          <span>WASD 移动 · 拖拽观察 · 滚轮缩放</span>
          <span>Shift 冲刺 · E 查看 · R 返回 · H 说明</span>
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

      {/* 右下：工具栏 + 按需展开的项目屿列表 */}
      <div className="world-hud__quick">
        {projectsOpen ? (
          <div className="world-hud__projects" role="group" aria-label="项目屿入口">
            <p className="world-hud__projects-label">项目屿 · 快速查看</p>
            {projects.map((project) => (
              <button
                key={project.slug}
                type="button"
                className="world-hud__quick-item"
                onClick={() => {
                  setProjectsOpen(false);
                  openDetail(project.slug);
                }}
              >
                <span className="world-hud__quick-name">{project.name}</span>
                <span className="world-hud__quick-status">{project.status}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="world-hud__quick-row">
          <button
            type="button"
            className={
              projectsOpen
                ? "world-hud__quick-mini world-hud__quick-mini--active"
                : "world-hud__quick-mini"
            }
            onClick={() => setProjectsOpen((open) => !open)}
            aria-expanded={projectsOpen}
            aria-label="展开项目屿快速入口"
          >
            项目屿
          </button>
          <button
            type="button"
            className="world-hud__quick-mini"
            onClick={openNav}
            aria-label="打开世界导航（快捷键 M）"
          >
            导航
          </button>
          <button
            type="button"
            className="world-hud__quick-mini"
            onClick={openHelp}
            aria-label="查看操作说明（快捷键 H）"
          >
            说明
          </button>
          <button
            type="button"
            className="world-hud__quick-mini world-hud__quick-icon"
            onClick={toggleMuted}
            aria-label={muted ? "开启声音" : "关闭声音"}
            aria-pressed={!muted}
            title={muted ? "开启声音" : "关闭声音"}
          >
            {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          </button>
        </div>

      </div>
    </div>
  );
}

/** 三项目区场景体验控制带：只改 3D 演示状态，不替代项目详情入口。 */
function ExperienceStrip({
  slug,
  activeId,
  onSelect,
  onReset,
}: {
  slug: string;
  activeId: string | null;
  onSelect: (optionId: string) => void;
  onReset: () => void;
}) {
  const options = getExperienceOptions(slug);
  if (!options || !isExperienceProjectSlug(slug)) return null;
  return (
    <div
      className="world-experience"
      role="group"
      aria-label={`${EXPERIENCE_TITLES[slug]}（作品集演示）`}
    >
      <span className="world-experience__label">{EXPERIENCE_TITLES[slug]}</span>
      <div className="world-experience__options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="world-experience__btn"
            aria-pressed={activeId === option.id}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="world-experience__reset"
          onClick={onReset}
          disabled={activeId === null}
        >
          {EXPERIENCE_RESET_LABELS[slug]}
        </button>
      </div>
      <span className="world-experience__note">{EXPERIENCE_NOTES[slug]}</span>
    </div>
  );
}
