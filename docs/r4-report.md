# Ageha.tech R4 — 性能、构图与地标精修报告

> 日期：2026-10-27
> 范围：首页 3D 世界（`components/world/`）与移动端世界 UI；未改动项目数据、真实外链与内容诚实边界。

---

## 1. 结论摘要

- **R3 报告的移动端 5.3 FPS 是测量假象**：自动化 Chrome 当时处于 `document.hidden=true`，`requestAnimationFrame` 被浏览器完全暂停；同一个 R3 页面在强制可见后，390×844 / DPR1 可跑到约 190 FPS（桌面 GPU）。
- 但这个假象掩盖了真实风险：R3 移动中档仍有 **400 draw calls**、全场景 **14 盏点光源**、DPR 1.5、全屏 WebGL 上多层 `backdrop-filter`。R4 逐项处理：
  - 移动端 draw calls **400 → 251**（−37%），桌面高画质 **781 → 524**；
  - 点光源 **14 → 2**（高档；中低档 1 盏随身光）；
  - 移动 DPR 上限 **1.5 → 1.25**，低档允许 **0.85** 亚 1× 渲染；
  - 移动端关闭 MSAA，触屏端关闭 HUD 背景模糊，隐藏不可见名牌；
  - 页面隐藏时暂停渲染循环；移动端自适应最高只升到 medium，低档作为兜底。
- 最终无节流移动模拟（390×844 / DPR3，Chrome Emulation，桌面 RTX 4050）为 **192 FPS / 5.2 ms**；4× CPU 节流（常见中端机代理）持续 12s 为 **33.8 FPS / 29.5 ms**，达到 30 FPS 目标；6× CPU 节流（低端压力地板）最低档持续 12s 为 **19.4 FPS**，仍未达到 30 FPS，剩余瓶颈是 CPU 提交/逐帧 JS，已在“已知限制”中说明。
- **没有真实手机可用**。以上移动数据均为 Chrome 移动视口 + 触控模拟 + CPU 节流，GPU 是桌面 RTX 4050，不能等同于真实手机验证。
- 桌面 1440×900 / 2560×1440 均稳定超过 60 FPS；所有最终报告 `runtimeErrors: []`，交互冒烟 `respawnOk / detailOpenOk / cameraIssues` 全部通过。
- 移动端两个真实 UI 根因已修复：
  1. 面板打开时 `focus()` 未加 `preventScroll`，把 `overflow:hidden` 的世界根容器整体滚走约 455px，导致标题/关闭键跑到视口外；
  2. `body:has(#world-root) footer` 选择器过宽，把世界面板底部操作栏也一起 `display:none` 了。

---

## 2. 第一阶段：R3 性能复测

### 2.1 环境

| 项目 | 值 |
| --- | --- |
| OS | Windows 11（10.0.26100） |
| 浏览器 | Chrome 155.0.8059.85（headless=new，真实 GPU） |
| GPU | NVIDIA GeForce RTX 4050 Laptop GPU，驱动 32.0.15.9174 |
| CPU / 内存 | 12 逻辑核 / 16 GB |
| 显示刷新 | 本机 headless rAF 可达 ~200 Hz（空白页同样 ~200 FPS） |
| 测量方式 | 页面就绪后 5s 预热 + 丢弃 1s 采样，再以 2~3 轮 × 3s 的 rAF 帧间隔统计；截图放在采样之后；每轮前后校验 `visibilityState` |

### 2.2 5.3 FPS 的根因

用同一份 R3 工作树复现：

1. 导航后页面状态：`document.hidden = true`、`visibilityState = "hidden"`、`document.hasFocus() = false`；
2. 3 秒 rAF 采样返回 **0 帧**（旧脚本会一直挂起，最终得到一个被挂起时长稀释的极低值）；
3. 执行 CDP：

   ```js
   Emulation.setFocusEmulationEnabled({ enabled: true })
   Page.setWebLifecycleState({ state: "active" })
   Emulation.setIdleOverride({ isUserActive: true, isScreenUnlocked: true })
   ```

   之后 `visibilityState = "visible"`，同一页面 390×844 / DPR1 的 rAF 采样为 **~190 FPS**。

