/**
 * R12.1 验收机位净空验证：用 lib/world/layout 的真实主岛高度场
 * （与贴地碰撞同源）检查「相机位置」与「相机→目标视线」是否被地形遮挡。
 *
 * 判定口径：
 * - 相机脚下净空 = cam.y − mainIslandSurfaceY(cam.xz) ≥ 0.5（相机不在坡内）；
 * - 视线净空 = 沿 cam→look 采样，采样点的视线高度 − 地形高度 ≥ minClear，
 *   终点前 3m 内放宽（观察目标本来就近地）。
 *
 * 用法：node scripts/verify-r121-cams.mjs [脚本内预设名 ...]
 */
import { mainIslandSurfaceY } from "../lib/world/layout.ts";

/**
 * R12.1 候选机位（与 capture-r121.mjs 同步维护）。
 * 坐标系：主岛 semiAxis 18×13，地形最高 ~2.75m（西岭）。
 */
export const POSES = {
  // 岩层近景（修 13 号：拉远到能看到檐口 + 岩壁 + 少量天空）。
  // look 有意低于地表（看岩壁剖面），wall=true：只验证 t≤0.8 的净空
  "13-rim-close": { cam: [-30, 0.8, 16], look: [-16, -2.5, 5], wall: true },
  // 高耸针叶树近景：西岭 spire 主簇（-14.6,-0.6），
  // 从东南侧广场外缘平视树冠中层，避开露岩丘与肩脊
  "14a-pine-spire": { cam: [-6.2, 1.9, -4.6], look: [-14.2, 2.6, -0.9] },
  // 宽冠针叶树近景：东池北岸 broad（13.8,-2.7），从广场东侧越过冰碛脊前缘平视
  "14b-pine-broad": { cam: [5.8, 2.4, 2.2], look: [13.4, 1.7, -2.6] },
  // 小型装饰树近景：南麓 tuft（3.4,9.8）为主角，浅雪盆缘 wind 松做背景
  "14c-pine-tuft": { cam: [-9.6, 1.7, 10.8], look: [-4.9, 1.0, 8.9] },
  // 岩石与地表融合近景：冰碛带岩簇（12.6,-6.4 / 9.6,-7.7）坐在冰碛脊上，
  // 相机抬高越过脊线微俯
  "15-rocks-fusion": { cam: [8.6, 3.0, -2.4], look: [12.6, 2.0, -6.8] },
};

const SAMPLES = 48;

function clearance(cam, look, wall = false) {
  const [cx, cy, cz] = cam;
  const [lx, ly, lz] = look;
  const camGround = mainIslandSurfaceY(cx, cz);
  const camClear = cy - camGround;
  let worst = { t: 0, clear: Infinity, x: cx, z: cz, ground: camGround };
  const maxT = wall ? 0.8 : 1;
  for (let i = 1; i <= SAMPLES; i += 1) {
    const t = (i / SAMPLES) * maxT;
    if (t > maxT) break;
    const x = cx + (lx - cx) * t;
    const z = cz + (lz - cz) * t;
    const y = cy + (ly - cy) * t;
    // 终点前 12.5% 放宽（观察目标近地是预期）
    const nearEnd = t > 0.875 * maxT;
    const limit = nearEnd ? 0.05 : 0.35;
    // 岛外没有地形（海面远低于视线）——只有岛内采样点才要求净空
    if (Math.hypot(x / 18, z / 13) > 1) continue;
    const ground = mainIslandSurfaceY(x, z);
    const clear = y - ground;
    if (clear - limit < worst.clear - (worst.t > 0.875 * maxT ? 0.05 : 0.35)) {
      worst = { t, clear, x, z, ground, limit };
    }
  }
  return { camClear, worst };
}

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(POSES);
let failures = 0;
for (const name of names) {
  const pose = POSES[name];
  if (!pose) {
    console.log(`? ${name}: 未定义`);
    failures += 1;
    continue;
  }
  const { camClear, worst } = clearance(pose.cam, pose.look, pose.wall);
  const okCam = camClear >= 0.5;
  const okLine = worst.clear === Infinity || worst.clear >= (worst.limit ?? 0.35);
  const verdict = okCam && okLine ? "OK " : "FAIL";
  if (!okCam || !okLine) failures += 1;
  console.log(
    `${verdict} ${name}\n     cam 净空 ${camClear.toFixed(2)}m | 最差点 t=${worst.t.toFixed(2)} @(${worst.x.toFixed(1)},${worst.z.toFixed(1)}) 净空 ${worst.clear.toFixed(2)}m (限 ${worst.limit}) 地形 ${worst.ground.toFixed(2)}m`,
  );
}
process.exit(failures ? 1 : 0);
