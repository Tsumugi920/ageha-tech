# R12.2-D 全流程探索与性能回归报告

日期：2026-11-02。验收版本为当前工作区的生产构建；未提交 Git、未部署。R12.1 与 R12.2-A/B/C 的源码、截图和日志均按开工前哈希清单保护。

## 验收结果

- 最终完整运行 `release-01`：**254 项浏览器检查通过，36 张真实截图**；覆盖三径步行、三项目详情闭环、回航、全部传送点、茧居所自然入口、移动触摸、减少动态效果、自动降档及 12 次首页往返。
- 独立新页面的 12 次资源对照 `resource-comparison-after`：**41 项检查通过**；预热后 DOM 节点保持 894，事件监听器保持 1598，活动 WebGL 上下文始终为 1。
- **308/308 自动化测试、TypeScript、源码 ESLint、生产构建通过**，生成 12 个页面。
- 最终完整运行：0 console error、0 未捕获异常、0 浏览器错误、0 HTTP 错误、0 请求失败或取消。**341 条 warning 原样保留**，不等于零警告。
- 564 个既有文件中，4 项预期修改、560 项字节不变，0 意外修改或缺失。自然资产、共享布局、移动/碰撞、三径几何以及 A/B/C 旧证据未变。

性能与内存结论有边界：本轮移除了已定位的渲染器/DOM 累积保留；独立 12 轮的 JS 堆仍有约 2.51MiB 增长，不能据此宣布完全无泄漏。桌面平均帧耗时也比本轮基线略高，具体数据如下。

## 本轮修复及文件范围

| 文件 | 与验收问题对应的变化 |
| --- | --- |
| `components/world/systems/FollowCamera.tsx`、新增 `cameraFraming.ts` | 避障把相机拉近时，原抬高视线可能将信灯推出下沿；在跟随取景后按实际投影微调俯仰，使玩家参考点至少保留约 11% 下沿余量；相机位置及避障结果不变 |
| `components/world/systems/AdaptiveQuality.tsx` | 观察实际 `viewport.dpr`；Canvas 父层重渲或 resize 重设初始 DPR 区间后，重新落实当前动态档位上限 |
| `components/world/WorldCanvas.tsx`、新增 `textureLifecycle.ts` | 在首帧前记录当前渲染器实际使用的贴图、几何和材质；卸载时解除资源订阅并恢复原方法，覆盖 Three 共享 LUT、空贴图和共享几何 |
| 新增 `tests/r122-camera-safety.test.mjs` | 桌面/移动短距离相机复现、原首页取景不变，3 项 |
| 新增 `tests/r122-texture-lifecycle.test.mjs` | 共享资源跨多次渲染器生命周期释放、临时贴图提前释放、绘制参数与调用绑定不变，3 项 |
| 新增 `scripts/verify-r122-d.mjs` | 真实输入、连续日志、帧间隔原始样本、资源计数与断言；复用 A 的追加式证据记录器 |
| `README.md`、本报告 | 更新本轮状态、用例数、验证方式和限制 |

资产组件中的试验性清理修改已撤回；最终清理集中在 Canvas 生命周期。没有修改贴图内容、模型造型、世界坐标、玩家速度、路线、碰撞、C 径踏板或北径铺装试点。

## 真实探索覆盖

三径均从出生区使用真实 WASD 输入沿现有样条采样行走，经过入口和跨海段到达项目交互区；不是把玩家坐标写到目的地。每个目标的按键、实际位置、地面高度和终点误差保存在 `report.json`。

| 路线/操作 | 最终证据（位于 `release-01/`） |
| --- | --- |
| 北径 A → AgehaOS → 详情 → 返回探索 → 主岛 | `trail-a-midway/arrival/detail/return-explore/main-return.png` |
| 东南径 M → Moss → 详情 → 返回探索 → 主岛 | `trail-m-midway/arrival/detail/return-explore/main-return.png` |
| 西南径 C → CS → 详情 → 返回探索 → 主岛 | `trail-c-midway/arrival/detail/return-explore/main-return.png` |
| 主岛西北缘 → 旋径下行 → 茧居所 → 解锁导航入口 | `gallery-midway.png`、`gallery-discovered.png`、`gallery-nav-unlocked.png` |
| 数字键传送三屿、导航回航、已发现茧居所传送 | `teleport-isle-*.png`、`gallery-teleport.png` |
| 移动触摸摇杆、导航和详情 | `mobile-joystick-moved.png`、`mobile-nav.png`、`mobile-detail.png` |
| 减少动态效果下的移动与 R 回起点 | `reduced-motion-controls.png` 与对应断言 |
| 自动降档、窗口缩放后 DPR、解除压力恢复 | `auto-downgrade-low.png`、`low-tier-after-resize.png`、`post-stress-recovery.png` |
| 反复离开首页、进入 about、通过站内链接返回 | `lifecycle-0.png`、`lifecycle-12.png` 与逐轮资源记录 |

