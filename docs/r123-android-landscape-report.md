# R12.3 Android Chrome 横屏 Moss World 修复验证

2026-11-03，北京时间。同一台 vivo V2284A，Android 15、Chrome 130.0.6723.102，设备 DPR 3.5。前后均为真机 Chrome 截图。修复前证据取自先前验收中同机、同项目屿的横竖屏补测。修复后通过 USB 访问新生产构建，使用 Chrome CDP 原生页面视口、触点命中和触摸输入。横屏复测通过 Android 系统旋转锁临时切换，采集后恢复原来的自动旋转设置。

## 原因与修复

771×266 CSS px 横屏时，交互条原本距底部 6.5rem，按钮顶边落在 y=42.35，触点被上层站内导航截获。给项目交互条标记项目 slug，并仅在粗指针、横屏、高度不超过 400px 时，将 Moss World 交互条改为从既有导航避让线向下排布。按钮顶边变为 y=97.66，高度仍为 44 CSS px。360×706 竖屏的按钮顶边前后均为 y=426.35。

## 复测

| 实际视口 | 修复前每个按钮命中 | 修复后每个按钮命中 | 修复后操作 |
| --- | --- | --- | --- |
| 360×706 竖屏 | 9/9 | 9/9 | 晨雾、正午、暮光逐一点击并进入选中状态，默认重置通过 |
| 771×266 横屏 | 0/9，中心命中站内主导航 | 9/9 | 晨雾、正午、暮光逐一点击并进入选中状态，默认重置通过 |

修复后共 20/20 项检查通过，包括两个方向的详情按钮中心命中和玩家留在画面内。原始 CDP 日志记录 26 条 HTTP 响应，无 HTTP 400 以上响应、加载失败、运行时异常或错误级日志。浏览器警告保留在原始日志中。313 项测试、Lint、生产构建及 git diff --check 通过。

既有 210 文件哈希清单中只有 `app/globals.css` 和 `components/world/ui/HudOverlay.tsx` 发生本轮预期变化，其他 208 项一致。9 个先前阶段证据包与 Android 真机基线证据包哈希一致。本轮 USB 转发和本地服务已结束。复测范围为这台设备的 Moss World 交互条。

## 证据

- [横屏修复前](../.r12-shots/r123-android-landscape-20261103/before/landscape-moss-experience.png) · [横屏修复后](../.r12-shots/r123-android-landscape-20261103/after/landscape-moss-experience.png) · [横屏选中暮光](../.r12-shots/r123-android-landscape-20261103/after/landscape-moss-option-selected.png)
- [竖屏修复前](../.r12-shots/r123-android-landscape-20261103/before/portrait-moss-experience.png) · [竖屏修复后](../.r12-shots/r123-android-landscape-20261103/after/portrait-moss-experience.png)
- [前测日志](../.r12-shots/r123-android-landscape-20261103/before/raw-cdp.jsonl) · [后测日志](../.r12-shots/r123-android-landscape-20261103/after/raw-cdp.jsonl) · [后测触点与点按记录](../.r12-shots/r123-android-landscape-20261103/after/report.json)
