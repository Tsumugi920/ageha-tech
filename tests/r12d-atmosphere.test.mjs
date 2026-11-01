/**
 * R12.0-D 材质光照与天空海面守护（node:test）：
 * - 几何层：atmosphereFade 只改颜色不改形状（位置逐位一致）且确实提亮；
 * - 源码层：钉定冰海镜像平铺、天穹雾色带、云带增强、曝光再平衡、
 *   远景岛参数与冰晶尖塔——防止回退成深色剪影 / 方格海面 / 空白天空。
 * 运行方式：npm test（node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createIslandTopGeometry,
  createLayeredIslandGeometry,
} from "../components/world/terrain/islandGeometry.ts";

const DISTANT_ROCK = {
  radiusX: 10,
  radiusZ: 10,
  depth: 9.5,
  seed: 4.6,
  jaggedness: 0.085,
  segments: 40,
  profile: "mesa",
};

test("R12.0-D atmosphereFade：只改颜色不改形状（顶点位置逐位一致）", () => {
  const base = createLayeredIslandGeometry(DISTANT_ROCK);
  const faded = createLayeredIslandGeometry({ ...DISTANT_ROCK, atmosphereFade: 0.42 });
  const a = base.getAttribute("position");
  const b = faded.getAttribute("position");
  assert.equal(a.count, b.count);
  for (let i = 0; i < a.count; i += 1) {
    assert.equal(a.getX(i), b.getX(i));
    assert.equal(a.getY(i), b.getY(i));
    assert.equal(a.getZ(i), b.getZ(i));
  }
  base.dispose();
  faded.dispose();
});

test("R12.0-D atmosphereFade：岩体显著提亮，顶面向雾色调收敛（不再过曝发白）", () => {
  const luminance = (geometry) => {
    const color = geometry.getAttribute("color");
    let sum = 0;
    for (let i = 0; i < color.count; i += 1) {
      sum += 0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
    }
    return sum / color.count;
  };
  // 线性空间雾色调 #C6DCEB
  const tone = { x: 0.552, y: 0.717, z: 0.83 };
  const toneDistance = (geometry) => {
    const color = geometry.getAttribute("color");
    let sum = 0;
    for (let i = 0; i < color.count; i += 1) {
      sum += Math.hypot(
        color.getX(i) - tone.x,
        color.getY(i) - tone.y,
        color.getZ(i) - tone.z,
      );
    }
    return sum / color.count;
  };
  const base = createLayeredIslandGeometry(DISTANT_ROCK);
  const faded = createLayeredIslandGeometry({ ...DISTANT_ROCK, atmosphereFade: 0.42 });
  const lift = luminance(faded) / luminance(base);
  assert.ok(lift >= 1.15, `岩体提亮比 ${lift.toFixed(3)} 应 ≥1.15`);
  base.dispose();
  faded.dispose();

  // 顶面（雪色为主）的语义是「向雾色收敛」：雪不再远看发白发亮，
  // 深色裙边提亮——平均色与雾色调的距离应显著缩短
  const topBase = createIslandTopGeometry({ ...DISTANT_ROCK, rings: 12 });
  const topFaded = createIslandTopGeometry({ ...DISTANT_ROCK, rings: 12, atmosphereFade: 0.38 });
  const distBefore = toneDistance(topBase);
  const distAfter = toneDistance(topFaded);
  assert.ok(
    distAfter <= distBefore * 0.75,
    `顶面到雾色调距离 ${distBefore.toFixed(3)}→${distAfter.toFixed(3)} 应收敛 ≥25%`,
  );
  topBase.dispose();
  topFaded.dispose();
});

test("R12.0-D 源码守护：冰海镜像平铺 / 天穹雾色带 / 云带增强", () => {
  const iceSea = readFileSync("components/world/terrain/IceSea.tsx", "utf8");
  assert.match(iceSea, /MirroredRepeatWrapping/, "冰海应使用镜像平铺（消除方格接缝）");
  assert.doesNotMatch(
    iceSea,
    /^\s{2}RepeatWrapping,/m,
    "不应残留普通 RepeatWrapping 导入",
  );

  const skyDome = readFileSync("components/world/terrain/SkyDome.tsx", "utf8");
  assert.match(skyDome, /WORLD_COLORS\.fog/, "天穹海天线以下应对齐雾色（消除拼接线）");

  const cloudLayer = readFileSync("components/world/terrain/CloudLayer.tsx", "utf8");
  assert.match(cloudLayer, /opacity: 0\.7/, "云带近档透明度应增强");
  assert.match(cloudLayer, /opacity: 0\.45/, "云带远档透明度应增强");
  assert.match(cloudLayer, /40 \+ \(\(i \* 17\) % 38\)/, "云团体量应加大");
});

test("R12.0-D 源码守护：曝光再平衡 / 阴影微调 / 远景岛大气提亮", () => {
  const sunLight = readFileSync("components/world/systems/SunLight.tsx", "utf8");
  assert.match(sunLight, /intensity=\{2\.45\}/, "主光应收敛到 2.45");
  assert.match(sunLight, /shadow-normalBias=\{0\.032\}/, "阴影 normalBias 应微调");

  const worldCanvas = readFileSync("components/world/WorldCanvas.tsx", "utf8");
  assert.match(worldCanvas, /intensity=\{0\.47\}/, "半球光应补偿到 0.47");
  assert.match(worldCanvas, /intensity=\{0\.46\}/, "冷填光应补偿到 0.46");

  const distantIsles = readFileSync("components/world/terrain/DistantIsles.tsx", "utf8");
  assert.match(distantIsles, /atmosphereFade: 0\.42/, "远景岛岩体应烘焙大气透视");
  assert.match(distantIsles, /atmosphereFade: 0\.38/, "远景岛顶面应烘焙大气透视");
  assert.match(distantIsles, /octahedronGeometry/, "NW 岛竖向剪影应为冰晶尖塔");
});
