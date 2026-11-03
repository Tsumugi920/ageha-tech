# R12.3-A Three 警告归因与桌面性能复验

日期：2026-11-02。版本：当前未提交工作区的生产构建；未提交 Git、未部署。只实施两处有复现证据的业务源码修复，没有升级依赖、修改移动/碰撞/路径或重做视觉资产。

## 结果

- 两处修复：删除晶簇尖端的冗余非索引转换；显式选择当前实际生效的 PCF 阴影。正常加载的 console warning 从 **18 → 1**，剩余为 R3F 内部 Clock 弃用提示。首次冷加载另出现过 PMREM 驱动精度提示，不能声称所有环境零警告。
- 修复前后各 **3×30 秒**桌面正常动效采样。平均值见下表；没有观察到本次修复带来回退，但不把顺序采样中的下降当成已证明的性能优化。历史约 1.05ms 的变化仍没有充分因果证据。
- **310/310 测试、TypeScript、源码 ESLint、12 页面生产构建通过**。新增两项回归测试先失败后通过；原有阴影测试同步守护显式配置。
- 修复后五组采集共 **101 项浏览器检查通过**，正常运行各类 error/异常/请求失败均为 0，**25 条 warning 原样保留**。所有轮次共 **36 张真实生产页面截图**，包含修改前和失败复现证据。
- 734 个既有文件中，**730 项字节不变、4 项预期修改、0 意外修改或缺失**；R12.1/R12.2 旧报告、截图、日志和 ZIP 保留原字节。

## 1. 复现、来源与处理

快速生产复现命令：

```powershell
node scripts/verify-r123-a.mjs --repeats 0 --sources true --expect-clean true --out .r12-shots/r123-a-20261102/warnings-before
```

该轮实际退出 1：捕获重复转换与阴影回退警告，专门断言失败；没有应用错误。两个 Node 回归测试也分别以“4 条冗余转换”和“阴影 type 2 而非 1”失败。原始红测保留为 `warnings-before.log`、`compat-red.log`。

| 警告 | 实际调用来源 | 本轮处理与依据 |
| --- | --- | --- |
| `BufferGeometry is already non-indexed`，每次加载 16 条 | `MainIsland` 晶簇调用 → `createCrystalSprayGeometry` → `OctahedronGeometry(..., 0).toNonIndexed()`；其 Polyhedron 基类直接生成非索引属性 | 只删除尖端上的一次 `.toNonIndexed()`。Three 在此分支原本警告后直接返回同一个对象，删除 NOOP 不改变网格 |
| `PCFSoftShadowMap has been removed`，每次高档初始化 1 条 | `Canvas shadows={true}` → R3F 9.8.2 把布尔值映射为 PCFSoft → Three r186 渲染阴影时回退到 PCF | 改为 `{ enabled: initialTier.shadows !== false, type: PCFShadowMap }`。保留初始档开关，也为中/低档未来升档预先选择有效模式。修复前后页面实际 type 均为 1，没有切换阴影风格 |
| `Clock ... deprecated`，每个 Canvas 初始化 1 条 | R3F 内部 store 的 `clock: new THREE.Clock()` | 保留。仅替换业务调用无法处理其内部时钟；不升级框架、不替换时钟接口、不拦截日志 |
| `Program Info Log / X4122`，初始复现和最终多视口组各 1 条 | `SceneEnvironment` → `PMREMGenerator.fromEquirectangular` → `_applyPMREM/_applyGGXFilter` → WebGLProgram → ANGLE/D3D11 编译日志 | 属于库生成 shader 的精度提示，页面能正常生成环境反射。最终多视口仍能复现，明确保留；不改第三方 shader、驱动或产品精度配置来消提示 |

警告堆栈原样保存在 `warnings-before/events.jsonl`；对应生产脚本和调用处片段在 `warning-sources.json`、`warning-source-context.txt`。已安装库的相关源码片段及指纹在 `installed-source-evidence.json`，不依赖版本外推断。

## 2. 修改范围与行为守护

| 文件 | 变化 |
| --- | --- |
| `components/world/terrain/islandGeometry.ts` | 晶簇尖端删除冗余转换，1 行 |
| `components/world/WorldCanvas.tsx` | 引入 PCFShadowMap；Canvas 显式配置 enabled/type |
| `tests/r123-three-compat.test.mjs`，新增 | 调用真实晶簇生成器，断言无警告且原有全部几何属性字节指纹一致；读取实际 Canvas 配置并通过已安装 R3F 的真实 root 配置验证高/中/低档开关与 PCF |
| `tests/responsive-perf.test.mjs` | 更新原布尔写法断言为显式 PCF，保留初始档开关约束 |
| `scripts/verify-r123-a.mjs`，新增 | 追加式警告堆栈、真实按钮输入、原始帧间隔、逐秒状态、PNG；调试源采集只用于快速归因组，不进入正式性能组 |
| `README.md`、本报告 | 当前 310 项测试与 R12.3-A 结果入口 |

