"use client";

import { useEffect, useMemo } from "react";
import { Sprite, SpriteMaterial } from "three";
import { createSoftBlobTexture } from "./SkyDome";
import { WORLD_SCALE } from "@/lib/world";
import type { TierParams } from "@/lib/world/performance";

/**
 * 云层（蓝图 §2.2：y +30~60 环带 billboard 云，canvas 本地生成纹理）。
 * 位置用确定性伪随机（索引驱动三角函数），无 SSR 不确定性；
 * Sprite 一次性创建复用，数量随性能档位（lib/world/performance.ts），
 * 卸载时 dispose 材质 / 纹理 / 精灵。
 */
export function CloudLayer({ tier }: { tier: TierParams }) {
  const texture = useMemo(() => createSoftBlobTexture(), []);
  const material = useMemo(
    () =>
      new SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [texture],
  );

  const sprites = useMemo(() => {
    const [minY, maxY] = WORLD_SCALE.cloudBandY;
    const list: Sprite[] = [];
    for (let i = 0; i < tier.clouds; i += 1) {
      const angle = i * 2.399963 + 0.7;
      const radius = 96 + ((i * 53) % 150);
      const scale = 30 + ((i * 17) % 26);
      const sprite = new Sprite(material);
      sprite.position.set(
        Math.cos(angle) * radius,
        minY + ((i * 13) % (maxY - minY)),
        Math.sin(angle) * radius,
      );
      sprite.scale.set(scale, scale * 0.42, 1);
      list.push(sprite);
    }
    return list;
  }, [material, tier.clouds]);

  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );

  return (
    <group>
      {sprites.map((sprite, i) => (
        <primitive key={i} object={sprite} />
      ))}
    </group>
  );
}
