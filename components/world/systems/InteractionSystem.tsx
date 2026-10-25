"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { INTERACTABLES } from "@/lib/world/colliders";
import { getZoneName } from "@/lib/world/layout";
import { INTERACTION } from "@/lib/world/constants";
import { inputState } from "./inputState";
import type { PlayerApi } from "./usePlayerController";
import { useWorldUI } from "../WorldUIContext";

/**
 * 交互系统（蓝图 §8 全量，阶段 2；阶段 4 移动端交互距离放大）：
 * - 低频采样（约 5Hz）最近项目交互体与当前区域，仅变化时更新 Context；
 * - E / 提示条 / 场景点击 → openDetail(slug) 场景内详情面板
 *   （「在详情页打开」作为面板内双保险入口，路由跳转不再直连）；
 * - 面板打开期间 E 不重复触发（Esc / × / 返回探索关闭）；
 * - 移动端交互半径 ×INTERACTION.mobileRadiusScale（§7 触屏友好）。
 * 场景点击入口在 ProjectIsle 的交互代理 mesh（含拖拽守卫）。
 */
export function InteractionSystem({ player }: { player: PlayerApi }) {
  const { setZone, setPrompt, openDetail, panel, isMobileLike } = useWorldUI();
  const lastZone = useRef<string | null>(null);
  const lastPromptSlug = useRef<string | null>(null);
  const lastToken = useRef(0);
  const frameCounter = useRef(0);

  useFrame(() => {
    frameCounter.current += 1;
    if (frameCounter.current % 12 !== 0) return;

    const p = player.pos.current;
    if (!p) return;

    // 当前区域名牌（变化才上报；带高度参考——茧居所与头顶蝶径分层命名）
    const zone = getZoneName(p.x, p.z, p.y);
    if (zone !== lastZone.current) {
      lastZone.current = zone;
      setZone(zone);
    }

    // 最近项目交互体（触屏半径整体放大，交互锚点含 Moss 舱外监测屏）
    const radiusScale = isMobileLike ? INTERACTION.mobileRadiusScale : 1;
    let bestSlug: string | null = null;
    let bestLabel = "";
    let bestDistance = Infinity;
    for (const item of INTERACTABLES) {
      if (item.type !== "project" || !item.slug) continue;
      const d = Math.hypot(p.x - item.x, p.z - item.z);
      if (d < item.radius * radiusScale && d < bestDistance) {
        bestDistance = d;
        bestSlug = item.slug;
        bestLabel = item.label;
      }
    }
    if (bestSlug !== lastPromptSlug.current) {
      lastPromptSlug.current = bestSlug;
      setPrompt(bestSlug ? { label: bestLabel, slug: bestSlug } : null);
    }

    // E 键触发（token 对账，避免丢按 / 重复触发；面板打开期间不触发）
    if (inputState.interactToken !== lastToken.current) {
      lastToken.current = inputState.interactToken;
      if (bestSlug && panel === null) openDetail(bestSlug);
    }
  });

  return null;
}
