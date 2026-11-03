# R12.4-A 基线固化验证报告

2026-11-03，北京时间。R12.3 的收口范围为桌面 Chrome 和 Android Chrome，iPhone 与 iOS Safari 已移出验收范围。

## 基线记录

| 项目 | 记录 |
| --- | --- |
| Git 参照 | `main`，HEAD `b5dfcee58ccbdcbbc851bca3c61bb4c25aafc156`。基线包含当前未提交内容 |
| 已验收生产构建 | Next.js 16.4.3，BUILD_ID `4ec8fQrT8D712RwuHoZOz`，与 Android 横屏修复后设备记录一致 |
| 本次验证工具链 | Node v24.18.0、npm 11.16.0、Python 3.12.7 |
| 源码与工作区快照 | 213 个 Git 跟踪或未忽略文件，按工作区实际字节保存。另保留 Git 状态、工作区及暂存区差异记录 |
| 生产文件快照 | 376 个文件，包含服务端输出、静态资源、路由清单和 BUILD_ID，排除 `.next/cache`、`.next/dev` |
| 历史证据索引 | 551 个文件，包含 R12.3 各阶段原始证据、接入记录和先前 R12.2 的交付 ZIP。单独的 B 阶段构建副本留在原处 |

[基线记录](../.r12-shots/r124-a-20261103/baseline.json) · [源码和生产归档](../.r12-shots/r124-a-20261103/r123-source-production.zip) · [原始证据索引](../.r12-shots/r124-a-20261103/evidence-manifest.json)

## 验证结果

- ZIP 完整性和逐项 SHA-256 校验通过。归档 SHA-256 为 `459bebf4fabca02f5f0aaea86962909d4f747953250198878fb70b2b357fa357`。归档包含 `source/` 与 `production/.next/`。需要回放时，可在独立目录还原源码并将生产目录中的 `.next` 放到同一项目根，按锁文件准备依赖，再用 `next start` 启动。归档未携带 node_modules。
- 用工作区中与归档字节一致的现有生产构建启动 Next。10 个已知入口和一个静态 JS 返回 200，未知路径返回 404，12/12。服务已停止。[HTTP 原始结果](../.r12-shots/r124-a-20261103/production-smoke.json) · [服务日志](../.r12-shots/r124-a-20261103/production-start.log)
- 313 项测试及 `git diff --check` 通过。回读校验中，213 个原工作区文件、376 个生产文件和 551 个证据文件均未变化。11 个交付 ZIP 另与既有公布哈希对照通过。保留全部既有暂存、未暂存和未跟踪状态。[测试原始日志](../.r12-shots/r124-a-20261103/tests.log) · [回读校验](../.r12-shots/r124-a-20261103/verification.json)
- 从先前 Android 的源码清单对照，既有 210 项中只有横屏修复涉及的 `app/globals.css` 和 `components/world/ui/HudOverlay.tsx` 有差异。当前 BUILD_ID 对应横屏修复后版本。桌面 D 和 Android 15 分钟的历史测量属于修复前证据，横屏修复后的 20 项触点与点按属于当前构建证据。

本轮新增基线归档、清单和文档，未修改产品代码、提交或重建产物。浏览器全流程、24 轮往返及 Android 真机结果作为历史回归对照，本轮验证范围是归档完整性、既有产物启动和工程测试。下次按清单选择与改动相关的回归组。[可复用回归清单](r124-regression-checklist.md)
