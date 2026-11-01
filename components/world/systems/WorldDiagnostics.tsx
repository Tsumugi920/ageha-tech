"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { getGroundHeight } from "@/lib/world/layout";
import { cameraState } from "./inputState";
import { useQuality } from "./AdaptiveQuality";
import type { PlayerApi } from "./usePlayerController";

type WorldStateSnapshot = {
  at: number;
  player: { x: number; y: number; z: number };
  camera: { x: number; y: number; z: number };
  ground: number | null;
  cameraState: { yaw: number; pitch: number; distanceIndex: number };
  viewport: { width: number; height: number; aspect: number };
};

type WorldRenderInfo = {
  tier: string;
  dpr: number;
  calls: number;
  triangles: number;
  lines: number;
  points: number;
  programs: number;
  geometries: number;
  textures: number;
  canvas: { width: number; height: number };
};

/**
 * 世界状态 / 渲染统计探针（仅开发态或 ?debug=1 下注册）。
 * 生产访问者不会拿到内部状态；验收脚本用 ?debug=1 获取真实
 * draw call / 三角形 / DPR / 档位，而不是只看截图猜性能。
 */
function diagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    process.env.NODE_ENV !== "production" ||
    new URLSearchParams(window.location.search).has("debug")
  );
}

/** 调试用场景索引隐藏；放在组件外，避免直接改写 hook 返回的三维场景值 */
function applyHidePaths(
  scene: import("three").Object3D,
  raw: string,
): void {
  for (const path of raw.split(",")) {
    const indices = path.split(".").map(Number);
    if (indices.some((n) => !Number.isInteger(n) || n < 0)) continue;
    let node: import("three").Object3D | null = scene;
    for (const index of indices) {
      if (!node || index >= node.children.length) {
        node = null;
        break;
      }
      node = node.children[index];
    }
    if (node) node.visible = false;
  }
}

/** R11.5：?hideName=trail-c-curb,...——按对象精确名称隐藏（单对象隔离） */
function applyHideNames(
  scene: import("three").Object3D,
  raw: string,
): void {
  const names = new Set(raw.split(","));
  scene.traverse((node) => {
    if (node.name && names.has(node.name)) node.visible = false;
  });
}

export function WorldDiagnostics({ player }: { player: PlayerApi }) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const { tier } = useQuality();
  const frame = useRef(0);
  const enabled = useMemo(() => diagnosticsEnabled(), []);

  useEffect(() => {
    if (!enabled) return;
    // R11.1：暴露场景根——验收脚本可对截图中的可疑对象做射线拾取，
    // 定位「画面里这是什么」而不必靠猜（配合 __AGEHA_WORLD_STATE__）。
    // R11.5：移入 useEffect——场景引用稳定，且不受遮挡时 rAF 暂停影响
    window.__AGEHA_SCENE__ = scene;
    // R11.2 验收排查工具（同 ?tier/?cam 的调试约定）：?hide=13 或
    // ?hide=13.2——按场景子节点索引路径隐藏对应组，用于无头二分
    // 定位「画面里某结构属于哪个组件」。仅在诊断开启时生效。
    // R11.5：?hideName=trail-c-curb,...——按对象名称单对象隔离。
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("hide");
    if (raw) applyHidePaths(scene, raw);
    const rawNames = params.get("hideName");
    if (rawNames) applyHideNames(scene, rawNames);
  }, [enabled, scene]);

  useFrame(() => {
    if (!enabled) return;
    frame.current += 1;
    if (frame.current % 6 !== 0) return;
    const p = player.pos.current;
    window.__AGEHA_WORLD_STATE__ = (): WorldStateSnapshot => ({
      at: performance.now(),
      player: { x: p.x, y: p.y, z: p.z },
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      ground: getGroundHeight(p.x, p.z, p.y),
      cameraState: {
        yaw: cameraState.yaw,
        pitch: cameraState.pitch,
        distanceIndex: cameraState.distanceIndex,
      },
      viewport: {
        width: size.width,
        height: size.height,
        aspect: size.width / Math.max(1, size.height),
      },
    });
    window.__AGEHA_WORLD_INFO__ = (): WorldRenderInfo => ({
      tier: tier.tier,
      dpr: gl.getPixelRatio(),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      lines: gl.info.render.lines,
      points: gl.info.render.points,
      programs: gl.info.programs?.length ?? 0,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      canvas: { width: gl.domElement.width, height: gl.domElement.height },
    });
  });

  return null;
}

declare global {
  interface Window {
    __AGEHA_WORLD_STATE__?: () => WorldStateSnapshot;
    __AGEHA_WORLD_INFO__?: () => WorldRenderInfo;
    __AGEHA_SCENE__?: import("three").Scene;
  }
}
