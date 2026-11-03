# R12.1 主岛岩层 / 自然资产与近景视觉验收 — 交付报告

> 2026-11-01 · 五段执行（A 岩层 → B 树木 → C 岩石 → D 地表 → E 机位），
> 每段「真实运行截图确认后再进入下一段」。
> 截图目录：`.r12-shots/r121-baseline/`（改前，10 机位）→ `r121-a/b/c-d-stage/`（各段中间帧）
> → `r121-final/`（最终，10 机位）+ `r121-prod/`（生产环境全套复拍）。
> 采集脚本 `scripts/capture-r121.mjs`（1440×900，`?cam` 验收机位 + 真实首页 + 真实 W 键步行），
> 全部来自真实运行环境；dev 与 prod 均 **0 console errors**。

## 门禁结果

| 项 | 结果 |
|---|---|
| 自动化测试 | **293/293 通过**（R12.0 275 + 本轮新增 18 条守护） |
| TypeScript（tsc --noEmit） | 0 错误 |
| ESLint | 0 错误 0 警告 |
| 生产构建（next build） | 通过（12 路由全部预渲染） |
| 移动端 390×844 | 加载就绪、摇杆/引导卡正常、场景 0 错误（`.r12-shots/r121-smoke/mobile-390.png`） |
| 生产环境复拍 | 10 机位 + 玩家步行，console 0 错误（`report.json` 在 `.r12-shots/r121-final/`、`r121-prod/`） |

## 修改文件清单

**源码（3）**
- `components/world/terrain/islandGeometry.ts` — A：`islandOutcropField`（4 岩突 + 3 断面场，导出可测）、逐层振幅节奏 `layerAmp`、底部收束不对称 `keel`、层理明度分片（0.055·depth 每片 ±8% 明度 + 色相漂移）、岩突受光/断面压暗；D：`mainIslandMicroRelief`（视觉雪垄，幅值 ≤0.17m / 负值钳 −0.035m）、顶面几何 `rockSlopeTint` / `hollowIceTint` 染色选项（只进 color 分支，不进 y 计算）
- `components/world/terrain/floraGeometry.ts`（**新增**）— B：四形态树形数据 + 冠层构建抽离为纯 TS 模块（可测单源）
- `components/world/terrain/MainIsland.tsx` — A：layerJitter 0.028→0.034、岩突/断面参数钉定；B：PINES 重排（西岭主簇改高耸塔形）+ 6 株 tuft 小型装饰树 + 针叶树地表梯度微倾；C：BOULDERS 19 块（新增平板岩/直立石变体 5/6 + 4 处落位）、七变体几何、岩石坡度贴合、大石深埋（scale≥0.6 沉 0.1m）、`ICE_BLOCKS` 三簇冰块群；D：顶面叠加微起伏（`microMaskAt` 避让掩码：广场/出生/冰池/径带/岛缘全归零）、`rockSlopeTint 0.4` / `hollowIceTint 0.34`、南麓 4 条新雪埂

**测试（4 改 1 增）**
- `tests/r121-terrain.test.mjs`（**新增 18 条**）— A：岩突场顶环/底尖保护、带内峰值、几何 ≥3% 局部偏差、接缝逐位一致、明度跳变；B：四形态轮廓契约（层数/高宽比互异）、冠层雪色混合（linear-sRGB 换算）、tuft 落位避让；C：新变体/落位/冰块贴地、岩石坡度贴合+深埋；D：微起伏幅值有界、碰撞场零引用、三区染色只改色、雪埂避让
- `tests/r10-materials.test.mjs` — rockColor 签名正则兼容 seed 参数；压实度场单例钉定
- `tests/r12-island-refine.test.mjs` — MAIN_ROCK 副本 layerJitter 同步
- `tests/r12c-assets.test.mjs` — G11 色相/积雪守护随树形数据迁至 floraGeometry

**工具脚本（2 新增）**
- `scripts/capture-r121.mjs` — 十项验收机位采集（引导卡点击+CSS 双保险）
- `scripts/verify-r121-cams.mjs` — 机位地形净空验证（真实 mainIslandSurfaceY 采样，岛外跳过/看墙机位只验 t≤0.8）

## 十项验收对照（`r121-final/`，均真实运行）

| # | 任务书要求 | 截图（before → after） | 状态 |
|---|---|---|---|
| 1 | 首页初始视角 | `01-home-initial`（baseline → final） | ✓ 南麓雪垄长阴影 / 植被层次 / 冰块群 |
| 2 | 主岛正面 | `02-island-front` | ✓ 岩壁节奏打破 / 底尖不对称 / 三型树 |
| 3 | 主岛侧面 | `03-island-side-west` | ✓ 断面 / 岩突 / 层带明度台阶 |
| 4 | 主岛底部 | `12-rim-underside` | ✓ 岩裙 + 底部收束不规则 |
| 5 | 岩层近景 | `13-rim-close`（**机位重设** −22,−1.5,10→−30,0.8,16） | ✓ 檐口+岩壁+天空构图，不再单一表面占满 |
| 6 | 高耸针叶树近景 | `14a-pine-spire` | ✓ 6 层塔形轮廓（旧 4 层锥叠） |
| 7 | 宽冠针叶树近景 | `14b-pine-broad` | ✓ 4 层宽冠伞形与高耸塔形同框对比 |
| 8 | 小型装饰树近景 | `14c-pine-tuft`（**机位新设**，旧 14 号陷在西岭坡内整幅遮挡） | ✓ 3 层紧凑矮锥 + 岩石雪埋融合 |
| 9 | 岩石与地表融合近景 | `15-rocks-fusion`（机位新设） | ✓ 冰碛脊岩石半埋顺坡 / 晶簇同框 |
| 10 | 玩家实际探索视角 | `19-player-explore`（真实 W 键步行 2.6s） | ✓ 北径门洞 / 微起伏雪原 / 0 错误 |

## 关键决策与红线确认

- **旧 14 号机位是机位问题而非模型问题**：相机 (-10.5,2.6,2.5) 位于西岭坡体内。所有新机位先过
  `verify-r121-cams.mjs` 地形净空再拍；未隐藏/删除任何场景模型。
- **碰撞/导航零改动**：雪垄微起伏只存在于顶面视觉几何，`lib/world/layout.ts` 不引用
  `mainIslandMicroRelief`（测试钉定）；物件落位仍走解析 `mainIslandSurfaceY`，负值钳制保证
  「视觉面只可能雪埋物件底、不可能悬空」。玩家移动/传送/C 径踏板/A-M 径/广场布局/蝴蝶核心/
  AgehaOS 地标本体/首页 UI：一行未动。
- **14c 遇到的「白色大字卡」是 SignPost 品牌名牌**（走近 <13m 的既定显隐行为，distanceFactor
  随距离放大），非 UI 竞态——机位改从 >13m 处取景使其自然隐藏，未改名牌逻辑。
- 既有测试守护同步迁移（rockColor 签名 / 树形数据模块 / 压实度场单例），语义全部保持。
- 三屿与远景屿通过共享几何自动获得岩突/断面/明度台阶（atmosphereFade 位置逐位不变测试仍绿）。

## 已知残留（低优先级）

- `13-rim-close` 构图左上有 C 径踏板入画（真实场景元素，非遮挡缺陷）。
- 岩壁分层的「层带」语言本身保留（风格化低多边形的既定语言），本轮消除的是等节奏重复与
  单一明度区域；若需进一步弱化需另立风格提案。
- 引导卡「刷新重现（无持久化）」为 R3 时代已知遗留，未在本轮范围。
