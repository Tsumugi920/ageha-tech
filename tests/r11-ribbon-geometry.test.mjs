/**
 * R11.4 Ribbon 几何回归测试（node:test）：
 * 防止路径几何再次出现「横跨主岛的高架巨带」类异常——
 * 1. 采样数公式：samples = (控制点数−1)×16+1（buildTrail 契约）；
 * 2. 采样点包围盒不越过控制点包络（Catmull-Rom 过冲受控，无失控几何）；
 * 3. 高度包络：采样 y 不超出控制点 y 范围 ±1（无异常高架）；
 * 4. 三径互不意外连接（ pairwise 采样最小距离 ≥8m）；
 * 5. 丝带顶点数 = 采样数×2 且包围盒与采样一致（无重复挂载/累积）；
 * 6. 首尾采样与控制点端点一致（无闭合曲线/首尾连接错误）。
 * 运行方式：npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TRAILS } from "../lib/world/layout.ts";
import { buildRibbonGeometry } from "../components/world/terrain/ribbonGeometry.ts";

test("R11.4 采样数契约：每径 samples = (控制点数−1)×16 + 1", () => {
  for (const trail of TRAILS) {
    const expected = (trail.controlPoints.length - 1) * 16 + 1;
    assert.equal(
      trail.samples.length,
      expected,
      `${trail.id} 采样数 ${trail.samples.length} 应为 ${expected}（重新挂载/重复生成会破坏该契约）`,
    );
  }
});

test("R11.4 包围盒包络：采样点不越过控制点包络 +3m（无失控几何）", () => {
  for (const trail of TRAILS) {
    const xs = trail.controlPoints.map((p) => p.x);
    const ys = trail.controlPoints.map((p) => p.y);
    const zs = trail.controlPoints.map((p) => p.z);
    const box = {
      minX: Math.min(...xs) - 3, maxX: Math.max(...xs) + 3,
      minY: Math.min(...ys) - 3, maxY: Math.max(...ys) + 3,
      minZ: Math.min(...zs) - 3, maxZ: Math.max(...zs) + 3,
    };
    for (const s of trail.samples) {
      assert.ok(
        s.x >= box.minX && s.x <= box.maxX &&
        s.y >= box.minY && s.y <= box.maxY &&
        s.z >= box.minZ && s.z <= box.maxZ,
        `${trail.id} 采样点 (${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}) 越出控制点包络+3m`,
      );
    }
  }
});

test("R11.4 高度包络：采样 y 不超出控制点 y 范围 ±1（无异常高架）", () => {
  for (const trail of TRAILS) {
    const ys = trail.controlPoints.map((p) => p.y);
    const lo = Math.min(...ys) - 1;
    const hi = Math.max(...ys) + 1;
    for (const s of trail.samples) {
      assert.ok(
        s.y >= lo && s.y <= hi,
        `${trail.id} 采样高度 ${s.y.toFixed(2)} 越出 [${lo}, ${hi}]`,
      );
    }
  }
});

test("R11.4 路径独立：任意两径采样最小距离 ≥8m（无意外连接/合并）", () => {
  for (let a = 0; a < TRAILS.length; a += 1) {
    for (let b = a + 1; b < TRAILS.length; b += 1) {
      let best = Infinity;
      for (const sa of TRAILS[a].samples) {
        for (const sb of TRAILS[b].samples) {
          const d = Math.hypot(sa.x - sb.x, sa.z - sb.z);
          if (d < best) best = d;
        }
      }
      assert.ok(
        best >= 8,
        `${TRAILS[a].id} 与 ${TRAILS[b].id} 采样最小间距 ${best.toFixed(1)}m 应 ≥8m`,
      );
    }
  }
});

test("R11.4 端点契约：首尾采样与控制点端点一致（无闭合/首尾误连）", () => {
  for (const trail of TRAILS) {
    const first = trail.controlPoints[0];
    const last = trail.controlPoints[trail.controlPoints.length - 1];
    const s0 = trail.samples[0];
    const sN = trail.samples[trail.samples.length - 1];
    assert.ok(Math.hypot(s0.x - first.x, s0.z - first.z) < 0.01, `${trail.id} 首采样偏离起点`);
    assert.ok(Math.hypot(sN.x - last.x, sN.z - last.z) < 0.01, `${trail.id} 尾采样偏离终点`);
  }
});

test("R11.4 丝带几何：顶点数 = 采样数×2，包围盒与采样一致（无累积几何）", () => {
  for (const trail of TRAILS) {
    const geometry = buildRibbonGeometry(trail.samples, trail.width, 0.045);
    try {
      const count = geometry.getAttribute("position").count;
      assert.equal(
        count,
        trail.samples.length * 2,
        `${trail.id} 丝带顶点数 ${count} 应为 ${trail.samples.length * 2}`,
      );
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      for (const s of trail.samples) {
        assert.ok(
          s.x >= bb.min.x - trail.width && s.x <= bb.max.x + trail.width &&
          s.y >= bb.min.y - 0.1 && s.y <= bb.max.y + 0.1 &&
          s.z >= bb.min.z - trail.width && s.z <= bb.max.z + trail.width,
          `${trail.id} 采样点落在丝带包围盒之外（几何与路径数据脱节）`,
        );
      }
    } finally {
      geometry.dispose();
    }
  }
});

test("R11.4 C 径重排验收：前段贴海低走，爬升段远离主岛（不横跨主岛上方）", () => {
  const c = TRAILS.find((t) => t.id === "trail-c");
  // 主岛西缘 x ≈ −18：离开该范围前高度不得超过 1.2（贴海低走）
  for (const s of c.samples) {
    if (s.x >= -26 && s.x <= -14) {
      assert.ok(
        s.y <= 1.2,
        `C 径近岛段 (x=${s.x.toFixed(1)}) 高度 ${s.y.toFixed(2)} 应 ≤1.2`,
      );
    }
  }
  // 爬升只允许在远离主岛处发生：x < −30 之前不得越过 2.5
  for (const s of c.samples) {
    if (s.x > -30) {
      assert.ok(s.y <= 2.5, `C 径 x=${s.x.toFixed(1)} 处高度 ${s.y.toFixed(2)} 应 ≤2.5`);
    }
  }
  // 终点仍为 +8（CS 屿到达高度不变）
  const last = c.samples[c.samples.length - 1];
  assert.equal(last.y, 8, "C 径终点高度应保持 +8");
});