**结论：** R3 的 5.3 FPS 不是渲染性能数据，而是后台/遮挡页面的自动化测量错误。R4 已在 `scripts/verify-r4.mjs`、`scripts/capture-world.mjs`、`scripts/world-smoke.mjs` 中强制页面活跃并校验可见性；不可见的采样判为无效。

> 即使 5.3 是假象，也不能据此认为手机性能合格。R4 仍按真实移动风险做了 DPR、draw call、灯光、compositing 与自适应档位优化。

### 2.3 优化前（R4 工作开始时的 R3 场景）

| 环境 | 视口 / DPR | Draw calls | 三角形 | 点光源 | FPS 备注 |
| --- | --- | --- | --- | --- | --- |
| 桌面高档 | 1440×900 / 1 | 781 | 110,906 | 14 | 强制可见后 entry ~61 FPS（vsync 限幅），移动状态 ~190 FPS |
| 移动中档（Emulation） | 390×844 / 3（Canvas DPR1.5） | 400 | 48,280 | 14 | 强制可见后 ~190 FPS（桌面 GPU，非手机） |
| R3 旧报告 | 390×844 / DPR1 | — | — | — | **5.3 FPS —— 无效（hidden）** |

---

## 3. 性能优化与最终数据

### 3.1 优化项

| 方向 | 修改 |
| --- | --- |
| 分辨率 | `medium.dprMax 1.5 → 1.25`；`low.dprMax 0.85`；`high.dprMax 2 → 1.75`；Canvas 初始 DPR 使用 `[min(1, cap), cap]`，低档可低于 1× |
| 移动渲染 | 移动端 `antialias: false`、`precision: "mediump"`；桌面保留 MSAA / highp |
| 档位 | 移动端自适应上限 = medium（不再升到 high 的 transmission + 阴影）；低档才是兜底；档位变化仍由 120 帧滑动窗口驱动 |
| 阴影 | 中低档完全关闭；高档 2048 单主光；`SunLight` 随玩家 2m 网格移动，主岛与三屿都有接触阴影 |
| 灯光 | 删除主岛 / 三屿 / 石碑 / 画廊的局部点光，共 **14 → 2**（高档蝶枢 + 随身信灯；中低档只有信灯） |
| 页面生命周期 | 新增 `VisibilityPause`：页面隐藏时 `frameloop = "never"`，可见时恢复 |
| 触屏 compositing | `(max-width: 640px), (pointer: coarse)` 下移除 HUD / 导航 / 摇杆 / 面板 / 名牌的 `backdrop-filter`，改用更实的半透明白底；不可见名牌同时 `visibility:hidden`，避免透明状态下仍维护模糊图层 |
| 动画节流 | 云漂移每 12 帧、浮晶每 3 帧、蝶群 / 行情柱每 2 帧、名牌 / 高亮每 4 帧、石碑说明每 6 帧（60Hz 下分别约 5 / 20 / 30 / 15 / 10Hz）；所有位移用累积 delta，轨迹连续 |
| 实例化 / 合并 | 主岛岩石、雪丘、雪台、崖晶、冰池池岸、广场细节、路径灯、路标、CS 地面/观测环刻度、AgehaOS 门架/塔冠叶片等改为 InstancedMesh；Moss 穹舱骨架（8 经线 + 2 纬环 + 底环）合并为 1 个几何；Moss 植被按蕨树 / 孢子树 / 灌木分区实例化 |
| 远景 | 远景岛 5 座，距离 145~158（仍在 120~220 环带），低档 3 座；云层 5/3 个；远景资产在低档更简 |
| 资源纪律 | 显式创建的几何 / 材质 / CanvasTexture 全部在 effect cleanup 中 dispose；`npm test` 的资源清理与 reduced-motion 审计保持通过 |

### 3.2 最终桌面数据

采样：5s 预热 + 2 轮 × 3s；截图在采样之后。所有 `runtimeErrors` 为空。

