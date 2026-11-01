/**
 * 贴地丝带几何测试（R9）：
 * 保证铺装 road base / 边线 / 路缘三件套的宽度与横向偏移语义正确。
 *
 * 回退背景：`buildRibbonGeometry` 曾把 offset 加进半宽，0.18m 的
 * 「侧边石」实际变成 ~2.8m 的整幅色带，把接近铺装的浅色路面压暗。
 * 这里以数值断言锁住：offset 平移条带、宽度保持、法线朝上。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRibbonGeometry } from "../components/world/terrain/ribbonGeometry.ts";

/** 正北直线（−Z），便于解析出侧向 = ±X */
const line = [
  { x: 0, y: 0, z: 4 },
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: -4 },
];

function lateralSpan(geometry) {
  const position = geometry.getAttribute("position");
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    minX = Math.min(minX, position.getX(i));
    maxX = Math.max(maxX, position.getX(i));
  }
  return { minX, maxX, width: maxX - minX, center: (minX + maxX) / 2 };
}

test("丝带宽度：中心线 / 路缘条的宽度不被 offset 放大", () => {
  const path = buildRibbonGeometry(line, 2.55, 0);
  const span = lateralSpan(path);
  assert.ok(Math.abs(span.width - 2.55) < 1e-6, `铺装宽度应为 2.55，实际 ${span.width}`);
  assert.ok(Math.abs(span.center) < 1e-6, "无 offset 时应以路径中线居中");

  const curb = buildRibbonGeometry(line, 0.18, 0, 1.3);
  const curbSpan = lateralSpan(curb);
  assert.ok(Math.abs(curbSpan.width - 0.18) < 1e-6, `路缘条宽度应为 0.18，实际 ${curbSpan.width}`);
  assert.ok(Math.abs(curbSpan.center + 1.3) < 1e-6, `路缘条应整体横向偏移 1.3，实际中心 ${curbSpan.center}`);
});

test("丝带法线朝上：贴地铺装正常受光，不产生自身阴影", () => {
  const geometry = buildRibbonGeometry(line, 2.55, 0.055);
  const normal = geometry.getAttribute("normal");
  assert.equal(normal.itemSize, 3);
  let minY = Infinity;
  for (let i = 0; i < normal.count; i += 1) {
    minY = Math.min(minY, normal.getY(i));
  }
  assert.ok(minY > 0.99, `所有顶点法线应朝上（最小 y=${minY}）`);
});

test("heightAt：铺装两侧贴合地形高度", () => {
  const heightAt = (x) => (x < 0 ? 0.2 : 0.6);
  const geometry = buildRibbonGeometry(line, 2, 0.05, 0, heightAt);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const expected = (position.getX(i) < 0 ? 0.2 : 0.6) + 0.05;
    assert.ok(Math.abs(position.getY(i) - expected) < 1e-6, `顶点 ${i} 应贴合横坡`);
  }
});
