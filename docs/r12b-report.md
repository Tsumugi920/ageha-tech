# R12.0-B 主岛与屿体地貌精修 — 交付报告

> 2026-11-01 · 对应审计报告 `docs/r12-visual-audit.md` 的 G4 / G5 / G6 三项（P0×2 + P2×1）。
> 截图：`.r12-shots/audit-baseline/`（改前）vs `.r12-shots/audit-b-after2/`（改后，19 机位，
> 0 console errors）。`audit-b-after/` 为 agehaos 加档前的中间迭代，仅留档。

## 改动内容（4 文件，全部为几何生成层参数/算法，不动碰撞与布局数据）

### 1. `components/world/terrain/islandGeometry.ts` — 竖向破口 + 层带跳变 + 色差

- **新增 `islandBreachField`（导出，可测）**：在 `breachCount` 个确定性方位生成宽幅
  竖向裂口——方位不均分（±1/4 间距偏移）、随层位向下扭转（~0.42 rad）、核心深切 +
  两侧窄翻缘外凸；仅作用于 `depthRatio > 0.3` 的中下部，**顶环 / 雪檐完全不动**。
- **层带跳变**：下半部（depthRatio>0.45）每层附加确定性整体错位
  （≤ layerJitter·depth·0.8），折入既有 jitterLimit 钳制——层与层读出厚薄节奏。
- **破口内部压暗**：破口场命中的面向 `GROOVE_SHADOW` 过渡（≤0.5），
  裂缝读出深度而不是等宽内缩。
- **色带对比**：`ROCK_MID #5A7C99→#6286A4`（提亮半档）、
  `ROCK_DEEP #3A5F85→#35587D`（加深半档）——中下部层间明度台阶从 ~12% 拉到 ~18%。

### 2. `components/world/terrain/MainIsland.tsx` — 主岛接入破口（G4）

`breachCount: 3, breachDepth: 0.15`——下半部 4–5 圈均匀环带在 3 处被彻底打断，
侧影从「层叠圆环」变成「被撕开的浮岩」。segments/剖面/其余参数不动（零新增顶点）。

### 3. `components/world/objects/ProjectIsle.tsx` — 三屿 organic 化（G5/G6）

关键根因修复：三屿此前调用 `createLayeredIslandGeometry` **未开
strataTilt/buttressCount**——没有轮廓波、没有沟槽、没有岩檐雪，屿体是
「光滑叠板/松饼」。现三屿开启 organic + 各自破口（2 条），剖面保持
mesa/shard/rooted 的体量性格：

| 屿 | jaggedness | strataTilt | buttress | layerJitter | breach |
|---|---|---|---|---|---|
| AgehaOS（mesa） | **0.12** | **0.075** | 5 / 0.06 | **0.026** | 2 / **0.16** |
| CS（shard） | 0.095 | 0.065 | 5 / 0.06 | 0.02 | 2 / 0.10 |
| Moss（rooted） | 0.1 | 0.06 | 5 / 0.055 | 0.02 | 2 / 0.09 |

AgehaOS 的 mesa 层理平直、叠板感最强，四项参数单独加档（b-after → b-after2 迭代）。

### 4. `tests/r12-island-refine.test.mjs` — 新增 8 条守护测试

破口场行为契约（顶环保护 / ≥N 个独立深切区 / 零参数零场）、破口几何真实改变
（切进 ≥0.04）、雪檐接缝逐位一致（y>−0.4m 顶点开/关破口完全相同）、四屿 y 有界、
色带台阶明度差 ≥0.05、主岛与三屿参数源码钉定。

## 验证

- **npm test：266/266**（258 旧 + 8 新）
- **tsc 0 错误 / eslint 0 警告 / 生产构建通过**
- 前后对比（同机位同管线）：
  - **02 正面 / 03 侧西 / 05 北侧 / 12 底部**：主岛岩壁环带感显著减弱，
    竖向破口与翻缘可读，层间色差拉开；空间布局 / 道路 / 地标零变化。
  - **10 CS / 11 Moss**：屿体岩裙碎石化，「光滑松饼」轮廓消失，檐口接缝无穿刺。
  - **04 俯视**：主岛与 Moss 屿顶面无岩体穿雪（接缝干净）。
  - **AgehaOS 屿（05/09）**：叠板边缘波浪化 + 岩檐雪，剩余「台阶感」为 mesa
    平台式体量的既定性格；其「深色」归 D 阶段曝光处理。
  - **01 首页初始 / 19 玩家探索**：构图与可达性不变，0 console errors。

## 红线确认

- C 径几何 / `trail-c-curb` / `trail-c-pavement` / 碰撞 / 导航 / 首页 UI /
  AgehaOS 地标本体 / 中央广场布局：**零改动**（屿体岩裙最大外扩 ~0.4m，
  远小于 R11.6 的 2.4m 岩裙让位余量，10 号机位确认衔接无干涉）。
- 可行走面查询（layout.ts）一行未动——玩家脚下的坡面与改前完全一致。
