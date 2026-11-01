/**
 * R12.0-C 环境资产升级守护（node:test）：
 * - 数据层：南麓补植落位约束（岛内 / 避让径带 / 避让出生与导览碑）；
 * - 源码层：钉定 G8（岩石/记忆环提亮）、G9（门架冰晶 / 踏板裙边冰棱 /
 *   尺寸微差）、G11（松树色相 / 双层积雪 / 冰冠冠团）、G12（广场铺装 /
 *   蝶枢光环节点）——防止回退成深色剪影与工程件读感。
 * 运行方式：npm test（node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SPAWN_POINT,
  SIGN_POST,
  TRAILS,
  mainIslandSurfaceY,
} from "../lib/world/layout.ts";

const MAIN_ISLAND = { semiAxisX: 18, semiAxisZ: 13 };

/** 点到折线最近距离（2D）——与 layout.ts 的蝶径采样口径一致 */
function distanceToTrail(x, z) {
  let best = Infinity;
  for (const trail of TRAILS) {
    for (let i = 1; i < trail.samples.length; i += 1) {
      const a = trail.samples[i - 1];
      const b = trail.samples[i];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lenSq = abx * abx + abz * abz;
      if (lenSq === 0) continue;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
    }
  }
  return best;
}

test("R12.0-C 南麓补植：两株新松在岛内缓坡、避让径带 / 出生点 / 导览碑", () => {
  const spots = [
    { name: "浅雪盆缘 wind", x: 1.4, z: 10.9 },
    { name: "东南凹谷 broad", x: 9.4, z: 8.4 },
  ];
  for (const spot of spots) {
    const ex = spot.x / MAIN_ISLAND.semiAxisX;
    const ez = spot.z / MAIN_ISLAND.semiAxisZ;
    const r = Math.hypot(ex, ez);
    assert.ok(r <= 0.86, `${spot.name} 归一化半径 ${r.toFixed(3)} 应 ≤0.86（不进观景台铺装带）`);
    const trailDist = distanceToTrail(spot.x, spot.z);
    assert.ok(
      trailDist >= 2.2,
      `${spot.name} 距最近蝶径 ${trailDist.toFixed(2)}m 应 ≥2.2（可行走半宽 1.6 + 余量）`,
    );
    const spawnDist = Math.hypot(spot.x - SPAWN_POINT.x, spot.z - SPAWN_POINT.z);
    assert.ok(spawnDist >= 3.2, `${spot.name} 距出生点 ${spawnDist.toFixed(2)}m 应 ≥3.2`);
    const signDist = Math.hypot(spot.x - SIGN_POST.x, spot.z - SIGN_POST.z);
    assert.ok(signDist >= 2.4, `${spot.name} 距导览碑 ${signDist.toFixed(2)}m 应 ≥2.4`);
    const y = mainIslandSurfaceY(spot.x, spot.z);
    assert.ok(
      y >= 0 && y <= 1.2,
      `${spot.name} 地表高度 ${y.toFixed(2)} 应在缓坡范围（0~1.2）`,
    );
  }
});

test("R12.0-C 源码守护 G8：记忆环暗态改浅浮雕色、岩石最深两档提亮", () => {
  const memoryRing = readFileSync("components/world/objects/MemoryRing.tsx", "utf8");
  assert.match(memoryRing, /#9DB9CE/, "记忆环未点亮瓣应为浅浮雕色");
  assert.doesNotMatch(memoryRing, /#365F7C/, "旧深蓝灰暗态应移除");

  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /#7B9CB8/, "岩石色阶次深档应提亮");
  assert.doesNotMatch(mainIsland, /#6F90AD/, "旧次深档应移除");
});

test("R12.0-C 源码守护 G9：门架冰晶帽 + 横梁提亮 + 踏板裙边/冰棱/尺寸微差", () => {
  const trails = readFileSync("components/world/terrain/Trails.tsx", "utf8");
  assert.match(trails, /CrystalGlowMaterial/, "门架应使用冰晶发光材质");
  assert.match(trails, /cap-\$\{side\}/, "门架柱顶应有冰晶帽实例");
  assert.match(trails, /#7BA0BC/, "横梁应从深金属提亮为灰蓝石材档");
  assert.match(trails, /trail\.id\}-skirt/, "踏板应有裙边实例（纯视觉）");
  assert.match(trails, /trail\.id\}-icicle/, "踏板应有冰棱实例（纯视觉）");
  assert.match(trails, /slabScale/, "石板应有逐块尺寸微差");
  // 踏板位姿数据单源不动：trailDeck 仍只服务 trail-c（碰撞口径不变）
  assert.match(trails, /TRAIL_DECK_IDS/);
});

test("R12.0-C 源码守护 G11：松树色相提亮 + 双层积雪 + 冰冠冠团舒展", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /#457788/, "spire 底层冠色应向青灰-冰绿提亮");
  assert.doesNotMatch(mainIsland, /#3F6E84/, "旧深青底层冠色应移除");
  assert.match(
    mainIsland,
    /tierFromTop === 1 \? 0\.4/,
    "次顶层应有半强度积雪（中距离可读）",
  );
  assert.match(
    mainIsland,
    /\[0\.1, 2\.52, -0\.3, 0\.34\]/,
    "冰冠乔木应有第 4 小冠团（棒棒糖剪影修复）",
  );
  assert.match(mainIsland, /x: 1\.4, z: 10\.9/, "南麓补植 #1 应存在");
  assert.match(mainIsland, /x: 9\.4, z: 8\.4/, "南麓补植 #2 应存在");
  assert.match(mainIsland, /x: 0\.2, z: 9\.8/, "南麓补植灌木应存在");
});

test("R12.0-C 源码守护 G12：广场铺装对比拉开 + 蝶枢光环节点 / 内芯光柱", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /#A4BCD0/, "广场扇面铺装应加深拉开对比");
  assert.match(mainIsland, /#8DA9BF/, "入口嵌线应加深拉开对比");

  const butterflyCore = readFileSync("components/world/objects/ButterflyCore.tsx", "utf8");
  assert.match(butterflyCore, /length: 8/, "主环应有 8 个冰晶节点");
  assert.match(butterflyCore, /0\.05, 0\.14, 4\.4/, "光柱应有更亮的内芯层");
});
