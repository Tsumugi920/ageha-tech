# R12.2-B 首页构图与名牌安全区 — 交付报告

日期：2026-11-02。完成范围：默认首屏构图、区域名牌位置、导览碑品牌名牌的屏幕尺寸和边界显隐。未进入 R12.2-C 道路融合。

## 结果

- 三个视口的默认首屏均完整展示蝴蝶，避开顶栏和区域名牌；正常动效与减少动态分别采集。
- 导览碑品牌名牌从随距离放大的数百像素，改为固定 224px 宽；保留原文案、世界锚点和距离淡入。文字无法完整进入可用画幅时收起辅助名牌，避免显示半截文字。
- 最终生产验收 `release` / `normal` / `edge` 共 43 项检查通过、24 张截图；另有 11 张修改前对照。中间两组 24 张图片及原始日志也保留，总计 59 张 PNG。
- 299/299 自动化测试通过；TypeScript、源码 ESLint 和生产构建分别通过。12 个页面生成完成。
- 最终三组累计 0 console error、0 未捕获异常、0 HTTP 错误、0 请求失败；160 条 console warning 未过滤。
- 原有 226 个文件经 SHA-256 核对，仅 7 个预先限定的文件发生修改，其他 219 个逐项一致。R12.1 地形、资产源码及 A 阶段截图、报告保持。

## 方案取舍

| 方案 | 收益和范围 | 结论 |
| --- | --- | --- |
| 只移动区域名牌 | 解决区域牌压翼；蝴蝶翼尖仍进入顶栏 | 不足以满足 B 的首屏目标 |
| 移动区域名牌，并统一抬高相机视点 | 同时解除两处叠压；需同步首帧与跟随并复核近距 | 采用 |

保留 14m 默认距离、58°/64° FOV、yaw、pitch、出生点与所有地标坐标；不缩小或移动蝴蝶模型。

## 实现与文件

**产品源码：**

- `lib/world/constants.ts`：增加共享 `lookHeight: 2.7`（原跟随视点相对玩家为 1.1）；初始 lookAt.y 1.45→3.05、camera.y 3.96→5.56。只抬高 1.6m，XZ 与视角参数保持。
- `components/world/systems/FollowCamera.tsx`：跟随视点与项目屿取景补偿都使用共享高度；原阻尼、遮挡、地面钳制、输入和距离档逻辑保留。
- `app/globals.css`：区域名牌沿导航容器右缘定位；复用没有横向居中位移的既有入场动画，保留 quality/progress 的共享居中动画。品牌名牌宽度限定为 `min(14rem, calc(100vw - 2rem))`，标题 14px、说明 12px。
- `components/world/objects/SignPost.tsx`：只为导览碑移除 `Html distanceFactor`；文字锚点调到 3m，并复用该高度计算距离。约每 6 帧检查投影与实际文字尺寸，只有完整文字位于画幅安全边距内才展示；前后深度也检查，避免镜后名牌。没有修改项目屿的名牌。
- `components/world/ui/HudOverlay.tsx`：仅更新与“右上区域牌”相关的两处注释；保留 `role="status"` 与原内容、交互。

**测试与工具：**

- 新增 `tests/r122-composition.test.mjs`：用真实蝶翼几何、出生点与相机常量验证三种视口投影，并检查首帧与静止跟随高度的一致性。修改前两项桌面投影失败，修改后四项全绿。
- `tests/world-layout.test.mjs`：更新初始机位的两个高度期望；其余布局与路径守护保留。
- `scripts/capture-r122-a.mjs`：在 A 的累计原始日志基础上增加 `framing`、`edge` 分组和真实几何投影探针；增加首屏避让、首动连续性、缩放/旋转、近距名牌及边界显隐验收。旧的 A 分组仍可使用，旧截图未覆盖。
- 本报告：`docs/r122-b-report.md`。

## 前后证据

产物根目录：`.r12-shots/r122-b-20261102/`。下表是相同出生点、相同视口与减少动态条件；相机高度是本轮有意调整的对象，不能称作完全相同机位。

| 视口 | 蝴蝶顶部修改前 / 后 | 导航底部 | 修改后间隔 |
| --- | --- | --- | --- |
| 1440×900 | 38.4px / 113.7px | 82px | 31.7px |
| 2560×1440 | 61.4px / 181.9px | 82px | 99.9px |
| 390×844 移动模拟 | 145.7px / 195.5px | 82px | 113.5px |

测量遍历实际运行场景中 `butterfly-sculpture` 的几何顶点，以当前实际相机投影至 CSS 像素，并与真实 DOM 矩形比较；截图未经重绘或裁切。

对照图片：

- `baseline/41-desktop-closed.png` → `release/41-desktop-closed.png`
- `baseline/41-wide-closed.png` → `release/41-wide-closed.png`
- `baseline/41-mobile-closed.png` → `release/41-mobile-closed.png`
- `baseline/44-brand-approach.png`、`45-brand-around.png` → `release/` 同名文件