松键后控制器原本保留惯性。首轮详情位置断言过早采样而失败，最终脚本等待停稳再比较；没有为测试修改运动规则。详情关闭保持世界与位置，真实回航及传送仍使用产品自身入口。

所有截图由生产页面的 CDP `Page.captureScreenshot` 直接生成；未重绘、裁切、隐藏模型或注入 CSS 遮罩。引导卡通过正常按钮关闭。自然行走前后受输入时序影响，不宣称为像素级同机位对照。

## 性能条件与结果

Windows 11（10.0.26100）、AMD Ryzen 5 6600H、NVIDIA RTX 4050 Laptop GPU，经 ANGLE/D3D11；Node 24.18.0、Chrome 156 Headless。设备信息和完整 GL renderer 字符串保存在最终报告 JSON。

桌面 1440×900，设备 DPR 1；移动模拟 390×844，设备 DPR 3，渲染 DPR 按档位限制。每种稳态先等待就绪和预热，再连续采集两轮、每轮约 10 秒的 rAF 间隔；不丢弃长帧。样本保留完整间隔数组、逐秒档位、DPR、draw calls 和三角形。

页面每轮均检查 `visibilityState=visible` 和焦点状态，CDP 启用焦点模拟。Headless 没有实体前台窗口；这些是浏览器回调节拍，**不是物理显示帧率或手机真机成绩**。

| 条件 | 两轮平均帧间隔 ms | 两轮 p95 ms | >33.4ms 长帧合计 | draw calls | 三角形 | 渲染 DPR |
| --- | --- | --- | --- | --- | --- | --- |
| 桌面自动档，实际 high | 11.90 / 11.93 | 15.10 / 15.10 | 1 | 636–641 | 282170–282180 | 1 |
| 移动模拟自动档，实际 medium | 5.57 / 5.78 | 10.00 / 10.00 | 0 | 304–307 | 128722–128728 | 1.25 |
| 桌面固定 low | 5.11 / 5.13 | 5.10 / 5.10 | 0 | 342–344 | 133150–133154 | 0.85 |
| 桌面减少动态效果，high | 11.26 / 12.84 | 15.10 / 20.00 | 0 | 637 | 282172 | 1 |

draw calls 与三角形采用现有探针的渲染多遍统计口径。稳态四组共 80 秒，全部无 >50ms 长帧；三径实走阶段另保存完整帧记录，包含转向、减速及截图停顿，不作为纯稳态样本混算。

同机本轮基线 `performance-before` 的桌面两轮平均为 10.85/10.88ms，当前约增加 1.05ms；移动基线 5.01/5.31ms，当前也略高；低档基线 5.39/5.06ms，当前落在该区间附近。减少动态效果基线为 15.38/14.98ms，当前更低。存在时序、缓存和运行波动，本轮不将这些差异归因为单一改动，也不宣称全场景加速或零性能回退。在本机 Headless 环境，桌面与低档平均回调节拍满足争取 60/30 的目标；不能外推到所有设备。

降档测试明确施加 **6 倍 CPU 节流 + 每帧额外 35ms 主线程忙等待**，持续约 40 秒。实际从 high 降至 medium、low，后段 low DPR 保持 0.85，1366×900 resize 后仍保持；旧版本在同类测试中曾回到 DPR 1。压力组平均约 105.93ms、p95 180ms，属于人工阻塞结果，不作为正常低档性能承诺。解除压力后约 10 秒采样平均 5.05ms，并观察到恢复 medium；过渡组保留 1 个 >50ms 长帧。

## 资源保留复现与修复验证

初始 12 次往返可稳定复现每轮约增加 326 个 DOM 节点。堆快照显示共享贴图（包括 DFG LUT）与共享几何的 `dispose` 监听器保留旧渲染器，进而保留旧 canvas 及页面 DOM。仅补普通贴图清理不足以解决问题；共享几何的复现单测也先失败（仍保留 2 个订阅），完整管理实际渲染资源后通过。

资源管理只作用于当前 renderer 的属性查询和实际绘制调用；参数及调用绑定保持原样。资源提前 `dispose` 时即退出集合，防止管理器继续保留临时资源；世界卸载时释放仍使用的资源，再恢复原方法。图片 CPU 数据与几何数据保留，后续页面可以重新上传，不清空加载缓存或改动素材。