| 视口 / DPR | 状态 | 平均 FPS | 平均帧时间 | p95 帧时间 |
| --- | --- | --- | --- | --- |
| 1440×900 / 1 | 初始 | 93.3 | 10.67 ms | 15.0 ms |
| 1440×900 / 1 | 连续移动 | 156.5 | 6.53 ms | 12.45 ms |
| 1440×900 / 1 | 详情打开 | 195.6 | 5.11 ms | 5.1 ms |
| 1440×900 / 1 | 详情关闭 | 199.7 | 5.00 ms | 5.1 ms |
| 2560×1440 / 1 | 初始 | 88.1 | 11.29 ms | 15.05 ms |
| 2560×1440 / 1 | 连续移动 | 162.6 | 6.49 ms | 10.05 ms |
| 2560×1440 / 1 | 详情打开 | 199.9 | 5.00 ms | 5.1 ms |
| 2560×1440 / 1 | 详情关闭 | 198.6 | 5.03 ms | 5.1 ms |

高档初始场景：**524 draw calls / 113,928 三角形 / 58 programs**（1440×900，DPR1）。帧率高于 60 是因为本机 headless rAF 上限约 200 Hz；按帧时间看，初始场景 10.7–11.3 ms，低于 16.7 ms 的 60 FPS 预算。

### 3.3 最终移动数据（Chrome 移动模拟，不是真实手机）

无 CPU 节流：

| 视口 / DPR | Canvas 缓冲 | 状态 | 平均 FPS | 平均帧时间 | p95 |
| --- | --- | --- | --- | --- | --- |
| 390×844 / 3 | 487×1055（DPR1.25） | 初始 | 192.0 | 5.20 ms | 6.70 ms |
| 390×844 / 3 | 同上 | 连续移动 | 185.8 | 5.40 ms | 6.77 ms |
| 390×844 / 3 | 同上 | 详情打开 | 199.8 | 5.00 ms | 5.10 ms |
| 390×844 / 3 | 同上 | 详情关闭 | 197.6 | 5.05 ms | 5.10 ms |

移动中档：**251 draw calls / 53,996 三角形 / 35 programs**。  
说明：以上 190~200 FPS 是桌面 RTX 4050 上的模拟数据，**不能作为真实手机帧率宣称**；它的意义是证明页面在正确可见性与 DPR3 模拟下不再出现 5 FPS 的场景级瓶颈。

CPU 节流压力测试：

| 节流 | 档位 | 初始 | 移动 | 详情打开 | 详情关闭 | 持续 12s | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4× | medium（DPR1.25） | 38.8 | 47.1 | 55.5 | 54.1 | **33.8 FPS / 29.5 ms，p95 40 ms** | 常见中端机 CPU 代理，达到 30 FPS 目标 |
| 6× | low（DPR0.85） | 21.3 | 21.0 | 27.2 | 25.0 | **19.4 FPS / 51.3 ms，p95 70.1 ms** | 低端压力地板，未达 30 FPS |

6× 节流下空白页的 rAF 仍有 ~200 FPS，说明瓶颈是场景逐帧 CPU 工作（draw 提交、对象矩阵/JS），不是 Chrome 调度本身。已把 400 → 251 draw calls，但要在此极端代理下稳定 30 FPS，还需要下一轮“按材质合并静态几何”，本轮未做（见“已知限制”）。

### 3.4 交互冒烟（最终生产构建）

`scripts/world-smoke.mjs`：

- 桌面 1440×900：`respawnOk: true`、`detailOpenOk: true`、`cameraIssues: []`、`runtimeErrors: []`，8 个状态相机检查全部通过，FPS 83.3；
- 移动 390×844：`respawnOk: true`、`detailOpenOk: true`、`cameraIssues: []`、`runtimeErrors: []`，5 个状态全部通过，FPS 198.5（DPR1 的交互冒烟，性能数据以 3.3 的 DPR3 报告为准）。

返回起点现在同时复位位置、速度、贴地弹簧、相机 yaw / pitch / 距离档与角色朝向，避免从项目屿按 R 后保留上一个地标视角。

---