本轮基线的近距品牌牌宽约 424px、绕行约 853px，回望右界约 1503px，超出 1440px 画幅。最终走近、绕行与回望都以约 224×54.6px 显示，完整文案可读；额外 `edge/48-brand-in-frame.png`、`49-brand-anchor-offscreen.png` 验证了“入画显示、锚点出界收起”，没有用采集脚本隐藏 UI。

## 真实交互与验证

| 检查 | 结果与证据 |
| --- | --- |
| 三视口首屏和引导开关 | `release/40-*`、`41-*`；`normal/20-*`、`21-*`；均通过 |
| 首次移动连续性 | 真实按 W，采样 45 帧；最大相邻采样相机位移约 0.034m，未出现机位复位跳变 |
| 桌面滚轮 | `release/43-zoom-out.png`；距离索引从 1 变为 2 |
| 桌面拖拽 | `release/46-brand-look-back.png`；yaw 发生实际变化 |
| 移动端双指缩放 | `release/43a-mobile-pinch.png`；CDP 真实触摸事件使距离索引变为 2 |
| 移动端单指旋转 | `release/43b-mobile-orbit.png`；yaw 变化超过 0.2 弧度 |
| 正常动效、自动画质 | `normal/` 不设置 tier 覆盖；桌面 high、移动模拟 medium；三视口首屏投影检查通过 |
| 名牌近距与边界 | `release/44-*` 到 `46-*`、`edge/48-*` 到 `49-*`；正反向条件均通过 |
| 自动化测试 | `test-release.log`：299 通过、0 失败 |
| TypeScript | `typecheck-release.log`：`npx tsc --noEmit --incremental false` 退出 0 |
| 源码 ESLint | `lint-release.log`：`npm run lint -- --ignore-pattern '.r12-shots/**'` 退出 0；最后的采集脚本补充经 `lint-capture.log` 单独复查退出 0 |
| 生产构建 | `build-release.log`：通过，12 个页面 |
| 静态布局扫描 | `layout-scan-release.json`：0 命中；不作为 3D 构图正确的替代证据 |

源码 ESLint 沿用 A 的验收目录排除参数，原因是 A 留存的 Chrome 扩展缓存仍在 Git 忽略的截图目录内。本轮 Chrome profile 全部放在仓库外临时目录，未修改 ESLint 配置、未再次尝试清理 A 的缓存。

## 日志与中间记录

每组均保存 `events.jsonl`、`report.json` 和原始 PNG。warn/error、异常和请求失败按阶段累计，不随导航清空，不按警告文本过滤。

| 目录 | 定位 | 检查 | console error / warning |
| --- | --- | --- | --- |
| `baseline` | 修改前复现 | 7 项预期缺陷被捕获 | 0 / 73 |
| `after` | 首轮实现记录 | 当时自动检查通过；人工检查发现窄换行与下沿裁切，后续修正 | 0 / 71 |
| `final` | 中间采集目录名，不是交付基准 | 1 项回望边界检查失败，后续修正 | 0 / 71 |
| `release` | 最终减少动态、输入与名牌验收 | 24/24 通过 | 0 / 71 |
| `normal` | 最终默认动效验收 | 16/16 通过 | 0 / 71 |
| `edge` | 最终名牌边界验收 | 3/3 通过 | 0 / 18 |

历史 React 卸载警告在本轮生产采集中未复现。Three.js Clock 弃用、重复非索引转换、阴影模式回退及少量着色器精度提示继续原样留存；本轮没有处理这些独立问题。

## 保护与限制

- `preservation-before.json` 和 `preservation-result.json` 记录开工与完工哈希；`unexpectedChanges` 为空。岛体/自然资产、蝴蝶与 AgehaOS 几何、`layout.ts`、`trailDeck.ts`、碰撞与玩家控制源码未改。
- 本轮只保证所测默认首屏的主地标完整；主动近距观察与旋转仍由玩家控制，近景中地标可以出画，没有引入强制锁定或新的自动回正逻辑。
- 移动端结果来自桌面 Chrome 390×844 触摸模拟，不能作为真机画质或帧率结论。
- 未执行完整三径/三项目详情闭环、低端压力降档或长时性能验收；这些仍属于 D。没有以截图或单帧渲染统计宣称 FPS。
- 未改道路；下一步按 R12.2-C 只选择一段入口做道路与地表融合试点。

复现生产环境后运行（每次使用新的输出目录，浏览器 CDP 9223、网站 3457）：

```powershell
node scripts/capture-r122-a.mjs --group framing --out .r12-shots/r122-b-20261102/new-framing
node scripts/capture-r122-a.mjs --group default --out .r12-shots/r122-b-20261102/new-normal
node scripts/capture-r122-a.mjs --group edge --out .r12-shots/r122-b-20261102/new-edge
```

`framing` 使用减少动态便于对照；`default` 保留正常动效和真实引导卡。验收浏览器与临时生产服务在采集结束后关闭，未提交 Git。
