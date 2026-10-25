/**
 * lib/world 汇出：3D 世界的纯 TS 数据层（空间布局 / 碰撞与交互登记 /
 * 性能档位 / 常量）。无 JSX、无 three 依赖，node --test 可直接 import。
 */
export * from "./constants.ts";
export * from "./layout.ts";
export * from "./colliders.ts";
export * from "./performance.ts";