## 4. 美术与构图

### 4.1 主岛 / 空间构图

- **移除前景深色巨石扶壁**：R3 初始画面两侧 2~3m 的深色 `RIM_PIERS` 抢占视觉权重；R4 改为 18 枚向下生长的冰棱檐（单次实例化），主岛轮廓保留体积但前景干净。
- **岩簇分组**：10 块种子扰动巨石（`createBoulderGeometry`）分西侧岩脊 / 东侧冰池 / 北径口 / 西南角四组；雪帽单独实例化；不再所有石头共用同一个 dodecahedron。
- **植被三种轮廓**：霜松（分层锥冠 + 横向错位，9 株成两片林地）、冰冠乔木（细干 + 三团冰白云冠，3 株）、低苔灌木（7 簇）；霜松 6 个 draw call、冰冠 2 个、灌木 1 个。
- **路径连成体系**：新增「中央广场 → 三条蝶径起点」的接近铺装（Catmull-Rom 采样、跟随地形高度），径头门架改为低矮双柱 + 蝶形吊牌 + 发光门槛；不再像孤立路标。
- **地表**：雪原顶点色加大蓝白分区（冰壳斑块、雪脊、岩缘），保留可读的可行走面；新增 3 块有目的的雪台、4 组风积雪丘；岩缘冰棱层替换旧扶壁。
- **天空 / 远景**：5 座远景岛收近到 145~158 环带并按初始视线布置（NW 岛加一根远景针塔框住 AgehaOS），云带下移到 8~26，云层数量 10/7/4 → 8/5/3，天空纹理增加极淡青 / 淡紫高空光带；天空材质 `toneMapped=false` 保留冰蓝渐变。
- **广场细节**：12 条放射缝 / 8 组导流鳍 / 4 枚共振片从 32 个 mesh 收为 4 个 instanced draw call。

### 4.2 蝶枢（主蝴蝶）

- 翼展 **9.2 → 7.6m**，仍是主视觉，但让出后方终端塔与岛体；
- 翼厚从随翼展放大的 ~1m 改为 **12cm 世界单位**，沿翼展前弯成曲面；新增内层膜、4 根管状翼脉、深蓝翼缘线；
- 身体改为车削纺锤体 + 3 道金属腹节环 + 胸腔发光核 + 复眼 / 触角；翼根增加金属铰链；
- 低幅开合（±~0.12rad，24s 周期）、升沉（6s）、轻微转向；高档 only 2 个 transmission wing mesh + 1 个 Moss 穹舱，仍遵守 ≤3 名额；
- 中低档使用 0.9 不透明度 Standard 材质；翼面曲面、翼脉与身体仍可读，不靠高网格密度。

### 4.3 AgehaOS · 悬浮终端塔

- 三段式冰白基座 + 低矮入口门架（到达铺装对齐）；
- 八棱锥台主楼 + 白色陶瓷外壳 + 三道玻璃窗带 + 南向竖向光缝；
- 主屏放大到 2.6m 宽并嵌入主楼南面，外围增加白色立面框；屏幕上方有品牌蝶形徽记；
- 抬升观测环（8 边形环 + 4 根斜撑）由银灰金属重做；塔冠保留白色灯盘 / 悬浮核心晶 / 4 片环叶；
- 结构件从 R3 的细杆堆叠减少约一半，保留真实项目屏幕、交互热区、项目数据与外链。

### 4.4 Moss World · 生态穹舱

- 穹舱玻璃单层化：高档 transmission 0.82，中低档 0.16 淡透明壳；8 经线 + 2 纬环 + 底环合并为 1 个骨架 mesh；新增西侧入口框；
- 内部地从平面绿盘改为有树丘、池盆、苔色分区的起伏地表（`createMossGroundGeometry`）；
- 植被分三区：2 株宽叶蕨树（5 片放射状叶）、2 株发光孢子树、5 丛低苔灌木、6 组蘑菇、8 根池岸芦苇、8 块池石、5 块踏步石；全部实例化或分组，不再是一圈相同锥体；
- 舱外观景台与监测屏降低尺度、增加雨棚 / 桌台 / 围栏，真实 Moss 截图只在靠近时挂载；交互锚点与 no-link 诚实边界不变。

