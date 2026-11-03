# R12.4-A 回归清单

适用于 R12.3 收口基线和后续候选构建。设备范围为桌面 Chrome 和 Android Chrome。iPhone 与 iOS Safari 已移出验收范围。

## 开跑前

- 记录候选构建的 `.next/BUILD_ID`、源码或提交标识、浏览器版本、视口、DPR 和质量档。使用生产服务与独立的桌面 Chrome 调试会话。桌面 CDP 默认 9223，Next 默认 3457。每组指定全新的输出目录。已有基线用归档校验，候选构建另行标记。
- 以下命令从仓库根目录运行。先创建本次输出的父目录，例如 `.r12-shots/r124-candidate-01`。脚本自行创建各组输出目录。顺序采样，保留失败组、PNG、report JSON 和 events JSONL。
- 工程门槛为 `npm test`、`npx tsc --noEmit --incremental false`、`npm run lint -- --ignore-pattern '.r12-shots/**'`、`npm run build` 和 `git diff --check`。R12.3 共 313 项测试。验收既有构建时直接启动并检查 HTTP 路由。候选构建独立生成，避免覆盖唯一一份已验收产物。

## 桌面流程

```powershell
node scripts/verify-r122-d.mjs --group flow --out .r12-shots/r124-candidate-01/flow
```

核对三条路线实际行走、项目详情打开与关闭、站内传送、茧居所发现与传送。正常流程应无运行时异常、HTTP 错误或请求失败。涉及首页构图时，补看 1440×900、2560×1440、390×844 的启动、首次移动、缩放、旋转和名牌边界截图。涉及树形时，运行下列专项并与 B 阶段照片对比。涉及北径时，按 C 报告用相同机位、路点和横向采样复查衔接与通行。

```powershell
node scripts/capture-r123-b.mjs --group survey --expect-covered true --expect-contact true --out .r12-shots/r124-candidate-01/tuft
```

渲染、加载或容错变更时，另外执行故障注入。核对 WebGL 不可用时的项目入口、上下文恢复、贴图失败后的浏览入口与重试。将注入期间的预期异常和恢复后的正常日志分别统计。

```powershell
node .r12-shots/r123-d-20261103/verify-failure.mjs --out .r12-shots/r124-candidate-01/failure
```

## Android 横竖屏触点

- 用 ADB 确认 vivo V2284A 状态为 `device`，记录 Android/Chrome 版本。使用 `adb reverse tcp:3457 tcp:3457` 和 `adb forward tcp:9228 localabstract:chrome_devtools_remote`。在手机 Chrome 前台打开 `http://127.0.0.1:3457/?debug=1`，先竖屏。看到 `waiting landscape` 后实际转横屏。
- 同机基线为 Android 15、Chrome 130.0.6723.102、CSS DPR 3.5，实际视口为竖屏 360×706、横屏 771×266。记录系统旋转角度和真实视口，不覆盖浏览器的设备指标。
- 验收为每个方向晨雾、正午、暮光各 9/9 个触点命中，逐一点按后对应按钮进入选中状态，默认按钮可重置。详情按钮中心仍可命中，玩家留在画面内。保留两方向的原始 PNG、CDP 日志和触点 JSON。历史修复后为 20/20。
- 涉及移动运行稳定性时，另外验证系统桌面往返和 15 分钟前台。旧主组的三个传送断言存在出生点索引偏移，使用其后附坐标复核作为历史结论。采样记录持续可见、每分钟帧间隔、质量档、渲染 DPR、热状态及上下文丢失事件。R12.3 同机固定视角每分钟 P95 为 16.7 ms，作为对照值。

```powershell
node .r12-shots/r123-android-landscape-20261103/verify.mjs --out .r12-shots/r124-candidate-01/android
```

验收完毕只撤销本次建立的端口映射并停止本次启动的进程。如临时使用系统旋转锁，恢复此前设置。

## 24 轮资源往返与桌面性能

```powershell
node .r12-shots/r123-d-20261103/verify-lifecycle.mjs --group lifecycle --cycles 24 --out .r12-shots/r124-candidate-01/lifecycle
node scripts/verify-r123-a.mjs --repeats 3 --duration 10000 --expect-clean true --url http://localhost:3457 --out .r12-shots/r124-candidate-01/desktop
```

- 资源测试用独立新标签页，执行真实站内往返。核对 25 个采样点的文档时间原点一致、每轮一个活动 WebGL 上下文和一个可用画布，末段 DOM、监听器与缓存贴图订阅无持续累积。独立历史组 102/102，DOM 894、监听器 1598，末八轮堆 22.00–22.11 MiB。数值作为环境对照。若跨度由下降触发，保留失败原始记录，并结合文档数和独立复测判读。持续增长才延长至 48 轮或抓差分堆快照。
- 比较桌面帧耗时应固定场景、视口、质量档、浏览器和来源状态，并先核对 draw calls、三角形和资源计数。D 的同绘制量独立对照三次均值为 10.805、10.314、10.582 ms，P95 均为 15.0 ms。报告保留三次原始帧数据，区分 rAF 间隔与实际显示帧率。
- 记录已知 `Clock`、偶发 `X4122` 和 Android `AudioContext` 警告。后续音频功能单独验证。出现可复现功能故障、相同条件下持续变慢或资源逐轮累积时才启动专项调查。