晶簇使用与现有地面晶簇一致的四根参数；修复前后 336 顶点、非索引、全部属性合并 SHA-256 均为 `e9461a109eedcb6f39f4187c340aef16c64dbe10a0cf4bff178ef859402ebc73`。尖端的材质、尺寸、位置、法线及实例数量没有变化。

初版完整测试出现 309/310：唯一失败为旧测试要求布尔阴影写法。改为守护显式配置后 310/310；初版日志保留为 `test-after.log`。回归测试的 R3F Node 导入也会产生 Clock/CJS 弃用提示，未隐藏，不能将它们误作新增浏览器错误。

## 3. 桌面帧耗时复测

环境：Windows 11 10.0.26100、Ryzen 5 6600H、RTX 4050 Laptop GPU，经 ANGLE/D3D11；Chrome 156.0.8078.74 Headless、Node 24.18.0、Three 0.186.1、R3F 9.8.2。详细 GPU/驱动与浏览器信息在各组 `report.json`；CPU/系统记录为 `cpu.json`、`os.json`。

条件：1440×900、设备/渲染 DPR 1、固定 high、默认出生机位、正常动效。真实点击关闭引导后预热 5 秒，连续三组各 30 秒；采样期间不截图、不抓堆、不 GC、不施加人工压力。逐秒检查可见、焦点、档位与 DPR；原始间隔完整保存，不删除长帧。生产服务启动前完成构建，采样时没有同时运行工程测试或构建。

| 组别 | 第 1 / 2 / 3 组平均 ms | 第 1 / 2 / 3 组 p95 ms | >33.4ms / >50ms 合计 |
| --- | --- | --- | --- |
| 修改前 R12.2 完成态 | **15.385 / 13.263 / 13.274** | **25.0 / 20.0 / 20.0** | **21 / 0** |
| 两处修复后 | **12.917 / 12.799 / 12.947** | **20.0 / 20.0 / 15.1** | **0 / 0** |

六组共 180 秒；修改前 6472、修改后 6985 个间隔。每组均值的平均为 13.974 → 12.887ms；合并原始样本平均为 13.906 → 12.887ms，口径分别列明。两版 draw calls 均为 **634–639**，三角形均为 **281890–281900**，相机/玩家、实际阴影 type 与画布尺寸一致。

**结论边界：**修改前自身三组均值跨度约 2.12ms，已超过历史 D 报告的约 1.05ms 差异。该历史差异仍不能直接归因于资源管理适配或某个渲染调用；本轮没有重建当时的全部前置版本与会话状态，也没有把当前两版对照冒称为历史版本因果实验。两处修复主要消除初始化阶段 NOOP/回退，不据此宣称稳态加速。因此保留历史差异为未归因观察项，本轮不修改逐帧资源追踪、相机、安全区、自动档或其他性能逻辑。

本轮采样是 Headless rAF 回调节拍，**不是实体显示器 FPS 或手机真机性能**。原始数据和汇总为 `performance-before/report.json`、`performance-after/report.json`、`desktop-comparison.json`。

## 4. 构图、动态档位与资源复验

| 最终组 | 检查 | 截图 | console error / warning |
| --- | --- | --- | --- |
| `performance-after` | 6/6 | 2 | 0 / 1 |
| `visual-after` | 3/3 | 2 | 0 / 1 |
| `framing-after` | 24/24 | 13 | 0 / 5 |
| `performance-regression` | 27/27 | 11 | 0 / 5 |
| `lifecycle-after` | 41/41 | 2 | 0 / 13 |

最终组累计 101 项；warning 为 **24 条 Clock 弃用与 1 条 PMREM 精度提示**，重复转换与阴影回退没有再次出现。未捕获异常、浏览器错误、HTTP 错误、请求失败或取消均为 0。修改前及红测另有 6 张 PNG，与最终 30 张共 36 张，原始日志不合并成虚假的单轮通过。

封装时首个“最终 warning 全部为 Clock”断言失败，原始日志确认多视口组仍有 1 条精度提示；已纠正分类及此报告，没有删除提示或修改业务代码来通过封装。