### 4.5 CS 模拟器

- 保留观测环 / 数据柱 / 中央价格针的辨识轮廓；
- 结构金属从近黑深蓝提亮到中深蓝灰，减少“黑杆”感；
- 基座与观测环刻度改为实例化（24 + 16 → 2 draw calls），不改变真实项目数据和屏幕截图。

### 4.6 灯光 / 材质统一

- 主光：暖晨光 + 冷半球 + 两束冷填光；主光阴影随玩家 2m 网格移动；
- 金属统一为深蓝结构 + 银灰框架；玻璃统一为冰蓝透射 / 淡透明壳；发光仅用于蝶翼缘、屏幕、核心晶与路径中线；
- 移除随机点光后，地标靠轮廓、白色立面、玻璃与环境反射建立层次，而不是靠更多发光线。

---

## 5. 移动端 UI 修复

### 5.1 入口介绍卡

- 介绍卡上移到 **bottom = 8.25rem + safe-area**，与 96px 摇杆 / 底部工具栏之间保留 12px 间距：
  - 390×844：卡片 `y=416.5, h=295.5, bottom=712`；摇杆 `top=724`；工具栏 `top=786.4`；无重叠；
  - 390×667：卡片 `y=239.5, h=295.5, bottom=535`；摇杆 `top=547`；无重叠。
- `max-height` 按 `100dvh − navbar − 8.25rem − safe-area` 计算，内容区独立滚动；头部关闭与底部「开始探索」不随内容滚走。
- 卡内 pointerdown 不再立即关闭（修复原实现导致移动端无法滚动卡片的问题）；卡外操作 / Esc / 方向键仍会关闭。

### 5.2 项目详情

R3 实测异常（390×844）：

- 面板 `getBoundingClientRect()` 为 `y=-231.19, h=618.19`，关闭键在 `y=-218.19`；
- 标题/关闭键在视口外，底部操作栏 `display:none`，内容结束后出现大面积空白。

根因：

1. `usePanelA11y` 在面板仍位于 `translateY(100%)` 时调用 `focus()`，浏览器把 `overflow:hidden` 的 `#world-root` 滚动约 **455px**。修复：所有面板焦点使用 `focus({ preventScroll: true })`，并在打开时防御性重置 `world-root.scrollTop/scrollLeft`。
2. 全局 `body:has(#world-root) footer { display:none; }` 误伤了 `world-panel__footer`。修复：只命中 `body:has(#world-root) > footer`（站点页脚是 body 直接子节点）。

R4 最终（390×844）：

- 面板 `y=163, h=681, bottom=844`；标题 `y=164, h=70.9`；关闭键 `174.3~218.3`；底部操作栏可见；
- 面板采用内容自适应高度 + `max-height: calc(100dvh − navbar − 0.5rem)`；标题与底栏在滚动区外，正文 `overflow-y:auto` + `overscroll-behavior:contain`；
- 390×667 时面板 `y=100, h=567`，正文 `scrollHeight=540 / clientHeight=426`，可正常内部滚动，关闭键始终可见。

### 5.3 Canvas 与实时视口变化

在面板打开状态下用 CDP 实时改视口：

- 390×844 → 390×667：Canvas 缓冲 `487×1055 → 487×833`，CSS `390×844 → 390×667`，面板 `y163/h681 → y100/h567`，标题/关闭键保持可见；
- 390×667 → 390×844：缓冲与布局恢复 `487×1055` / `y163/h681`；
- 运行期 `runtimeErrors: []`。

---

## 6. 测试与构建

最终生产构建：

```bash
npm run build     # 成功，12 个路由静态 / SSG
npm test          # 162 pass / 0 fail
npm run lint      # 0 error / 0 warning
```

新增 / 更新的验收脚本：

