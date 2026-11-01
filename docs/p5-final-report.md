# P5 最终回归与收尾报告

> 日期：2026-10-31
> 范围：生产构建的多端回归、失败路径、无障碍、性能与资源稳定性；只修复阻塞项，不扩地图、不新增玩法。
> 本报告记录真实执行结果；未验证项在末节单独列出。

## 1. 结论

P5 功能、失败路径、路由与无障碍在 R10 快照通过；**性能结论未闭环**（宿主 CPU 争用），且**最终全量门禁被并发 R11 地形细化阻塞**：R11 在 21:03 继续修改 `lib/world/layout.ts` / `Trails.tsx`，当前 `npm test` 为 243/245（R11 新测试期望的地形改动尚未落地）。

- P5 快照：生产构建、lint、测试通过（245/245）；
- P5 快照：9 条路由真实加载通过；
- P5 快照：6 个视口 + 移动详情布局通过；
- P5 快照：P2 北径信标、P3 三项目体验、P4 进度持久化/重置在生产构建中真实操作通过；
- P5 快照：WebGL 不可用、上下文丢失/恢复、屏幕贴图加载失败三条失败路径可用；
- P5 快照：键盘焦点、可访问名称、`prefers-reduced-motion` 通过；
- P5 快照：重复循环后 heap / WebGL 资源计数无持续增长。

本轮修复了两个阻塞问题：

1. 屏幕 / 画廊 / 蝶群贴图加载失败会触发整页世界降级；现改为局部错误边界，只失去对应贴图，世界与项目入口保持可用。
2. 加载失败提示在就绪后不可点击且被 `aria-hidden` 隐藏；现改为可聚焦/可点击、读屏可见，并上移避开底部交互带。

## 2. 环境

| 项 | 值 |
| --- | --- |
| OS | Windows 10.0.26100 x64 |
| Node | v24.18.0 |
| Browser | Headless Chrome 156.0.8078.74（独立临时 profile，CDP 9223） |
| GPU | ANGLE NVIDIA GeForce RTX 4050 Laptop GPU（D3D11） |
| CPU / 内存 | 12 线程 / 16 GB |
| 服务 | `npm start -- --hostname 127.0.0.1 --port 3210`，生产构建 |
| 说明 | 3000/3001/3002/3100 被其他应用占用；本项目使用独立 3210 端口。移动端为设备模拟，不是真实手机。 |

## 3. 工程门禁

| 项目 | 结果 |
| --- | --- |
| `npm test` | P5 快照 **245 / 245 通过**；R11 并发改动后当前 **243 / 245**（外部阻塞，待 R11 完成后复跑） |
| `npm run lint` | **当前 R11 源码 0 error / 0 warning**（21:06 复跑） |
| `npm run build` | P5 快照通过，12 个路由静态 / SSG；R11 最新源码未重新构建 |
| 浏览器控制台 | 正常主流程与路由 `errors: []`；失败路径的贴图错误已单独记录 |

## 4. 功能与路由回归（生产构建）

- 1440×900 首访：世界就绪，W 前进位移 8.70，R 回起点。
- AgehaOS：真实传送 + 接近 + 鼠标点击「窗口」→ 1/5；打开真实详情，外部链接保留。
- CS：点击「资产」→ 2/5；详情打开，真实链接保留。
- Moss：点击「晨雾」→ 3/5；详情无任何外链，显示「暂无公开链接」。
- 北径信标：真实走到径头，出现「按 E 或点击 · 点亮北径」，按 E → 4/5；本地记录只含目标 id。
- 进度：刷新后 4/5 保留、记忆环 4 瓣、无重复奖励提示；世界导航「重置探索进度」两步确认后归零、本地键删除。
- 路由逐条加载：`/`、`/projects`、`/about`、`/contact`、`/tech`、`/articles`、`/projects/agehaos`、`/projects/cs-skin-invest`、`/projects/moss-world`，标题与内容均正确。
- 导航链接合同：`/projects`、`/about`、`/tech`、`/articles`、`/contact`、GitHub 均在世界导航中。

## 5. 视口与可访问性