独立新页面的同条件对照（high、减少动态效果、每轮强制 GC；第 1 次往返后作为预热基点）：

| 指标 | 修复前 `resource-audit` | 修复后 `resource-comparison-after` |
| --- | --- | --- |
| 第 1 → 12 次 DOM 总节点 | 894 → 4480 | 894 → 894 |
| 第 1 → 12 次 JS 堆 MiB | 21.37 → 31.76 | 20.73 → 23.24 |
| 活动 WebGL 上下文 | 始终 1 | 始终 1 |
| 缓存贴图监听器 | 另一个两轮复现中 1 → 2 → 3 | 第 0–12 次均为 2：管理器与当前 renderer 各 1 个 |
| 预热后事件监听器 | 逐轮增加 | 始终 1598 |

完整探索之后的另一组 12 轮也通过：预热后 DOM 始终为 2554，JS 堆范围约 54.41–56.39MiB，末次 55.64MiB，活动上下文始终为 1。两组起始堆不同，不能跨组直接作绝对值比较。

**仍有观察项：**独立组第 1→12 次 JS 堆仍增加约 2.51MiB。已确认消除上述 DOM 与 renderer 订阅逐轮累积，剩余堆变化没有在本轮穷尽归因，不能证明长期完全无泄漏。首次 debug 进入及路由/代码缓存预热也会影响基点；诊断探针源码未顺手改动。本轮检查不替代长时间真机稳定性测试。

当前生命周期适配 Three r186 的 `properties.get` 与 `renderBufferDirect`；将来升级渲染器时应重跑同一组测试，而不是仅看页面仍能打开。

## 工程检查与日志

| 检查 | 结果 / 最终日志 |
| --- | --- |
| 自动化测试 | 308/308；`test-resources.log` |
| TypeScript | 退出 0；`typecheck-resources.log` |
| 源码 ESLint | 退出 0；`lint-resources.log` |
| 生产构建 | 退出 0、12 页面；`build-resources.log` |
| 完整浏览器回归 | 254/254；`release-01/report.json`、`events.jsonl` |
| 独立资源对照 | 41/41；`resource-comparison-after/report.json`、`events.jsonl` |
| 文件保护 | 564 项，4 预期修改，0 意外修改；`preservation-result.json` |
| PNG 完整性及指纹 | 全部 123 张历史/诊断/最终图验证成功；`screenshots-sha256.json`，其中最终完整组 36 张 |

ESLint 使用 `npm run lint -- --ignore-pattern '.r12-shots/**'`。未排除的全目录命令会扫描 A 遗留的临时浏览器第三方文件；没有为此修改 ESLint 配置。

最终完整组 341 条 warning：304 条重复几何转换、19 条 Clock 弃用、17 条阴影兼容回退、1 条着色器精度提示。React synchronous root-unmount 警告在本次生产运行未复现，不能据此声明所有环境中已经根除。Node 模块类型提示也保留，没有修改 package 模块类型消音。

所有旧轮次与失败记录保留，`run-index.json` 列明各轮的失败断言及运行错误。包括早期惯性采样误判、资源修复红测、候选方案类型检查失败及一次未就绪服务的采集失败；它们不作为最终通过证据，也未从整轮历史中删除。最终工程检查以上表日志为准。

## 交付与复现

产物目录：`.r12-shots/r122-d-20261102/`。`summary.json` 汇总性能、资源与警告，`verification.json` 汇总最终门禁，`release-01/report.json` 保留原始帧数组和操作细节。堆快照及保留链文本在 `heap-diagnosis/`。ZIP 包含报告副本、截图、追加式原始事件、检查/诊断日志、指纹与代码变更清单。

复现须先完成生产构建，启动本地 3457 服务和独立 CDP 9223 Chrome；Chrome profile 放在仓库外，不使用用户现有浏览器会话。随后运行，输出目录必须全新：

```powershell
node scripts/verify-r122-d.mjs --group all --cycles 12 --out .r12-shots/r122-d-20261102/new-run
node scripts/verify-r122-d.mjs --group lifecycle --cycles 12 --out .r12-shots/r122-d-20261102/new-resource-run
```

截图组保持正常产品 UI；原始 console/warn/异常/失败请求按阶段追加保存，导航不清空，不按指定文字过滤。临时服务和本轮独立浏览器在交付前关闭，已有工作区与旧浏览器缓存不清理。
