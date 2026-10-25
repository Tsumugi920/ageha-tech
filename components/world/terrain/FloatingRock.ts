import { LatheGeometry, Vector2 } from "three";

/**
 * 倒锥浮石程序化几何工具（蓝图 §10 terrain/FloatingRock）：
 * 用 Lathe 旋转剖面生成「上缘台面 + 倒锥收腰 + 深垂尖」的浮岛体量，
 * 顶面 y=0（与 lib/world 可行走盘面高度对齐），零外部模型 / 纹理。
 *
 * 纯几何工厂（无 JSX），MainIsland / 三屿 / 远景剪影共用。
 */
export function createFloatingRockGeometry(
  radius: number,
  depth: number,
  segments = 44,
): LatheGeometry {
  const r = radius;
  const profile: Vector2[] = [
    new Vector2(0.001, -depth),
    new Vector2(r * 0.34, -depth * 0.52),
    new Vector2(r * 0.58, -depth * 0.28),
    new Vector2(r * 0.8, -depth * 0.1),
    new Vector2(r * 0.95, -0.16),
    new Vector2(r, -0.08),
    new Vector2(r * 0.985, -0.02),
    new Vector2(r * 0.9, -0.12),
    new Vector2(r * 0.55, -0.2),
    new Vector2(0.001, -0.24),
  ];
  return new LatheGeometry(profile, segments);
}
