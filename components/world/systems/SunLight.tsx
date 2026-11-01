"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D, Vector3, type DirectionalLight } from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import type { PlayerApi } from "./usePlayerController";

const SUN_OFFSET = new Vector3(52, 46, -30);
const GRID = 2;

/**
 * 主光随行（R3）：平行光与阴影相机跟随玩家所在地形片区。
 * R2 的固定阴影框只罩主岛 ±48，三屿在框外完全没有接触阴影；
 * 现在以玩家为中心（2m 网格吸附，避免逐帧阴影抖动）重定位，
 * 主岛 / 三屿 / 蝶径在当前视野内都有真实的投影关系。
 */
export function SunLight({
  player,
  shadowsEnabled,
}: {
  player: PlayerApi;
  shadowsEnabled: boolean;
}) {
  const lightRef = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const snapped = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.target = target;
  }, [target]);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const p = player.pos.current;
    snapped.set(
      Math.round(p.x / GRID) * GRID,
      Math.round((p.y - 0.35) / GRID) * GRID,
      Math.round(p.z / GRID) * GRID,
    );
    target.position.copy(snapped);
    light.position.set(
      snapped.x + SUN_OFFSET.x,
      snapped.y + SUN_OFFSET.y,
      snapped.z + SUN_OFFSET.z,
    );
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        color={WORLD_COLORS.sunLight}
        // R12.0-D（G7）：2.7→2.45——雪面高键曝光收敛，配合半球/填光补偿
        intensity={2.45}
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={8}
        shadow-camera-far={150}
        shadow-bias={-0.0002}
        // R12.0-D（G13）：0.028→0.032——白色表面上的硬黑腿影边缘再柔半档
        shadow-normalBias={0.032}
      />
    </>
  );
}
