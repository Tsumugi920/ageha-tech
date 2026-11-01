"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  MathUtils,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  type Group,
} from "three";
import { WORLD_ASSET_PATHS } from "@/lib/world/constants";
import { NOOK_CORRIDOR_SAMPLES, TRAILS } from "@/lib/world/layout";
import type { TierParams } from "@/lib/world/performance";
import { MOTION } from "../systems/worldMotion";
import { useIdleSeconds } from "../systems/useIdleSeconds";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import type { PlayerApi } from "../systems/usePlayerController";

/**
 * 星尘蝶群（蓝图 §5.3 氛围 + §9.2 彩蛋线索）：
 * - 透明底蝶形精灵（不是应用方形图标；路径仍取 WORLD_ASSET_PATHS 数据
 *   登记）聚于三蝶径中段与茧居所入口，数量克制
 *   （high 8 / medium 4 / low 3，§12.1）；
 * - 翼面通过 Sprite 横向压缩模拟扇动，避免静态贴片感；
 * - 隐藏彩蛋：玩家原地静立 20s → 蝶群绕玩家聚成一圈短舞（14s，纯氛围
 *   奖励，无文案宣称），玩家一动即散回原聚集地；
 * - reduced-motion：冻结在当前帧（§12.3）。
 * 每帧只写 Sprite.position / scale refs，零逐帧 React 状态。
 */

/** 聚集锚点：三蝶径中段 + 茧居所入口（阶段 3 彩蛋线索指向） */
const ANCHORS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  ...TRAILS.map((trail) => trail.samples[Math.floor(trail.samples.length / 2)]),
  NOOK_CORRIDOR_SAMPLES[2],
];

/** 精灵纹理的色彩配置（模块级命令式入口，见 configureScreenTexture 注） */
function configureSpriteTexture(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

/** 单蝶参数（确定性伪随机，索引驱动，无 SSR 不确定性） */
type FlockUnit = {
  anchor: { x: number; y: number; z: number };
  angle: number;
  angularSpeed: number;
  orbitRadius: number;
  heightOffset: number;
  bobPhase: number;
  scale: number;
  flapSpeed: number;
  position: Vector3;
};

/**
 * 蝶群逐帧推进（模块级命令式入口——units/sprites 为 useMemo 产物，
 * 组件闭包内直接改写会被 react-hooks/immutability 拦截，同 tickBars 口径）：
 * 常态绕聚集地缓绕 + 升沉；聚舞（彩蛋）时收拢绕玩家环绕。
 */
function tickFlock(
  units: FlockUnit[],
  sprites: Sprite[],
  gather: { left: number },
  idleSeconds: number,
  playerPos: Vector3,
  t: number,
  delta: number,
): void {
  // 彩蛋触发：静止 ≥20s 开聚（14s）；玩家一动（idle 清零）即散
  if (idleSeconds >= MOTION.flockGatherIdleSeconds && gather.left <= 0) {
    gather.left = MOTION.flockGatherDurationSeconds;
  }
  if (gather.left > 0) {
    gather.left -= delta;
    if (idleSeconds < MOTION.flockGatherIdleSeconds) gather.left = 0;
  }
  const gathering = gather.left > 0;

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    // 聚舞时同向环绕加速；常态按各自角速度（含方向）缓绕聚集地
    const orbitSpeed = gathering
      ? 0.9 * Math.sign(unit.angularSpeed || 1)
      : unit.angularSpeed;
    unit.angle += orbitSpeed * delta;
    const radius = gathering ? 2.1 + (unit.orbitRadius - 1.8) * 0.3 : unit.orbitRadius;
    const cx = gathering ? playerPos.x : unit.anchor.x;
    const cz = gathering ? playerPos.z : unit.anchor.z;
    const baseY = gathering
      ? playerPos.y + 0.9 + unit.heightOffset * 0.35
      : unit.anchor.y + unit.heightOffset;
    const targetX = cx + Math.cos(unit.angle) * radius;
    const targetZ = cz + Math.sin(unit.angle) * radius;
    const targetY = baseY + Math.sin(t * 1.4 + unit.bobPhase) * 0.35;
    // 位置指数平滑：聚拢 / 散回自然过渡
    unit.position.x = MathUtils.damp(unit.position.x, targetX, 2.4, delta);
    unit.position.y = MathUtils.damp(unit.position.y, targetY, 2.4, delta);
    unit.position.z = MathUtils.damp(unit.position.z, targetZ, 2.4, delta);
    const sprite = sprites[i];
    sprite.position.copy(unit.position);
    // 横向压缩 = 翅膀前后扇动的透视错觉；比每只蝶单独建网格便宜得多
    const flap = 0.58 + Math.abs(Math.sin(t * unit.flapSpeed + unit.bobPhase)) * 0.42;
    sprite.scale.set(unit.scale * flap, unit.scale, 1);
  }
}

export function ButterflyFlock({
  player,
  tier,
}: {
  player: PlayerApi;
  tier: TierParams;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const idle = useIdleSeconds(player);
  const groupRef = useRef<Group>(null);
  const frameRef = useRef(0);
  const pendingDelta = useRef(0);

  const texture = useTexture(WORLD_ASSET_PATHS.butterflySprite);
  useEffect(() => {
    configureSpriteTexture(texture);
  }, [texture]);

  const material = useMemo(
    () =>
      new SpriteMaterial({
        map: texture,
        color: "#FFFFFF",
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      }),
    [texture],
  );

  const units = useMemo<FlockUnit[]>(() => {
    const list: FlockUnit[] = [];
    for (let i = 0; i < tier.butterflySprites; i += 1) {
      const anchor = ANCHORS[i % ANCHORS.length];
      list.push({
        anchor,
        angle: i * 2.399963,
        angularSpeed: (0.12 + ((i * 53) % 100) / 100 * 0.22) * (i % 2 === 0 ? 1 : -1),
        orbitRadius: 2.4 + ((i * 37) % 100) / 100 * 3.0,
        heightOffset: 1.9 + ((i * 29) % 100) / 100 * 2.4,
        bobPhase: i * 1.7,
        scale: 0.4 + ((i * 13) % 7) / 7 * 0.2,
        flapSpeed: 5.2 + ((i * 31) % 5) * 0.8,
        position: new Vector3(anchor.x, anchor.y + 2, anchor.z),
      });
    }
    return list;
  }, [tier.butterflySprites]);

  const sprites = useMemo(
    () => units.map((unit) => {
      const sprite = new Sprite(material);
      sprite.scale.set(unit.scale, unit.scale, 1);
      sprite.position.copy(unit.position);
      return sprite;
    }),
    [units, material],
  );

  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  // 彩蛋状态（refs）：聚舞剩余时长（≤0 表示未在聚舞）
  const gatherRef = useRef({ left: 0 });

  useFrame((state, rawDelta) => {
    if (reducedMotion) return; // 冻结在当前帧
    // 蝶群是氛围层：半帧率（60Hz 下约 30Hz）+ 累积 delta，保持轨迹连续且减半 CPU
    pendingDelta.current += Math.min(rawDelta, 1 / 30);
    frameRef.current += 1;
    if (frameRef.current % 2 !== 0) return;
    const step = pendingDelta.current;
    pendingDelta.current = 0;
    tickFlock(
      units,
      sprites,
      gatherRef.current,
      idle.current,
      player.pos.current as Vector3,
      state.clock.elapsedTime,
      step,
    );
  });

  if (units.length === 0) return null;

  return (
    <group ref={groupRef}>
      {sprites.map((sprite, i) => (
        <primitive key={i} object={sprite} />
      ))}
    </group>
  );
}
