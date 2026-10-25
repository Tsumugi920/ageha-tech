"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useFrame } from "@react-three/fiber";
import { INTERACTABLES } from "@/lib/world/colliders";
import { getZoneName } from "@/lib/world/layout";
import { inputState } from "./inputState";
import type { PlayerApi } from "./usePlayerController";
import { useWorldUI } from "../WorldUIContext";

/**
 * 交互系统（阶段 1 最小闭环，蓝图 §8 全量交互在阶段 2 落地）：
 * - 低频采样（约 5Hz）最近项目交互体与当前区域，仅变化时更新 Context；
 * - E / 提示条点击触发 → 跳转 /projects/<slug> 详情路由（阶段 2 改为
 *   场景内详情面板，路由作为「在详情页打开」双保险保留）。
 */
export function InteractionSystem({ player }: { player: PlayerApi }) {
  const router = useRouter();
  const { setZone, setPrompt } = useWorldUI();
  const lastZone = useRef<string | null>(null);
  const lastPromptSlug = useRef<string | null>(null);
  const lastToken = useRef(0);
  const frameCounter = useRef(0);

  useFrame(() => {
    frameCounter.current += 1;
    if (frameCounter.current % 12 !== 0) return;

    const p = player.pos.current;

    // 当前区域名牌（变化才上报）
    const zone = getZoneName(p.x, p.z);
    if (zone !== lastZone.current) {
      lastZone.current = zone;
      setZone(zone);
    }

    // 最近项目交互体（半径 6 内）
    let bestSlug: string | null = null;
    let bestLabel = "";
    let bestDistance = Infinity;
    for (const item of INTERACTABLES) {
      if (item.type !== "project" || !item.slug) continue;
      const d = Math.hypot(p.x - item.x, p.z - item.z);
      if (d < item.radius && d < bestDistance) {
        bestDistance = d;
        bestSlug = item.slug;
        bestLabel = item.label;
      }
    }
    if (bestSlug !== lastPromptSlug.current) {
      lastPromptSlug.current = bestSlug;
      setPrompt(bestSlug ? { label: bestLabel, slug: bestSlug } : null);
    }

    // E 键触发（token 对账，避免丢按 / 重复触发）
    if (inputState.interactToken !== lastToken.current) {
      lastToken.current = inputState.interactToken;
      if (bestSlug) router.push(`/projects/${bestSlug}`);
    }
  });

  return null;
}