| 视口 | 结果 |
| --- | --- |
| 2560×1440 | 全宽画布；HUD/导航在视口内；无横向溢出；重置按钮 44px |
| 1920×1080 | 同上 |
| 1440×900 | 同上 |
| 1280×650（窄矮桌面） | 同上，导航面板可滚动 |
| 390×844（移动竖屏） | 无横向溢出；摇杆与工具栏不重叠；进度/重置可达；详情封面不塌缩 |
| 844×390（移动横屏） | 无横向溢出；面板不超出视口 |
| 200%（P5 前置 P4 已测） | 无横向溢出；重置按钮 88px 高，可滚动到达 |

- 键盘：从关闭按钮起 **9 次 Tab** 到达「重置探索进度」；Enter 展开确认，焦点落到「确认重置」；Esc 关闭后焦点回到 HUD 导航按钮。
- 焦点可见：`:focus-visible` 为 `2px solid`。
- AX 树名称：世界导航 / 探索进度 / 重置探索进度 / 返回主岛 · 苏醒环礁 / 操作说明 / 跳过探索，直接看项目列表。
- `prefers-reduced-motion: reduce` 生效，世界操作与进度 UI 不受影响。

## 6. 性能

> Headless Chrome 的 rAF 可超过显示器刷新率；采样期间宿主 CPU 占用在 15%–99% 间波动（Nexus / Rainmeter / audiodg / ZCode 等），同一构建的两次采样差异巨大。下列数据只记录观测，**不作为最终硬件结论**；1920 / 2560 / 移动端的旧性能数据不属于 R10 最终快照，未列入结论。

| 视口 / 档位 | Entry avg FPS | Moving | Detail | Closed | 稳态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 1440×900 high（固定档，低负载窗口） | 76.5 | 164.1 | 195.2 | 199.9 | **99.1 FPS / 10.08ms / p95 15ms** | 10s 稳态，0 个 >33.4ms 长帧；587 calls / 270,870 三角形 |
| 1440×900 自动档（宿主 99% 负载） | 54.1 | 83.7 | 75.4 | 82.9 | **40.2 FPS / 24.84ms / p95 70ms** | 自适应降为 medium；96 个长帧；319 calls / 128,034 三角形 |

- 同一份 R10 构建：低负载窗口固定 high 稳态 99.1 FPS，高负载窗口自动降档 medium 仍只有 40.2 FPS。差异来自宿主资源争用，不能据此判断世界性能回退。
- 最终快照场景规模：高档 587–588 draw calls / 270,870 三角形 / 56 programs / 20 textures；低档/medium 约 319 calls / 128k 三角形。
- 首次加载（生产、本地服务、当前高负载环境）：DOMContentLoaded 151ms、load 342ms、世界就绪约 10.4s；35 个资源，decoded 2.22 MB（transfer 744 KB）。此前低负载窗口曾观测到约 4.0s 就绪，说明加载时间同样受宿主争用影响。
- **性能/低端设备门禁未闭环**：需要在干净主机或真实手机上复测，才能判断 30/60 FPS 目标。

## 7. 资源稳定性

- 预热三岛后连续 3 轮传送（1→2→3→R），最终 R10 快照：
  - heap +0.42 MB；
  - geometries **+0**（420 → 420）；
  - textures **+0**（22 → 22）；
  - calls / triangles / programs 保持不变（588 / 270,872）。
- 首次靠近各岛会延迟创建演示屏相关几何，预热后稳定，不是持续泄漏。

## 8. 失败路径

| 场景 | 结果 |
| --- | --- |
| WebGL 不可用（拦截 canvas webgl context） | 渲染 `FallbackProjects`：3 张真实项目卡 + 全部项目列表入口 + 站内导航；无白屏 |
| WebGL 上下文丢失 | 恢复遮罩出现；`WEBGL_lose_context.restoreContext()` 后遮罩消失，世界恢复 |
| 屏幕 / 画廊 / 蝶群贴图全部拦截 | 世界保持 `ready`，项目提示与 P3 体验仍可用；只失去对应贴图；出现「部分区域未能点亮」alert，重试 / 项目列表入口 `pointer-events: auto`、`aria-hidden=false`；点击项目列表真实跳转 `/projects` |
| 正常网络 | `Network.loadingFailed: []`，HTTP 4xx/5xx: `[]` |

## 9. 本轮修复

