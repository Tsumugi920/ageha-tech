/**
 * R12.0-B 主岛与屿体地貌精修守护（node:test）：
 * - 几何层：竖向破口场的行为契约（顶环保护 / 破口深度 / 打断环带）、
 *   层带跳变的边界（y 不越界）、三屿 organic 化后几何仍有界；
 * - 颜色层：岩层色带台阶（中段 / 深部可读明度差）；
 * - 源码层：钉定主岛与三屿的破口 / organic 参数，防止回退成光滑叠板。
 * 运行方式：npm test（node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createLayeredIslandGeometry,
  islandBreachField,
} from "../components/world/terrain/islandGeometry.ts";

/** 主岛岩体参数（与 MainIsland.tsx rockGeometry 调用一致） */
const MAIN_ROCK = {
  radiusX: 18,
  radiusZ: 13,
  depth: 17.5,
  seed: 2.17,
  jaggedness: 0.09,
  segments: 120,
  profile: "headland",
  strataTilt: 0.085,
  buttressCount: 7,
  buttressDepth: 0.075,
  layerJitter: 0.034,
};

test("R12.0-B 破口场：顶环与上檐完全不受破口影响（雪檐接缝保护）", () => {
  for (let i = 0; i < 64; i += 1) {
    const theta = (i / 64) * Math.PI * 2;
    for (const depthRatio of [0, 0.06, 0.12, 0.19, 0.25, 0.29]) {
      const field = islandBreachField(theta, depthRatio, 2.17, 3, 0);
      assert.equal(field.cut, 0, `depthRatio=${depthRatio} 应无破口`);
      assert.equal(field.lip, 0);
    }
  }
});

test("R12.0-B 破口场：中下部出现 ≥breachCount 个独立深切区（环带被打断）", () => {
  for (const depthRatio of [0.55, 0.7, 0.85]) {
    const samples = 720;
    const hot = [];
    for (let i = 0; i < samples; i += 1) {
      const theta = (i / samples) * Math.PI * 2;
      if (islandBreachField(theta, depthRatio, 2.17, 3, 4).cut > 0.55) {
        hot.push(i);
      }
    }
    // 聚类：相邻采样索引连续视为同一破口（绕环折叠）
    const clusters = [];
    for (const index of hot) {
      const last = clusters[clusters.length - 1];
      if (last && index - last[last.length - 1] <= 2) last.push(index);
      else clusters.push([index]);
    }
    if (clusters.length > 1) {
      const first = clusters[0];
      const last = clusters[clusters.length - 1];
      if (first[0] === 0 && last[last.length - 1] === samples - 1) {
        clusters.pop();
        clusters[0] = [...last, ...first];
      }
    }
    assert.ok(
      clusters.length >= 3,
      `depthRatio=${depthRatio} 破口聚类 ${clusters.length} 应 ≥3`,
    );
  }
});

test("R12.0-B 破口场：零破口参数返回零场（远景岛 / 旧调用不受影响）", () => {
  for (let i = 0; i < 32; i += 1) {
    const theta = (i / 32) * Math.PI * 2;
    const field = islandBreachField(theta, 0.8, 9.4, 0, 3);
    assert.equal(field.cut, 0);
    assert.equal(field.lip, 0);
  }
});

