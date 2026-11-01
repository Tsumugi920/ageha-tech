/**
 * P3 场景体验用的程序化演示屏（无外部图片资产）：
 * AgehaOS 的窗口/文件/设置三态，CS 观测屏的资产/持仓/成交三态。
 * 所有画面都带 DEMO/演示标识；真实项目截图仍作为默认屏与详情封面。
 */
type DemoSlug = "agehaos" | "cs-skin-invest";

const W = 768;
const H = 480;

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "rgba(12, 40, 66, 0.9)",
  stroke = "rgba(143, 232, 255, 0.24)",
): void {
  rounded(ctx, x, y, w, h, 10);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = "#DDF3FF",
  weight = 600,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function mono(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 13,
  color = "rgba(190, 231, 250, 0.68)",
): void {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px "Cascadia Mono", "Consolas", monospace`;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

function base(ctx: CanvasRenderingContext2D, slug: DemoSlug): void {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#061625");
  bg.addColorStop(0.58, "#0A2945");
  bg.addColorStop(1, "#071C30");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(84, 227, 255, 0.055)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 窗框顶栏
  ctx.fillStyle = "rgba(4, 18, 32, 0.72)";
  ctx.fillRect(0, 0, W, 58);
  ctx.fillStyle = "rgba(143, 232, 255, 0.16)";
  ctx.fillRect(0, 57, W, 1);
  const brand = slug === "agehaos" ? "AgehaOS" : "CS MARKET OBSERVER";
  text(ctx, brand, 28, 29, 18, "#EAFBFF", 700);
  mono(ctx, slug === "agehaos" ? "WORKSPACE / DEMO" : "OBSERVATORY / DEMO", 28, 46, 10, "rgba(143, 232, 255, 0.58)");

  // DEMO 徽标
  rounded(ctx, W - 156, 16, 128, 26, 13);
  ctx.fillStyle = "rgba(255, 179, 107, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 179, 107, 0.5)";
  ctx.stroke();
  text(ctx, "DEMO · 演示", W - 138, 29, 11, "#FFD9A0", 700);

  // 底部说明
  ctx.fillStyle = "rgba(4, 18, 32, 0.6)";
  ctx.fillRect(0, H - 38, W, 38);
  mono(
    ctx,
    slug === "agehaos"
      ? "Ageha.tech · 作品集场景演示 / 非实时连接"
      : "Ageha.tech · 作品集场景演示 / 演示数据，非实时行情",
    28,
    H - 19,
    11,
    "rgba(190, 231, 250, 0.62)",
  );
}

function drawAgehaosWindows(ctx: CanvasRenderingContext2D): void {
  // 侧边栏
  panel(ctx, 22, 78, 150, 360, "rgba(10, 34, 56, 0.88)");
  for (let i = 0; i < 5; i += 1) {
    rounded(ctx, 38, 100 + i * 38, 118, 26, 7);
    ctx.fillStyle = i === 0 ? "rgba(84, 227, 255, 0.18)" : "rgba(255, 255, 255, 0.05)";
    ctx.fill();
    text(ctx, ["桌面", "窗口", "文件", "终端", "设置"][i], 52, 114 + i * 38, 12, i === 0 ? "#9FE9FF" : "rgba(221, 243, 255, 0.62)", 500);
  }

  // 主编辑器窗口
  panel(ctx, 192, 84, 386, 246, "rgba(8, 30, 52, 0.94)");
  rounded(ctx, 192, 84, 386, 30, 10);
  ctx.fillStyle = "rgba(84, 227, 255, 0.12)";
  ctx.fill();
  text(ctx, "world.tsx — 信灯控制器", 208, 100, 12, "#DDF3FF", 600);
  const code = [
    "const player = usePlayerController(isMobile);",
    "if (inputState.teleportActive) return;",
    "const axes = combineMoveAxes(move, joystick);",
    "const step = stepClock.add(rawDelta);",
    "resolveCollisionVelocity(v, pushed);",
  ];
  code.forEach((line, i) => {
    mono(ctx, `${String(i + 1).padStart(2, "0")}  ${line}`, 208, 136 + i * 30, 13, i === 2 ? "#FFD9A0" : undefined);
  });

  // 预览窗口
  panel(ctx, 594, 84, 150, 140, "rgba(12, 40, 66, 0.9)");
  text(ctx, "预览", 610, 104, 12, "#9FE9FF");
  rounded(ctx, 610, 122, 118, 66, 8);
  const preview = ctx.createLinearGradient(610, 122, 728, 188);
  preview.addColorStop(0, "rgba(84, 227, 255, 0.22)");
  preview.addColorStop(1, "rgba(156, 131, 255, 0.18)");
  ctx.fillStyle = preview;
  ctx.fill();
  mono(ctx, "butterfly.png", 610, 202, 11);
  mono(ctx, "1.2 MB", 610, 214, 10, "rgba(190, 231, 250, 0.45)");

  // 状态窗口
  panel(ctx, 594, 242, 150, 196, "rgba(12, 40, 66, 0.9)");
  text(ctx, "系统状态", 610, 262, 12, "#9FE9FF");
  [["窗口", "3"], ["进程", "12"], ["内存", "48%"]].forEach(([label, value], i) => {
    mono(ctx, label, 610, 292 + i * 34, 11);
    mono(ctx, value, 706, 292 + i * 34, 11, "#FFD9A0");
  });
  rounded(ctx, 610, 390, 118, 6, 3);
  ctx.fillStyle = "rgba(84, 227, 255, 0.18)";
  ctx.fill();
  rounded(ctx, 610, 390, 72, 6, 3);
  ctx.fillStyle = "#54E3FF";
  ctx.fill();

  // 底部 dock
  panel(ctx, 192, 348, 552, 58, "rgba(8, 28, 48, 0.92)");
  for (let i = 0; i < 6; i += 1) {
    rounded(ctx, 222 + i * 52, 362, 30, 30, 9);
    ctx.fillStyle = i === 0 ? "#54E3FF" : "rgba(255, 255, 255, 0.14)";
    ctx.fill();
  }
  mono(ctx, "拖动窗口或切换侧栏 — 界面演示", 512, 377, 11, "rgba(190, 231, 250, 0.5)");
}

function drawAgehaosFiles(ctx: CanvasRenderingContext2D): void {
  panel(ctx, 22, 78, 150, 360, "rgba(10, 34, 56, 0.88)");
  text(ctx, "文件", 38, 102, 13, "#9FE9FF");
  ["/world", "/projects", "/notes", "/assets"].forEach((label, i) => {
    mono(ctx, label, 38, 138 + i * 28, 12, i === 0 ? "#DDF3FF" : undefined);
  });

  panel(ctx, 192, 84, 356, 360, "rgba(8, 30, 52, 0.94)");
  text(ctx, "world / components / systems", 208, 108, 12, "rgba(190, 231, 250, 0.62)");
  [
    ["▸", "usePlayerController.ts", "12 KB"],
    ["▸", "WorldAudio.tsx", "8 KB"],
    ["▸", "NorthRouteDressing.tsx", "16 KB"],
    ["▸", "PostProcessing.tsx", "—"],
    ["▸", "InteractionSystem.tsx", "4 KB"],
  ].forEach(([icon, name, size], i) => {
    rounded(ctx, 208, 128 + i * 48, 324, 38, 8);
    ctx.fillStyle = i === 2 ? "rgba(84, 227, 255, 0.14)" : "rgba(255, 255, 255, 0.035)";
    ctx.fill();
    mono(ctx, icon, 220, 147 + i * 48, 13, "#FFD9A0");
    mono(ctx, name, 242, 147 + i * 48, 12);
    mono(ctx, size, 482, 147 + i * 48, 10, "rgba(190, 231, 250, 0.45)");
  });

  panel(ctx, 566, 84, 178, 360, "rgba(12, 40, 66, 0.9)");
  text(ctx, "文件预览", 582, 108, 12, "#9FE9FF");
  mono(ctx, "usePlayerController.ts", 582, 134, 11, "#DDF3FF");
  ["// fixed-step motion", "const clock = createStepAccumulator();", "const steps = clock.add(delta);", "for (const step of steps) advance();"].forEach((line, i) => {
    mono(ctx, line, 582, 164 + i * 26, 10, "rgba(190, 231, 250, 0.66)");
  });
  rounded(ctx, 582, 388, 146, 34, 8);
  ctx.fillStyle = "rgba(84, 227, 255, 0.12)";
  ctx.fill();
  text(ctx, "打开文件（演示）", 594, 405, 11, "#9FE9FF", 600);
}

function drawAgehaosSettings(ctx: CanvasRenderingContext2D): void {
  panel(ctx, 22, 78, 250, 360, "rgba(10, 34, 56, 0.88)");
  text(ctx, "系统设置", 38, 104, 16, "#EAFBFF", 700);
  ["外观", "性能", "声音", "无障碍"].forEach((label, i) => {
    rounded(ctx, 38, 136 + i * 42, 214, 30, 8);
    ctx.fillStyle = i === 0 ? "rgba(84, 227, 255, 0.14)" : "rgba(255, 255, 255, 0.04)";
    ctx.fill();
    text(ctx, label, 52, 151 + i * 42, 12, i === 0 ? "#9FE9FF" : "rgba(221, 243, 255, 0.62)", 500);
  });

  panel(ctx, 292, 84, 452, 360, "rgba(8, 30, 52, 0.94)");
  text(ctx, "外观与动效", 310, 110, 16, "#EAFBFF", 700);
  const rows = [
    ["玻璃材质", true],
    ["柔和粒子", true],
    ["减少动态", false],
    ["声音反馈", true],
  ];
  rows.forEach(([label, on], i) => {
    mono(ctx, String(label), 310, 148 + i * 42, 13);
    rounded(ctx, 648, 136 + i * 42, 54, 24, 12);
    ctx.fillStyle = on ? "rgba(84, 227, 255, 0.32)" : "rgba(255, 255, 255, 0.1)";
    ctx.fill();
    rounded(ctx, on ? 678 : 652, 140 + i * 42, 16, 16, 8);
    ctx.fillStyle = on ? "#9FE9FF" : "rgba(221, 243, 255, 0.5)";
    ctx.fill();
  });
  text(ctx, "界面色调", 310, 330, 12, "rgba(190, 231, 250, 0.62)", 500);
  ["#54E3FF", "#269DFF", "#9C83FF", "#FFB36B"].forEach((color, i) => {
    rounded(ctx, 310 + i * 46, 348, 28, 28, 9);
    ctx.fillStyle = color;
    ctx.fill();
  });
  mono(ctx, "演示设置，不写入真实系统", 310, 406, 11, "rgba(190, 231, 250, 0.46)");
}

function drawCsPortfolio(ctx: CanvasRenderingContext2D): void {
  panel(ctx, 22, 78, 724, 250, "rgba(8, 30, 52, 0.94)");
  text(ctx, "组合曲线", 40, 102, 14, "#EAFBFF", 700);
  mono(ctx, "演示数据 · 非实时行情", 40, 120, 10, "rgba(255, 217, 160, 0.7)");

  ctx.strokeStyle = "rgba(143, 232, 255, 0.12)";
  for (let i = 0; i < 5; i += 1) {
    const y = 152 + i * 32;
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(724, y);
    ctx.stroke();
  }
  const points = Array.from({ length: 22 }, (_, i) => {
    const x = 54 + i * 31;
    const y = 270 - Math.sin(i * 0.55) * 36 - i * 2.2 + Math.sin(i * 1.6) * 8;
    return [x, y] as const;
  });
  const gradient = ctx.createLinearGradient(0, 140, 0, 310);
  gradient.addColorStop(0, "rgba(84, 227, 255, 0.32)");
  gradient.addColorStop(1, "rgba(84, 227, 255, 0)");
  ctx.beginPath();
  ctx.moveTo(points[0][0], 310);
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.lineTo(points[points.length - 1][0], 310);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = "#54E3FF";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // 三个指标卡
  [["组合净值", "1.084"], ["区间收益", "+8.4%"], ["最大回撤", "-3.1%"]].forEach(([label, value], i) => {
    panel(ctx, 22 + i * 246, 342, 226, 96, "rgba(12, 40, 66, 0.9)");
    mono(ctx, label, 40 + i * 246, 366, 11, "rgba(190, 231, 250, 0.62)");
    text(ctx, value, 40 + i * 246, 398, 26, i === 2 ? "#FFB36B" : "#EAFBFF", 700);
  });
}

function drawCsHoldings(ctx: CanvasRenderingContext2D): void {
  panel(ctx, 22, 78, 724, 360, "rgba(8, 30, 52, 0.94)");
  text(ctx, "持仓分布", 40, 104, 14, "#EAFBFF", 700);
  mono(ctx, "演示数据 · 非实时行情", 40, 122, 10, "rgba(255, 217, 160, 0.7)");
  const rows = [
    ["样本 A", 0.72, "#54E3FF"],
    ["样本 B", 0.54, "#8FE8FF"],
    ["样本 C", 0.36, "#FFB36B"],
    ["样本 D", 0.22, "#9C83FF"],
  ] as const;
  rows.forEach(([label, ratio, color], i) => {
    const y = 164 + i * 62;
    mono(ctx, label, 48, y + 12, 12, "#DDF3FF");
    rounded(ctx, 170, y, 470, 24, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    rounded(ctx, 170, y, 470 * ratio, 24, 12);
    ctx.fillStyle = color;
    ctx.fill();
    mono(ctx, `${Math.round(ratio * 100)}%`, 658, y + 12, 12, "#EAFBFF");
  });
  mono(ctx, "示意持仓，不代表真实组合", 48, 414, 11, "rgba(190, 231, 250, 0.46)");
}

function drawCsTrades(ctx: CanvasRenderingContext2D): void {
  panel(ctx, 22, 78, 460, 360, "rgba(8, 30, 52, 0.94)");
  text(ctx, "成交序列", 40, 104, 14, "#EAFBFF", 700);
  mono(ctx, "演示数据 · 非实时行情", 40, 122, 10, "rgba(255, 217, 160, 0.7)");
  for (let i = 0; i < 20; i += 1) {
    const x = 54 + i * 20;
    const height = 22 + ((i * 13) % 54);
    const rising = i % 3 !== 0;
    const top = 178 + (i % 5) * 4;
    ctx.fillStyle = rising ? "rgba(255, 179, 107, 0.72)" : "rgba(84, 227, 255, 0.6)";
    rounded(ctx, x, top, 7, height, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(221, 243, 255, 0.3)";
    ctx.fillRect(x + 3, top - 8, 1, height + 18);
  }
  panel(ctx, 500, 78, 246, 360, "rgba(12, 40, 66, 0.9)");
  text(ctx, "成交记录", 518, 104, 14, "#EAFBFF", 700);
  ["买入 · 样本 A", "卖出 · 样本 C", "买入 · 样本 D", "卖出 · 样本 B"].forEach((line, i) => {
    mono(ctx, line, 518, 150 + i * 44, 11, i % 2 === 1 ? "#FFB36B" : "#9FE9FF");
    mono(ctx, `10:2${i} · 演示`, 518, 168 + i * 44, 10, "rgba(190, 231, 250, 0.45)");
  });
  mono(ctx, "非真实交易记录", 518, 414, 11, "rgba(190, 231, 250, 0.46)");
}

function watermark(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(W - 146, H - 74);
  ctx.rotate(-0.12);
  ctx.globalAlpha = 0.16;
  text(ctx, "DEMO", 0, 0, 38, "#9FE9FF", 700);
  ctx.restore();
}

export function createDemoScreenCanvas(
  slug: DemoSlug,
  optionId: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  base(ctx, slug);
  if (slug === "agehaos") {
    if (optionId === "files") drawAgehaosFiles(ctx);
    else if (optionId === "settings") drawAgehaosSettings(ctx);
    else drawAgehaosWindows(ctx);
  } else if (optionId === "holdings") drawCsHoldings(ctx);
  else if (optionId === "trades") drawCsTrades(ctx);
  else drawCsPortfolio(ctx);
  watermark(ctx);
  return canvas;
}