- 新增 [components/world/systems/TextureBoundary.tsx](../components/world/systems/TextureBoundary.tsx)：局部捕获按需贴图错误，替换为暗屏 / 空框 / 无蝶群，不再把整个 Canvas 交给世界降级边界。
- [components/world/objects/ProjectIsle.tsx](../components/world/objects/ProjectIsle.tsx)、[GalleryNook.tsx](../components/world/objects/GalleryNook.tsx)、[WorldCanvas.tsx](../components/world/WorldCanvas.tsx)：接入局部纹理错误边界。
- [components/world/loading/LoadingScreen.tsx](../components/world/loading/LoadingScreen.tsx)：失败状态保留读屏可见性，不被 `aria-hidden` 隐藏。
- [app/globals.css](../app/globals.css)：失败提示上移至 22%，限制宽度，开启可操作性指针事件。
- 最终 lint 收敛（R10 调试代码，语义等价）：[FollowCamera.tsx](../components/world/systems/FollowCamera.tsx) 的 `useMemo` 回调改为内联表达式；[WorldDiagnostics.tsx](../components/world/systems/WorldDiagnostics.tsx) 的 `?hide=` 调试隐藏逻辑移出组件，避免直接改写 hook 返回的场景值。

## 10. 证据

- [P5 主报告](../screenshots/p5-final/report.json)
- 性能（R10 最终快照）：[1440 固定 high](../screenshots/p5-final/perf-1440/report.json)、[1440 自动档](../screenshots/p5-final/perf-1440-adaptive/report.json)；1920 / 2560 / 移动端旧数据不作为 R10 最终结论
- 截图：[首屏](../screenshots/p5-final/01-desktop-1440-entry.png)、[北径目标](../screenshots/p5-final/03-desktop-1440-relay.png)、[进度/重置](../screenshots/p5-final/04-desktop-1440-nav-progress.png)、[WebGL 降级](../screenshots/p5-final/07-webgl-unavailable.png)、[上下文丢失](../screenshots/p5-final/08-context-lost.png)、[资源失败](../screenshots/p5-final/10-resource-blocked.png)、[2560](../screenshots/p5-final/11-desktop-2560.png)、[移动详情](../screenshots/p5-final/12-mobile-detail.png)、[说明面板](../screenshots/p5-final/13-help-panel.png)

## 11. 未验证 / 已知限制

- **最终门禁被并发 R11 阻塞**：R11 仍在修改 `lib/world/layout.ts` / `Trails.tsx`，当前全量测试 243/245（R11 地形期望未落地）；本报告中的 P5 浏览器回归基于 20:58 的 R10 快照。R11 完成后必须重跑 lint/test/build + 本轮 P5 脚本。
- **真实手机未测试**：390×844 / 844×390 为 Chrome 设备模拟；移动端只在功能/布局层验证，低端性能未闭环。
- **性能门禁未闭环**：宿主 CPU 在 15%–99% 间波动；同一 R10 构建固定 high 稳态 99.1 FPS，自动降 medium 的另一次采样只有 40.2 FPS。1920 / 2560 / 移动端性能未在最终 R10 快照的干净主机上重跑，不能作为最终硬件结论。
- **真实屏幕阅读器未测试**：只验证了 AX 树名称与键盘焦点，未用 NVDA / VoiceOver 实读。
- **真实资源/CDN 故障未测试**：失败路径用 CDP 请求拦截模拟，未覆盖真实网络抖动、部分响应或缓存损坏。
- **真实驱动上下文丢失未测试**：使用 `WEBGL_lose_context` 扩展；恢复成功，但不等于真实 GPU 崩溃场景。
- **音频输出未在 headless 中复测**：P5 验证了世界/UI/按钮状态，未验证扬声器实际输出；P2 阶段已有音频闭环记录。
- **茧居所旋径步行发现未在本轮复跑**：P4 已覆盖其目标映射、存档恢复、重置入口；本轮未重新走完整长路径。
- 自动档在首轮加载抖动后会降为 medium；这是既有自适应策略的实际行为，若希望桌面始终保持 high，需要在更多真实设备上评估阈值。
- 本报告与 P5 脚本均不改变现有业务、路由、项目数据或规格文档。
