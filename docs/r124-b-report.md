# R12.4-B Android Chrome 音频验证报告

2026-11-03，北京时间。同一台 vivo V2284A（PD2284），Android 15、Chrome 130.0.6723.102。修复前使用已验收构建 `4ec8fQrT8D712RwuHoZOz`，修复后使用从 R12.4-A 源码快照构建的候选版 `kO0oV9gPJnyXqXm_CFobW`。两组各使用独立的 USB 转发来源和测试标签页，保留旧验收页的站点设置。启动时一次现有标签匹配失败，日志留存，正式对照由 CDP 新建并只操作自己的标签。

## 真机结果

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
| 首次打开，手势前 | 未创建 AudioContext | 未创建 AudioContext |
| 默认有声状态首次触摸 | 650 ms 后仍 suspended，时钟为 0，输出 RMS 为 0 | running，时钟推进至 0.613 秒，输出 RMS 约 0.00477 |
| 手动静音 | 静音偏好为 1，输出 RMS 为 0 | 静音偏好为 1，输出 RMS 为 0 |
| 带静音偏好重新加载 | 手势前仍静音，无 AudioContext | 手势前仍静音，无 AudioContext |
| 点按开启声音 | running，输出 RMS 约 0.00361 | running，输出 RMS 约 0.00416 |
| 后台与返回 | 隐藏 11.510 秒，上下文挂起，返回后恢复输出 | 隐藏 11.807 秒，上下文挂起，返回后原上下文自动恢复，输出 RMS 约 0.00359 |
| AudioContext 自动播放警告 | 8 条 | 0 条 |
| 检查 | 7/8，首次触摸无输出 | 8/8 |

CDP 将触摸事件发送到手机真实 Chrome，首触事件记录为 trusted。手机桌面往返由用户实际执行。测量通过临时探针从压缩器输出分支读取 Web Audio 波形，原有扬声器输出路径保留。RMS 衡量页面生成的数字信号，未单独测量手机扬声器声压。两组均无运行时异常、HTTP 错误或加载失败，原始日志各保留 2 条 Three.Clock 弃用警告。

## 原因与局部修复

Chrome 在触摸 `pointerdown` 时记录 `userActivation.isActive=false`，原有监听此时构建音频图并调用 `resume()`，浏览器拒绝启动。首次 `pointerup` 获得激活，但旧实现没有在此时解锁，造成首触无声。后续交互可恢复。修复仅调整 WorldAudio 的解锁监听，将触摸和触控笔放到 `pointerup`，鼠标维持 `pointerdown`，键盘维持 `keydown`。修复后真机事件中，首次触摸在 `pointerup` 获得激活后创建 running 的上下文。

## 验证与保护

313 项测试、Lint、候选生产构建（含 TypeScript）和 `git diff --check` 通过。独立构建日志保留 Next 对多个锁文件的根目录推断提示。对照 R12.4-A，213 个既有工作区文件中只有 WorldAudio.tsx 有本轮变更，376 个原生产文件和 551 个原证据文件的哈希一致，基线归档哈希一致。候选构建位于独立目录，验收服务和本次 ADB 映射已关闭。

- [修复前原始 CDP](../.r12-shots/r124-b-20261103/measurement/raw-cdp.jsonl) · [修复前音频采样](../.r12-shots/r124-b-20261103/measurement/samples.jsonl) · [修复前断言](../.r12-shots/r124-b-20261103/measurement/report.json)
- [修复后原始 CDP](../.r12-shots/r124-b-20261103/after/raw-cdp.jsonl) · [修复后音频采样](../.r12-shots/r124-b-20261103/after/samples.jsonl) · [修复后断言](../.r12-shots/r124-b-20261103/after/report.json)
- [设备记录](../.r12-shots/r124-b-20261103/environment.log) · [候选构建日志](../.r12-shots/r124-b-20261103/candidate-build.log) · [保护校验](../.r12-shots/r124-b-20261103/protection.json)