```bash
# 需先 npm run build && npm run start
# 以及带 --remote-debugging-port=9223 的 Chrome
node scripts/verify-r4.mjs --width 1440 --height 900 --dsf 1 --port 9223 \
  --outDir screenshots/r4-final/desktop-1440
node scripts/verify-r4.mjs --width 390 --height 844 --dsf 3 --mobile --port 9223 \
  --outDir screenshots/r4-final/mobile-390 --downscale
# 常见中端机 CPU 代理 / 低端压力地板
node scripts/verify-r4.mjs --width 390 --height 844 --dsf 3 --mobile --cpuThrottle 4 \
  --tier medium --sustain 12000 --port 9223 --outDir screenshots/r4-final/mobile-390-cpu4 --downscale
node scripts/verify-r4.mjs --width 390 --height 844 --dsf 3 --mobile --cpuThrottle 6 \
  --tier low --sustain 12000 --port 9223 --outDir screenshots/r4-final/mobile-390-cpu6-low --downscale

# 同状态前后对比
node scripts/make-r4-compare.mjs
```

`verify-r4.mjs` 的每个报告包含：视口 / DPR / Canvas 缓冲 / GPU / CPU 节流 / 档位 / draw calls / 三角形 / programs / 各状态多轮 FPS、平均帧时间、p95、max、无效采样、UI 矩形与 `runtimeErrors`。

---

## 7. 交付截图

R3 → R4 同状态对比（`screenshots/r4-final/compare/`）：

| 文件 | 状态 |
| --- | --- |
| `01-entry-1440-intro.png` | 1440×900 初始 + 介绍卡 |
| `02-entry-2560.png` | 2560×1440 初始场景 |
| `03-agehaos-1440.png` | 1440×900 AgehaOS |
| `04-moss-1440.png` | 1440×900 Moss World |
| `05-mobile-entry.png` | 390×844 移动初始场景 |
| `06-mobile-intro.png` | 390×844 移动介绍卡 |
| `07-mobile-detail.png` | 390×844 移动项目详情 |

关键最终画面（`screenshots/r4-final/`）：

| 文件 | 内容 |
| --- | --- |
| `01-desktop-1440-entry.png` | 1440×900 完整初始场景 |
| `02-desktop-2560-entry.png` | 2560×1440 完整初始场景 |
| `03-butterfly-close.png` | 主岛 + 中央蝴蝶近景 |
| `04-agehaos.png` | AgehaOS 地标 |
| `05-moss.png` | Moss 生态舱 |
| `06-cs.png` | CS 观测环 |
| `07-mobile-entry.png` | 移动端入口 |
| `08-mobile-intro.png` | 移动端介绍面板 |
| `09-mobile-detail.png` | 移动端项目详情 |
| `10-mobile-390x667-panel.png` | 390×667 实时缩放后的详情抽屉（正文可滚动） |

性能报告：

- `screenshots/r4-final/desktop-1440/report.json`
- `screenshots/r4-final/desktop-2560/report.json`
- `screenshots/r4-final/mobile-390/report.json`
- `screenshots/r4-final/mobile-390-cpu4/report.json`
- `screenshots/r4-final/mobile-390-cpu6-low/report.json`
- `screenshots/r4-final/mobile-390x667/report.json`
- `screenshots/r4-final/smoke-desktop/report.json`
- `screenshots/r4-final/smoke-mobile/report.json`

---

## 8. 关键文件

