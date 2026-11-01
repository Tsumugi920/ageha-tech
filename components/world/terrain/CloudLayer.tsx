"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sprite, SpriteMaterial } from "three";
import { createSoftBlobTexture } from "./SkyDome";
import { WORLD_SCALE } from "@/lib/world";
import type { TierParams } from "@/lib/world/performance";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";

/**
 * 云层（蓝图 §2.2：y +30~60 环带 billboard 云，canvas 本地生成纹理）。
 * 位置用确定性伪随机（索引驱动三角函数），无 SSR 不确定性；
 * 两档透明度（远淡近实）+ 高低两条带，读出云的层次；
 * 极慢环绕漂移（角速度 ≤0.01 rad/s，几乎凝住的天象）；
 * reduced-motion 冻结。Sprite 一次性创建复用，数量随性能档，
 * 卸载时 dispose 材质 / 纹理。
 */
export function CloudLayer({ tier }: { tier: TierParams }) {
  const reducedMotion = usePrefersReducedMotion();
  const texture = useMemo(() => createSoftBlobTexture(), []);
  // 两档材质（远带更淡），按索引轮换复用
  // R12.0-D（G10）：透明度与体量各提一档——旧云在 380 穹顶下几乎
  // 不可读（18 号仰视机位近乎空白天空），增强后地平线有可读的天象
  const materials = useMemo(
    () => [
      new SpriteMaterial({ map: texture, transparent: true, opacity: 0.7, depthWrite: false }),
      new SpriteMaterial({ map: texture, transparent: true, opacity: 0.45, depthWrite: false }),
    ],
    [texture],
  );

  const clouds = useMemo(() => {
    const [minY, maxY] = WORLD_SCALE.cloudBandY;
    const list: Array<{
      sprite: Sprite;
      angle: number;
      radius: number;
      y: number;
      drift: number;
    }> = [];
    for (let i = 0; i < tier.clouds; i += 1) {
      const material = materials[i % 2];
      const angle = i * 2.399963 + 0.7;
      // 半径 80~150、云团 40~78：贴着地平线的两档云带（R12.0-D 加大），
      // 在蝶枢与远景岛之间提供尺度参照，但保持低对比、不抢主视觉。
      const radius = 80 + ((i * 53) % 100) * 0.7;
      const scale = 40 + ((i * 17) % 38);
      const sprite = new Sprite(material);
      const y = i % 2 === 0 ? minY + ((i * 13) % 12) : maxY - ((i * 29) % 14);
      sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      sprite.scale.set(scale, scale * 0.42, 1);
      list.push({
        sprite,
        angle,
        radius,
        y,
        // 极慢漂移（±方向交替，12~20 分钟一周的量级）
        drift: 0.006 + ((i * 31) % 100) / 100 * 0.006,
      });
    }
    return list;
  }, [materials, tier.clouds]);

  const anglesRef = useRef<number[]>(clouds.map((c) => c.angle));
  const frameRef = useRef(0);
  const pendingDelta = useRef(0);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    // 云漂移是分钟级运动：每 12 帧更新一次（60Hz 下约 5Hz）即可，
    // 把逐帧 5 次 sprite 位置写入从主线程移除。
    pendingDelta.current += delta;
    frameRef.current += 1;
    if (frameRef.current % 12 !== 0) return;
    const step = pendingDelta.current;
    pendingDelta.current = 0;
    for (let i = 0; i < clouds.length; i += 1) {
      anglesRef.current[i] += clouds[i].drift * step * (i % 2 === 0 ? 1 : -1);
      const a = anglesRef.current[i];
      clouds[i].sprite.position.set(
        Math.cos(a) * clouds[i].radius,
        clouds[i].y,
        Math.sin(a) * clouds[i].radius,
      );
    }
  });

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
      texture.dispose();
    },
    [materials, texture],
  );

  return (
    <group>
      {clouds.map((cloud, i) => (
        <primitive key={i} object={cloud.sprite} />
      ))}
    </group>
  );
}