test("R12.0-B 破口几何：中下部出现比无破口版本深 ≥40% 破口深度的切进", () => {
  const without = createLayeredIslandGeometry({ ...MAIN_ROCK, breachCount: 0 });
  const withBreach = createLayeredIslandGeometry({ ...MAIN_ROCK, breachCount: 3, breachDepth: 0.15 });
  const collect = (geometry) => {
    const position = geometry.getAttribute("position");
    const minRadiusByBin = new Map();
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (y > -0.35 * MAIN_ROCK.depth || y < -0.9 * MAIN_ROCK.depth) continue;
      const radius = Math.hypot(x / MAIN_ROCK.radiusX, z / MAIN_ROCK.radiusZ);
      const bin = Math.floor(
        ((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 72,
      );
      const key = `${bin}`;
      minRadiusByBin.set(key, Math.min(minRadiusByBin.get(key) ?? 2, radius));
    }
    return minRadiusByBin;
  };
  const base = collect(without);
  const breached = collect(withBreach);
  let deepestCut = 0;
  for (const [bin, radius] of breached) {
    const reference = base.get(bin);
    if (reference !== undefined) {
      deepestCut = Math.max(deepestCut, reference - radius);
    }
  }
  assert.ok(
    deepestCut >= 0.04,
    `最大切进 ${deepestCut.toFixed(4)} 应 ≥ 0.04（破口真实改变几何）`,
  );
  without.dispose();
  withBreach.dispose();
});

test("R12.0-B 顶环保护：雪檐接缝处顶点（y > −0.4m，ring0–2）在开/关破口间逐位一致", () => {
  const without = createLayeredIslandGeometry({ ...MAIN_ROCK, breachCount: 0 });
  const withBreach = createLayeredIslandGeometry({ ...MAIN_ROCK, breachCount: 3, breachDepth: 0.15 });
  const a = without.getAttribute("position");
  const b = withBreach.getAttribute("position");
  assert.equal(a.count, b.count, "顶点数应一致（只位移、不增减）");
  let checked = 0;
  const axisGet = { x: (attr, i) => attr.getX(i), y: (attr, i) => attr.getY(i), z: (attr, i) => attr.getZ(i) };
  for (let i = 0; i < a.count; i += 1) {
    // 层理倾斜会把中深层顶点抬进高 y 区，绝对 y 阈值只框住 ring0–2
    // （headland 前三层 yFrac ≤0.032 → y ≥ −0.56m；ring3 起 ≤ −0.86m）
    if (a.getY(i) < -0.4) continue;
    checked += 1;
    for (const axis of ["x", "y", "z"]) {
      assert.ok(
        Math.abs(axisGet[axis](a, i) - axisGet[axis](b, i)) < 1e-9,
        `顶点 ${i}.${axis} 应完全一致（破口不影响雪檐接缝）`,
      );
    }
  }
  assert.ok(checked > 1000, `接缝区域顶点数 ${checked} 应 >1000（抽样有效）`);
  without.dispose();
  withBreach.dispose();
});

test("R12.0-B 层带跳变：主岛与三屿几何全部顶点 y 有界（层序不越界）", () => {
  const cases = [
    { name: "主岛", params: { ...MAIN_ROCK, breachCount: 3, breachDepth: 0.15 } },
    {
      name: "档案塔屿",
      params: { radiusX: 12, radiusZ: 12, depth: 7.2, seed: -3.82, jaggedness: 0.12, segments: 56, profile: "mesa", strataTilt: 0.075, buttressCount: 5, buttressDepth: 0.06, layerJitter: 0.026, breachCount: 2, breachDepth: 0.16 },
    },
    {
      name: "日程屿",
      params: { radiusX: 13, radiusZ: 13, depth: 10.14, seed: -2.84, jaggedness: 0.095, segments: 56, profile: "shard", strataTilt: 0.065, buttressCount: 5, buttressDepth: 0.06, layerJitter: 0.02, breachCount: 2, breachDepth: 0.1 },
    },
    {
      name: "写作穹舱屿",
      params: { radiusX: 11, radiusZ: 11, depth: 9.24, seed: 11.44, jaggedness: 0.1, segments: 56, profile: "rooted", strataTilt: 0.06, buttressCount: 5, buttressDepth: 0.055, layerJitter: 0.02, breachCount: 2, breachDepth: 0.09 },
    },
  ];
  for (const { name, params } of cases) {
    const geometry = createLayeredIslandGeometry(params);
    const position = geometry.getAttribute("position");
    let minY = 0;
    let maxY = 0;
    for (let i = 0; i < position.count; i += 1) {
      minY = Math.min(minY, position.getY(i));
      maxY = Math.max(maxY, position.getY(i));
    }
    assert.ok(
      maxY <= 0.02,
      `${name} 最高顶点 ${maxY.toFixed(3)} 不应超出顶面`,
    );
    assert.ok(
      minY >= -params.depth * 1.02 - 0.2,
      `${name} 最低顶点 ${minY.toFixed(3)} 不应穿透岛底`,
    );
    geometry.dispose();
  }
});

test("R12.0-B 色带台阶：中段带与深部带的平均明度差可读（≥0.05）", () => {
  const geometry = createLayeredIslandGeometry({
    ...MAIN_ROCK,
    breachCount: 3,
    breachDepth: 0.15,
  });
  const position = geometry.getAttribute("position");
  const color = geometry.getAttribute("color");
  const luminance = (i) => 0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
  const slab = (y0, y1) => {
    let sum = 0;
    let count = 0;
    // 非索引几何：顶点 i 的颜色属性就在 color 索引 i（与 position 同布局）
    for (let i = 0; i < position.count; i += 3) {
      const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
      if (y >= y0 && y <= y1) {
        sum += (luminance(i) + luminance(i + 1) + luminance(i + 2)) / 3;
        count += 1;
      }
    }
    return sum / Math.max(1, count);
  };
  const mid = slab(-0.5 * MAIN_ROCK.depth, -0.42 * MAIN_ROCK.depth);
  const deep = slab(-0.82 * MAIN_ROCK.depth, -0.74 * MAIN_ROCK.depth);
  assert.ok(
    mid - deep >= 0.05,
    `中段 ${mid.toFixed(3)} 与深部 ${deep.toFixed(3)} 明度差应 ≥0.05`,
  );
  geometry.dispose();
});

test("R12.0-B 源码守护：主岛破口参数与三屿 organic 化参数钉定", () => {
  const mainIsland = readFileSync("components/world/terrain/MainIsland.tsx", "utf8");
  assert.match(mainIsland, /breachCount: 3/);
  assert.match(mainIsland, /breachDepth: 0\.15/);

  const projectIsle = readFileSync("components/world/objects/ProjectIsle.tsx", "utf8");
  assert.match(projectIsle, /strataTilt:/, "三屿应开启层理倾斜");
  assert.match(projectIsle, /buttressCount: 5/, "三屿应开启沟槽");
  assert.match(projectIsle, /breachCount: 2/, "三屿应有竖向破口");
  assert.match(projectIsle, /0\.095/, "日程屿 jaggedness 应加档");
  assert.match(projectIsle, /0\.12/, "档案塔屿 jaggedness 应单独加档（G5）");
  assert.match(projectIsle, /0\.16/, "档案塔屿破口应加深（G5）");
});