| 文件 | R4 改动 |
| --- | --- |
| `lib/world/performance.ts` | DPR 档位、移动上限、`pickTierOverride` 验收固定档 |
| `lib/world/layout.ts` | 蝶枢翼展 7.6；远景岛按视线重排；Moss/CS 保持数据 |
| `lib/world/constants.ts` | 云带高度调整 |
| `lib/world/colliders.ts` | 蝶枢碰撞/遮挡盒随翼展缩小；路标碰撞高度降低 |
| `components/world/WorldCanvas.tsx` | `VisibilityPause`、移动端 GL 配置、初始档覆盖、DPR 合法区间 |
| `components/world/systems/AdaptiveQuality.tsx` | 移动 ceiling=medium、固定档 pin、初始档注入 |
| `components/world/systems/WorldDiagnostics.tsx` | `?debug=1` 下暴露状态 / draw calls / 三角形 / 档位 / DPR |
| `components/world/systems/usePlayerController.ts` | 返回起点同时复位相机方向 |
| `components/world/systems/usePanelA11y.ts` | `preventScroll` + 根容器滚动复位 |
| `components/world/terrain/MainIsland.tsx` | 冰棱檐、岩簇、雪台/雪丘、冰池、植被、广场实例化 |
| `components/world/terrain/islandGeometry.ts` | 巨石几何、Moss 地被几何、雪面色彩分区 |
| `components/world/terrain/Trails.tsx` | 广场接近路径、低矮门架 + 蝶形吊牌、路径灯实例化 |
| `components/world/terrain/DistantIsles.tsx` | 远景岛尺度 / 排布 / 针塔 |
| `components/world/terrain/CloudLayer.tsx` | 云带位置 / 数量 / 5Hz 更新 |
| `components/world/terrain/SkyDome.tsx` | 高空光带、`toneMapped=false` |
| `components/world/terrain/AmbientShards.tsx` | 20Hz 更新 |
| `components/world/objects/ButterflyCore.tsx` | 蝴蝶翼面 / 身体 / 翼脉 / 动画全面重做 |
| `components/world/objects/butterflyShape.ts` | 曲面实体翼、翼脉、蝶形徽记几何 |
| `components/world/objects/ProjectIsle.tsx` | AgehaOS / Moss 重构，CS 提亮，刻度 / 门架 / 塔冠实例化 |
| `components/world/objects/SignPost.tsx` | 路标降高、5 个 instanced mesh 覆盖全部路标 |
| `components/world/objects/ButterflyFlock.tsx` | 30Hz 更新 |
| `components/world/ui/IntroToast.tsx` | 滚动区 / 底部操作区、卡外关闭语义 |
| `app/globals.css` | 移动端介绍卡避让、内容自适应抽屉、触屏去 backdrop-filter、footer 作用域修复 |
| `scripts/verify-r4.mjs` | 多状态 FPS / UI / 布局 / CPU 节流 / 长时采样审计 |
| `scripts/make-r4-compare.mjs` | 同状态前后对比图生成 |
| `scripts/capture-world.mjs` / `scripts/world-smoke.mjs` | 强制页面可见 + `?debug=1` + 丢弃首轮采样 |
| `tests/responsive-perf.test.mjs` / `tests/world-layout.test.mjs` | 新 DPR 区间、移动档位覆盖、面板/引导卡布局契约 |

---

## 9. 已知限制

1. **没有真实手机**：移动数据是 Chrome 390×844 / DPR3 移动模拟 + 触控模拟 + CPU 节流，GPU 为 RTX 4050。4× CPU 节流持续 33.8 FPS 是“常见中端机代理”，不是设备实测；6× 低端压力地板 19.4 FPS，未达 30 FPS。真实手机（尤其 Mali / Adreno 中低端 GPU）必须再测。
2. **6× CPU 压力下仍低于 30 FPS**：瓶颈是逐帧 CPU（251 draw calls 的提交与对象/JS 更新），不是 GPU 填充率；空白页在同节流下仍有 ~200 FPS。下一步应按材质静态合并主岛 / 三屿的静态几何，目标 <180 draw calls。
3. **首次着色器编译**：首次进入仍有短暂编译/上传抖动；测量已丢弃预热与异常长帧，但真实用户首屏仍可能看到一次顿挫。后续可用预编译/更小的 program 数进一步收敛。
4. **程序化低多边形边界**：所有资产仍是程序化几何，没有外部高模；R4 的目标是统一设计语言与主次关系，不是写实化。
5. **`?debug=1` / `?tier=` 是验收钩子**：生产默认不注册全局状态、不固定档位；性能报告中的状态探针需要 debug 参数。
6. **旧 `screenshots/r3-final/mobile/report.json` 的 5.3 FPS 不能作为基线**：它测量时页面 hidden，采样被挂起；请使用本报告 2.2 的复现与 3.3 的 R4 数据。