构图覆盖 1440×900、2560×1440、390×844，包含首动、缩放、移动双指、旋转、近距名牌及回望边界。固定 reduced-motion 前后 PNG 的每通道平均绝对差约 **0.0014/255**，差异集中于小片区域；不是逐像素完全相同。原始图均保留，没有重绘、裁切或隐藏模型。几何是否保持另由数值指纹守护。

动态回归的桌面自动档均值为 12.376/12.005ms，移动模拟 5.008/5.134ms，固定 low 5.107/5.033ms，reduced-motion 11.124/11.854ms；这些额外 10 秒采样不混入上表正式 30 秒对照。四类稳态均无 >50ms 长帧。

人工压力独立施加 6 倍 CPU 节流与每帧 35ms 忙等待，验证 high→medium→low；low 和 resize 后 DPR 均为 0.85。解除压力恢复 medium，恢复组平均 5.260ms，保留 1 个 >50ms 过渡帧。压力组平均 117.165ms、p95 224.9ms 是故意阻塞结果，不是正常性能成绩。

12 次首页→about→首页通过真实站内链接完成。第 1–12 轮 **DOM 890、监听器 1596、活动 WebGL 上下文 1**，缓存贴图 dispose 监听器保持 2。JS 堆从约 **20.753 → 23.281MiB**，仍有约 2.53MiB 预热阶段增长；本轮没有把该值写成零增长，也没有重做堆归因。它与已完成的 [48 轮归因](r122-d-heap-report.md) 一并保留，本轮只确认 DOM/监听器/上下文未恢复逐轮累积。

本轮没有重新执行完整三径全流程或真机测试，不借 A 的局部回归替代 D 的设备矩阵。此前完整 D 证据原样保留。

## 5. 工程验证、保护与交付

开工 308 项测试、类型、源码 lint、生产构建全部通过；修复后新增两项测试，最终 310 项通过。类型及构建对应两处最终业务源码；后续仅调整测试和文档。源码 lint 使用 `npm run lint -- --ignore-pattern '.r12-shots/**'`；未修改配置，未清理 A 的旧 Chrome 缓存。

最终日志：`test-final.log`、`typecheck-after.log`、`lint-final.log`、`build-after.log`、`script-check.log`、`diff-check.log`；退出状态和各浏览器组汇总见 `verification.json`。

保护清单覆盖源码、未跟踪文件、依赖锁文件与 R12.1/R12.2 旧证据。仅有 README、WorldCanvas、islandGeometry、responsive-perf 测试四项预期变化；其余 730 项不变。共享布局/高度、移动、碰撞、导航、C 径踏板、北径、B 的构图、D 的安全/DPR/资源管理及所有旧交付未改。新文件为兼容回归测试、采集脚本和本报告。准确源码补丁为 `product-changes.patch`。

组合启动命令首次被自动审批以 `blocked by policy` 拒绝，未执行；随后分别启动独立服务和仓库外 profile 浏览器成功，未要求额外权限。验收结束关闭本轮服务与浏览器，不删除任何既有文件。

交付目录：`.r12-shots/r123-a-20261102/`。包含全部前后图、失败记录、追加式事件、调用来源、帧数据、检查日志、保护清单和独立 ZIP。下一阶段可按计划进入 B 的树形样例；未消除的依赖提示、历史性能归因与真机覆盖继续明确记录。

## 复现

先完成生产构建，启动 3457 生产服务和 9223 独立 Chrome，profile 放在仓库外；每次使用全新输出目录：

```powershell
node scripts/verify-r123-a.mjs --expect-clean true --out .r12-shots/new-r123-a-steady
node scripts/verify-r123-a.mjs --repeats 0 --sources true --expect-clean true --out .r12-shots/new-r123-a-warnings
node scripts/capture-r122-a.mjs --group framing --out .r12-shots/new-r123-a-framing
node scripts/verify-r122-d.mjs --group performance --out .r12-shots/new-r123-a-performance
node scripts/verify-r122-d.mjs --group lifecycle --cycles 12 --out .r12-shots/new-r123-a-lifecycle
```

实际截图示例：[桌面](E:/AgehaTech/.r12-shots/r123-a-20261102/visual-after/home-after-samples.png)、[移动模拟](E:/AgehaTech/.r12-shots/r123-a-20261102/framing-after/41-mobile-closed.png)、[低档 resize](E:/AgehaTech/.r12-shots/r123-a-20261102/performance-regression/low-tier-after-resize.png)。
