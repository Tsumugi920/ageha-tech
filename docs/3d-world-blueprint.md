# Ageha.tech 3D 世界施工蓝图（Blueprint v1.2）

> **文档定位**：本文件是 3D 世界重构的施工总图，供四名施工员按阶段照图施工。权威需求以 `docs/3d-world-brief.md` 为准，本蓝图是其落地设计；两者冲突时以简报为准，并回报修订本蓝图。
> **依据材料**：2026-10-25 架构/内容/资源三份审计报告；源码实读 `lib/projects.ts`、`lib/site.ts`、`app/layout.tsx`、`app/globals.css`、`package.json`、`tests/structure|routes|contrast|content-honesty|site.test.mjs`、`components/home/Hero.tsx`、`components/layout/ButterflyLogo.tsx`；实查 `node_modules/sharp/package.json`（sharp 0.35.5 已随 Next 16 内置）。
> **铁律不变**：真实业务零删改（Moss World 无任何链接，不得编造）；测试同步改写不许静默删；原创设计禁抄 Bruno Simon；SSR 安全；不伪造验证结果。
>
> **v1.2 技术边界修订（2026-10-29）**：站长已允许使用物理引擎、后处理、音效、外部 3D 资产及其他能完善项目的工具与依赖。旧版的禁止性取舍不再作为限制；以品质、兼容性、性能、授权与维护成本选型。本文原始参数、资产表和阶段记录是初版施工基线，不是本次已实现结果或永久限制；后续优化按 [优化方案](3d-world-optimization-plan.md) 推进，实际预算随验证更新并同步测试。
>
> **v1.1 修订记录**（逐条解决第 1 轮评审 7 条意见）：
> ① [high] §14.0 新增组件退役/保留清单；§14 补 routes/contrast/content-honesty 三文件改写策略；§15 阶段 1 测试清单扩至八个文件——修复门禁按图不可达。
> ② [high] §11/§13.4 详情面板封面改为 next/image，全站裸 `<img>` 禁令（routes.test.mjs:225-241）保持不松。
> ③ [med] §11.2 新增资产预处理脚本（内置 sharp 零新增依赖）与画廊/屏幕贴图按需加载策略；根目录概念图拷贝入 public/world/。
> ④ [med] §13.1 明确首页 `<h1>` 归属：WorldShell SSR 标题常驻，解决 Hero.tsx:131 退役后的标题层级缺口。
> ⑤ [low] §14 表格 site.test.mjs 行改为完整改写口径，与 §15 阶段清单一致。
> ⑥ [low] §4.3 补 Moss 屿「生态监测屏」贴图，与 §4 共同规范口径统一。
> ⑦ [low] §15 阶段 2 门禁逐条列出 4 条白名单链接。

---

## 1. 世界观（一句话 + 展开）

**「Ageha 群岛」——冰海晨雾之上的一座浮空水晶群岛：一只名为 Ageha 的光蝶栖息在中央苏醒环礁的蝶枢里，三条鳞粉蝶径从主岛伸向三座作品之屿；访客化身一枚被光蝶唤醒的浮游信灯，沿蝶径巡游三个真实作品的世界。**

- 叙事逻辑 = 站点逻辑：**主岛是身份与导航（首页），三座项目屿是三个真实作品（lib/projects.ts），茧居所彩蛋是设计原稿画廊（about 的延伸），远景浮岛是未来作品的空位（writing plan / 成长期隐喻）**。空间即信息架构，这是与"Hero+卡片"旧站的根本区别。
- 品牌一致性：tagline「用技术构建更有趣的数字世界」（lib/site.ts:30）即世界观注解——群岛本身就是一个正在生长的数字世界。
- 情绪曲线：明亮、轻盈、好奇。晨光冰海，不是夜景霓虹。**禁止黑底紫光赛博朋克模板**（brief §3）。

## 2. 空间总图

坐标系：three.js 右手系，Y 向上，1 unit ≈ 1m。原点 (0,0,0) = 主岛地面中心。北 = −Z。

### 2.1 俯视总图（示意）

```
                      北 (−Z)
                        │
                 [AgehaOS·悬浮终端塔]
                  (0, +4, −64) ●42
                        │ 蝶径A·北径（长52）
                        │
  [CS·行情观测环] ───────┤
  (−52, +8, +26) ●104   │        [Moss·生态穹舱]
        │               │              (48, −3, +30)
        │ 蝶径C·西南径（长50）│ 蝶径M·东南径（长48）
        └───────┐       │      ┌───────┘
                ┌───────┴──────┐
                │   苏醒环礁    │← 主岛 36×28 椭圆
                │   ✦ 蝶枢(0,6,0)│← 出生点 (0, 0, +10) 面北
                └──────────────┘
                 ○ 茧居所 (0, −18, −22)（主岛下方北侧，隐藏）
                        │
                      南 (+Z)
        远景浮岛群：半径 120~220 环带，5~7 座，不可达剪影
        冰海面：y = −60 大平面（雾下渐隐）；云层：y +30~60
```

### 2.2 区域坐标表（施工数据以此为准，最终落在 `lib/world/layout.ts`）

| 区域 | 中心坐标 | 尺度 | 地面高度 | 可达方式 |
|---|---|---|---|---|
| 苏醒环礁（主岛） | (0, 0, 0) | 椭圆 36×28（半轴 18/13），岛体下延倒锥至 y=−14 | y=0 | 出生点 |
| 蝶枢（世界核心） | (0, 6, 0) | 装置高≈7，翼展≈10 | 悬浮 | 环绕观赏，不可进入 |
| 蝶径 A（北径→AgehaOS） | 起点 (0,0,−13) → 终点 (0,4,−60) | 宽 3.2，长 52，缓升坡 +4 | 0→+4 | 步行 |
| 蝶径 C（西南径→CS） | (−15,0,6) → (−50,8,24) | 宽 3.2，长 50，升 +8 | 0→+8 | 步行 |
| 蝶径 M（东南径→Moss） | (14,0,7) → (46,−3,28) | 宽 3.2，长 48，降 −3 | 0→−3 | 步行 |
| AgehaOS 悬浮终端塔 | (0, 4, −64) | 岛径 24，塔高 16 | 岛面 y=+4 | 蝶径 A / 传送 |
| CS 行情观测环 | (−52, 8, +26) | 岛径 26，环廊半径 8 | 岛面 y=+8 | 蝶径 C / 传送 |
| Moss 生态穹舱 | (48, −3, +30) | 岛径 22，穹顶半径 7.5 | 岛面 y=−3 | 蝶径 M / 传送 |
| 茧居所（彩蛋） | (0, −18, −22) | 平台 10×8 | y=−18 | 主岛北缘隐藏旋梯下行 / 传送（发现后） |
| 远景浮岛群 | 环带 r=120~220，扇形分布避开工位 | 每座 20~60 剪影 | −20~+40 | **不可达**（空气墙） |
| 冰海 / 云层 | 海面 y=−60；云 y=+30~+60 | 海面 2000×2000 | — | 不可达 |

> **R11 修订**：主岛顶部不再是平面——`lib/world/layout.ts` 的 `mainIslandSurfaceY` 解析高度场（四区地貌：西岭高地 / 东北丘原 / 东缘冰碛带 / 南麓缓坡，最高 ~2.7m）同时驱动顶面网格与 `getGroundHeight` 碰撞，视觉即脚下；岩体深度实为 17.5，侧影含贴壁岩与岛裙碎石。压平区（广场 / 出生 / 石碑 / 径带 ±1.6m / 冰池 / 南观景台）保持平坦，以该函数与 `tests/world-layout.test.mjs` 的 R11 区块为准。

### 2.3 空间关系与节奏

- **三屿方位刻意去对称**：正北 + 西南 + 东南，高度 −3 / +4 / +8 三档，站在主岛环顾时三屿各占不同高度层与方位角，天际线不呆板；三屿互相间距 100+，隔着雾互为中景，不互相抢戏。
- **蝶径即引导**：三条径从主岛边缘 120° 近似均分伸出，径面为半透明鳞粉光带 + 悬浮石板段（虚实相间，石板为可站立碰撞体，光带段下方有兜底隐形护栏防坠落——坠落即软重置回径起点）。
- **软边界**：可行动区域 = 主岛 + 三径 + 三屿 + 茧居所旋梯，其余方向浮游信灯遇气流推回（速度平滑衰减 + 回推力），永不坠落、永不穿出世界。
- **雾与视距**：线性雾 `Fog(#CFEBFF, 70, 260)`；相机 far=500；天空穹 r=380（材质 `fog:false`）。从主岛看三屿清晰可辨（50~64 距离雾量小），远景岛半雾剪影，纵深三层。

## 3. 视觉体系

### 3.1 色板（直接映射 `app/globals.css:10-24` 品牌令牌，3D 与 HTML 同源）

| 用途 | 色值 | 来源 |
|---|---|---|
| 天空顶 / 天空地平线 | #9CD8FF → #EAF7FF（渐变穹顶） | sky #DDF3FF 的明暗延展 |
| 雾色 | #CFEBFF | sky 与地平线之间 |
| 岛岩基色 | #10294B（深蓝岩）→ #4B668A（中蓝灰） | text-primary / text-secondary 转作矿物色 |
| 冰面 / 雪 | #F1F8FF、#FFFFFF | ice / white |
| 玻璃主材质 | #DDF3FF @ transmission，边缘泛 #54E3FF | sky + cyan |
| 蝶枢水晶 | #8FE8FF→#269DFF→#9C83FF 渐变（同 app/icon.svg） | 品牌三色 |
| 径流鳞粉 | #54E3FF（cyan）发光粒子 | cyan |
| 生态绿（Moss 区专用） | #6FCF9E 苔藓 / #3E9E77 深苔 | 新增，限定 Moss 区，低饱和与冰蓝同明度 |
| 行情暖点缀（CS 区专用） | #FFB36B（仅曲线柱正增长段） | 新增，小面积点缀 |

### 3.2 材质分配（防"全玻璃单调"，brief §3）

- **主岛**：磨砂岩（MeshStandardMaterial roughness 0.85，顶面雪/冰覆盖层 roughness 0.4 微反光）+ 少量冰晶簇。
- **蝶枢**：可用 MeshPhysicalMaterial 的透射、清漆等表现建立视觉焦点，具体参数以当前资产和光照实测为准。
- **三屿**：每屿一种主材质语言（见 §4），玻璃只做构件（穹舱壁、塔层板），不做整岛。
- **金属点缀**：深蓝金属（metalness 0.9, roughness 0.3）用于框架/栏杆/塔骨。
- **预算基线**：初版 `transmission` 上限为 3 个 mesh，其余半透明采用轻量材质；允许依据画面收益和设备实测调整该预算，并同步档位与测试，而不是永久限制材质使用。

### 3.3 光照与后处理

- 初版主光基线：1× DirectionalLight（晨光，色 #FFF6E8 微暖，2048 shadow map）与 1× HemisphereLight；灯光数量、范围和参数按当前场景调整。
- 点光、HDR 环境、烘焙照明与适用的反射方案均可使用，优先建立主次、接触关系与材质区别，并实测运行成本。
- 允许正式后处理栈：按需求组合环境遮蔽、Bloom、色彩调整、抗锯齿和可选景深，不再限定用 emissive 与粒子模拟全部效果。
- 后处理、透射和反射按画质档位管理；低档保留角色、路径和交互结果的可读性。与 HTML 信息层核对色彩和清晰度，避免景深或泛光影响操作。

## 4. 项目区实体设计（基于真实数据，造型/颜色/环境三重差异）

> 共同规范：每屿有 ①主交互体（点击/靠近 → 详情面板）②**真实封面截图的场景内屏幕贴图**（用 §11.2 压缩版，规格统一：交互主屏一块 + 观测/监测屏可选，均按需加载）③名牌（drei `<Html>`，系统字体）④状态徽记（"已上线"= 常亮光环；"可本地运行"= 呼吸微光——不编造，如实呈现）。交互半径 6，热区 ≥3 单位。

### 4.1 AgehaOS →「悬浮终端塔 The Afloat Terminal」（正北，0,+4,−64）

- **造型**：三层玻璃圆盘平台螺旋升起（半径 6/4.5/3），中央悬浮一个"OS Core"——缓慢自转的十二面体水晶内核，外面包裹一圈窗口管理器意象的环轨（小玻璃卡座沿轨道排列，呼应窗口管理器）；顶层一面 16:10 主屏贴 agehaos 真实截图压缩版（§11.2，1600 宽）。
- **颜色**：冰蓝玻璃 + 深蓝金属骨架（#269DFF / #10294B），核心微泛 cyan。
- **记忆点**：接近时 OS Core 停转、展开为一圈全息操作环（窗口化动效），离开后收拢——把"窗口管理器"翻译成空间语言。
- **交互内容**：面板数据源 `lib/projects.ts:18-30`；链接仅「在线体验 → https://os.ageha.cn」。

### 4.2 CS 饰品虚拟投资模拟器 →「行情观测环 The Market Observatory」（西南，−52,+8,+26）

- **造型**：一座环形观测廊（半径 8 的半环拱 + 观测平台），环心立着"资产曲线柱"：程序化生成的动态柱阵（24 根方柱高低起伏滚动，正增长段 #FFB36B 暖色、其余冰青），是全场景唯一持续大动势的装置；廊外壁悬挂多平台比价仪表（小圆盘刻度），主屏贴投资组合页真实截图压缩版（§11.2，1280 宽 ≤300KB）。
- **颜色**：青色主导（#54E3FF 构件）+ 白色廊体 + 暖橙点缀。
- **记忆点**：曲线柱的行情波动声势 + 环形建筑的"观测"姿态。
- **交互内容**：数据源 `lib/projects.ts:31-52`；链接「在线体验 → https://cs.ageha.cn」「查看源码 → https://github.com/Ageha6912/cs-market」。

### 4.3 Moss World →「苔藓生态穹舱 The Terrarium Dome」（东南，48,−3,+30）

- **造型**：全场景唯一"下沉"屿（−3），一座玻璃半圆穹舱（半径 7.5）扣在苔藓丘上；初版采用程序化苔藓地毯、小植物与水雾，后续可混用原创或授权模型、纹理和动画，提升近距离观察的层次。
- **展示口径（与 §4 共同规范统一）**：作品集生态舱是独立的场景演示，不必复刻 Moss 项目的资产实现方式，也不得冒充完整生态模拟。真实截图 `moss-world-terrarium.png` 压缩版保留在**舱外观景台的「生态监测屏」**上，如实展示本地运行画面，走近可放大预览；演示资产与真实项目画面明确区分。
- **颜色**：生态绿 #6FCF9E / #3E9E77 + 玻璃，环境雾气略浓于外界（局部指数雾 0.06）。
- **记忆点**：整个群岛唯一"温暖绿意"的生态孤岛，与冰蓝世界形成互补对比——探索奖励感。
- **交互内容**：数据源 `lib/projects.ts:54-65`；**状态"可本地运行"，无任何链接——详情面板如实显示「本地项目 · 未公开上线，暂无公开链接」，不渲染任何外链按钮，不编造**（诚实边界铁律）。

## 5. 蝴蝶品牌方案（初版路线与可选升级）

初版采用**路线 B（程序化 3D 水晶蝴蝶）为主、路线 A（矢量栅格化精灵）为辅**。允许改用原创或授权的高质量模型、纹理与动画，不要求永久保留程序化实现；仍避免将不适合的 hero PNG 硬贴成伪 3D。初版三件设计如下，具体参数随样板验证调整：

1. **蝶枢万花筒（世界核心）**：`components/layout/ButterflyLogo.tsx:63-88` 的四片翼贝塞尔 path → three `Shape` 几何（写转换工具 `butterflyShape.ts`，path 数据一次转换硬编码进工具，运行时零 SVG 依赖），放大为翼展 10 的巨型水晶翼组，四翼绕中心轴缓慢开合旋转（周期 24s），材质用 icon.svg 同款三色渐变（#8FE8FF→#269DFF→#9C83FF）与适用的透射表现，下方投出旋转光影。**这是主岛视觉焦点与品牌图腾**。
2. **引导蝶 Ageha（导航角色）**：同款几何翼展 2.2，沿当前未探索的蝶径往返巡飞（Catmull-Rom 样条，速度 4/s），玩家 idle >8s 时飞回玩家前方悬停示意方向；翅根枢轴扇动（两翼对称相位旋转 ±40°，8Hz 阻尼正弦）。reduced-motion 下悬停待命不巡飞。
3. **星尘蝶群（氛围 + 彩蛋线索）**：8~12 只小型蝶，用 `app/icon.svg` 由 §11.2 脚本栅格化的 512px 透明 PNG 做 `Sprite`，聚在三蝶径与茧居所入口；低性能档减至 4 只或隐藏。

- hero-clean.png / hero-full.png / 根目录设计原图：**仅作茧居所画廊的画框展品**（§9.1，用 §11.2 压缩版纹理），绝不贴 3D 模型（无 alpha、含烘焙文字，brief §5 明令避免）。
- HUD/加载屏品牌徽记直接复用 `ButterflyLogo.tsx`（DOM 层，零成本）。

## 6. 探索角色与控制系统

### 6.1 角色：「浮游信灯 The Drift Lantern」

- 设定：被 Ageha 唤醒的一枚蝶形光种——**贴地悬浮的发光小体**（直径 0.5 的水晶核 + 四片微型光翼 + 底部柔光圈投地 + 尾迹鳞粉带 20 粒）。
- 选型理由：①世界观自洽（信使/巡灯，呼应"光蝶引路"）②零骨骼动画成本，运动学即"悬浮体+惯量"，程序化品质上限高 ③区别于参考站的汽车载具（brief §7"不为模仿而机械加汽车"）。
- 状态动画：移动时光翼后掠收拢、悬停时缓缓张开微颤；传送时收成一粒光点。

### 6.2 桌面控制

| 输入 | 行为 |
|---|---|
| WASD / 方向键 | 相对相机方向移动（加速度 22/s²，最大速度 7.5/s，松键阻尼衰减 0.85^Δt·8） |
| 鼠标左键拖拽 | 轨道观察（水平 ±120°、垂直 +8°~+60°，阻尼跟随）——**不锁定指针**，点击留给场景交互 |
| 滚轮 | 跟随距离 6 / 9 / 13 三档连续插值 |
| Shift | 冲刺（×1.6） |
| E / 点击 | 触发最近可交互体（有交互目标时） |
| 1 / 2 / 3 | 快速传送三项目屿（飞行动画 1.2s） |
| M | 世界导航面板（项目列表/传送/路由） |
| H / ? | 操作说明面板 |
| Esc | 关闭面板 / 关闭详情 |

- 键盘无障碍：Tab 走 HTML 层完整焦点链（复用 layout.tsx:24-29 的跳转链接模式），焦点环用 `--color-focus-ring #1668C4`（globals.css:35）。

### 6.3 移动端控制

- 左下虚拟摇杆（96px 玻璃圆盘，触摸拖动矢量 → 移动），右半屏拖动 = 观察视角，双指捏合 = 距离两档；交互按钮（"查看"）固定右下 ≥48px 热区；靠近交互体时自动浮出大按钮。
- 摄影机距离 +2 档偏移、自动回正更弱、移动速度上限 −20%（触屏精度补偿）。

### 6.4 运动与碰撞（允许成熟物理引擎）

- 初版贴地基线：对可行走表面取脚下高度，浮游高度 = 地面 +0.35，垂直方向使用 critically-damped spring（λ=10）；这些参数可按实测手感调整。
- 碰撞与动态交互：允许使用 Rapier / `@react-three/rapier` 等方案承担角色接触、物件推撞、刚体和约束；不再限定为静态位置推出。具体版本与 React / Three 兼容性在接入前核实。
- 接入时明确物理步进与渲染插值、角色与物件的控制职责；不得让原控制器和刚体系统同时写同一个对象的位置。既有 `lib/world/colliders.ts` 数据按实际方案保留或迁移，并同步行为测试。
- 边界：保留软边界、回航和复位能力；低帧率、传送、后台恢复时不穿透或突然跳变。

## 7. 摄影机系统

- **第三人称跟随**：目标点 = 角色位置 + 前向 1.5；相机位置 = 目标点 + 球坐标（yaw/pitch 由鼠标拖拽与角色朝向混合驱动，角色移动时 yaw 以 0.4 权重缓慢对齐移动方向）。
- **阻尼**：`THREE.MathUtils.damp`（位置 λ=4，lookAt λ=6）——帧率无关，无抖动。
- **初始构图**（第一眼世界观成立）：出生 (0,0,10)，相机 (0, 4.6, 18.5)，lookAt (0, 3.2, −12)，FOV 55（移动端 60）——画面构成：前景出生点光环 → 中景蝶枢居中偏上 → 北径尽头终端塔剪影 → 左右两径斜出画框 → 远景浮岛 + 云层。加载完成即此构图，无需操作即可读出"三条路、三个世界"。
- **遮挡处理**：相机↔角色连线对碰撞体清单 raycast，命中则相机前移至命中点 0.3 前；相机 y 不得低于当地地面 +0.5。
- **传送运镜**：1.2s 贝塞尔飞行插值（起点→抬升→终点），期间输入锁定；reduced-motion 改 300ms 淡出淡入。

## 8. 交互系统

- **靠近反馈**：距离 <10 交互体名牌浮现（透明度随距离），<6 高亮（描边光圈 + 脉冲缩放），HUD 中下出现提示条「按 E 或点击 · 查看 AgehaOS」；可结合空间音效或交互提示音，静音时仍有完整的视觉反馈。
- **触发**：E / 点击 / 移动端大按钮 → 右侧详情面板滑入（§13.4），3D 运动不暂停但输入降权；面板关闭（Esc / × / 点击场景空白）回到探索，摄影机平滑回位。
- **反馈一致性**：所有"打开"动效 280ms cubic-bezier(0.22,1,0.36,1) 右滑入；"关闭"同曲线反向；交互体高亮统一 cyan 光圈脉动（周期 1.6s）。
- **快速导航**：M / HUD 按钮打开世界导航面板（§13.5），含三项目直达传送、主岛回航、全部站点路由（/projects /about /tech /contact /articles）——**探索不是获取信息的唯一路径**（brief §7）。

## 9. 隐藏彩蛋（少量、非必要探索）

1. **茧居所 The Chrysalis Nook**（主岛下方北侧 (0,−18,−22)）：主岛北缘一块可推动的薄冰板（靠近出现微光提示）后藏旋梯下行，尽头是封闭小穹窟：「设计原稿画廊」——hero-clean、hero-full、概念原图三幅画框式展品（**全部用 §11.2 压缩重采样版 canvas 纹理，按需加载**；画框 + 局部射灯 + Html 说明牌"这个世界最初的草图"），中央一枚静止蝶茧（靠近轻颤）。发现后 M 面板出现「茧居所」传送项。
2. **星尘蝶群聚集**：把引导蝶"跟丢"后原地静立 20s，蝶群会绕玩家聚成一圈短舞（纯氛围奖励，无文案宣称）。

## 10. 模块架构与文件规划

> 原则：**世界数据全部为纯 TS 无 JSX（`lib/world/`），node --test 可直接 import 做数据级校验**（架构审计约束）；渲染组件全部 'use client'（`components/world/`）；SSR 双层：服务端 `app/page.tsx` 只渲染客户端壳，壳内 `next/dynamic ssr:false` 加载 Canvas（Next 16 约束）。

```
lib/world/                      # 纯 TS 数据层（可被 node --test 导入）
  constants.ts    # 尺度/物理参数/色值常量（注明与 globals.css 令牌同源对齐）
  layout.ts       # §2.2 坐标表数据化：区域、路径样条控制点、可行走面参数、软边界
  colliders.ts    # 静态碰撞体清单（AABB/圆柱）+ 交互体登记（id/位置/半径/类型/slug）
  performance.ts  # 性能档位参数表（高/中/低 × 桌面/移动）
  index.ts

scripts/
  prepare-world-assets.mjs      # §11.2 资产预处理脚本（内置 sharp，幂等，产物入库）

components/world/               # 全部 'use client'
  WorldShell.tsx                # 客户端壳：WebGL 检测 → dynamic(ssr:false) WorldCanvas / 降级 UI；根节点 id="world-root"；SSR 渲染 <h1>（§13.1）
  WorldCanvas.tsx               # <Canvas> 根：dpr/shadows/相机初始/场景组装/自适应档位注入
  loading/LoadingScreen.tsx     # useProgress 真实进度 + ButterflyLogo 品牌屏（禁假百分比）
  systems/
    usePlayerController.ts      # 输入聚合（键鼠/触摸）、运动学、贴地、碰撞 resolve（refs + useFrame，零 useState 逐帧）
    FollowCamera.tsx            # §7 跟随相机（含遮挡 raycast）
    InteractionSystem.tsx       # 距离检测/悬停/触发 → UIContext（低频事件）
    TeleportSystem.tsx          # 传送运镜与软重置
    AdaptiveQuality.tsx         # 帧时间滑动窗口 → 档位升降（§12.2）
  terrain/
    MainIsland.tsx  FloatingRock.ts（倒锥浮石程序化几何工具）
    Trails.tsx（蝶径石板+光带）  GuardRails 数据在 colliders.ts
    SkyDome.tsx  CloudLayer.tsx（billboard 云，canvas 本地生成纹理）  IceSea.tsx  DistantIsles.tsx
  objects/
    butterflyShape.ts           # ButterflyLogo 翼 path → three Shape 一次性转换工具（§5）
    ButterflyCore.tsx  GuideButterfly.tsx  ButterflyFlock.tsx
    AgehaosTerminal.tsx  CsObservatory.tsx  MossTerrarium.tsx
    GalleryNook.tsx（茧居所）   SignPost.tsx（主岛石碑：品牌句 + 三径名牌）
  ui/                           # DOM 层（Canvas 外）
    HudOverlay.tsx  Joystick.tsx  ProjectDetailPanel.tsx
    WorldNavPanel.tsx  HelpPanel.tsx  IntroToast.tsx  FallbackProjects.tsx（WebGL 失败降级）

app/page.tsx                    # 服务端组件：静态 metadata 保持 + 渲染 <WorldShell/>
```

- 高频量避免进入 React 逐帧重渲链；现有 refs 与 `WorldUIContext` 可继续使用，确有收益时允许引入状态管理或事件工具，不以零新增状态库为限制。
- 全局布局：`app/layout.tsx` 的 Navbar/Footer 结构不动；首页沉浸用纯 CSS：`body:has(#world-root)` 时 Navbar 转 fixed 半透明叠加、Footer 隐藏（零 JS、其它路由零影响；WorldShell 根节点带 `id="world-root"`）。
- 组件卸载清理：所有 useFrame/useEffect 监听在 cleanup 注销；geometry/material/texture 在 Canvas `onCreated` 登记、卸载时 dispose（封装 `useDisposable` 工具）；处理 `webglcontextlost/restored`。

## 11. 技术选型与资源策略

### 11.1 依赖

以下前三项与 sharp 是初版选型记录，新增候选的版本与兼容性需在实施时核实，不表示已经安装。

| 依赖 | 版本／状态 | 用途 | 选型依据 |
|---|---|---|---|
| three | 初版 ^0.186.1 | 渲染核心 | 继续以当前实际依赖和验证结果为准 |
| @react-three/fiber | 初版 ^9.8.2 | React 绑定 | 保持与当前 React / Three 兼容 |
| @react-three/drei | 初版 ^10.7.9 | 场景工具 | 按实际使用的功能与兼容性选择 |
| sharp | 初版记录为 Next 内置 0.35.5 | §11.2 资产脚本 | 工具链直接依赖时可显式声明，不限定零新增依赖 |
| Rapier / @react-three/rapier | 允许引入，版本待核实 | 角色碰撞、动态物件和约束 | 以手感、正确性和移动端预算验证 |
| postprocessing / @react-three/postprocessing | 允许引入，版本待核实 | 环境遮蔽、Bloom、色彩、抗锯齿与可选景深 | 样板区对比并按画质档位调整 |
| Web Audio / Three.js 音频或适用音频库 | 允许使用，按需求选型 | 交互、运动、空间环境声和音乐 | 用户手势启动、静音、播放预算及资源释放 |
| 模型、纹理与动画处理工具 | 允许引入，按资产选型 | GLTF/GLB、压缩、烘焙、LOD 等 | 许可证、画面收益、加载和解码成本 |

- **依赖与场景文字**：不再禁止物理引擎、后处理或其他必要库；场景文字可以使用 `<Html>`、canvas 纹理或配置了本地授权字体的 `<Text>`，不能隐式依赖易失效的外部字体。改变旧契约时同步更新相应测试，不静默跳过验证。
- **图片纪律（与 routes.test.mjs:225-241 全站契约对齐）**：`components/world/ui/*.tsx` 所有 DOM 层图片**一律 next/image，禁止裸 `<img>`**——详情面板封面、降级项目页封面均如此（v1.0 的裸 `<img>` 方案作废，修订理由：保住现有图片优化契约优于为新 UI 破例）。3D 场景内 canvas 纹理不受该契约约束（非 DOM 标签），world-assets 测试同步断言 world 组件无裸 `<img>`。

### 11.2 资产预处理与按需加载（brief §9 资源按需）

**`scripts/prepare-world-assets.mjs`** 的初版使用 Node 与 sharp 处理以下图片，幂等可重跑，产物放在 `public/world/` 并维护来源记录。允许按需扩展 GLTF/GLB 处理、纹理压缩、烘焙和 LOD 工具链；直接使用的工具依赖应明确声明，不受零新增依赖限制。

| 初版产物 | 源 | 处理 | 目标体积 |
|---|---|---|---|
| public/world/butterfly-sprite-512.png | app/icon.svg | sharp 栅格化 512px（透明底保留） | ≤60KB |
| public/world/screens/agehaos-1600.jpg | public/images/agehaos-desktop.jpg | 重采样 1600 宽 q78 | ≤350KB |
| public/world/screens/cs-portfolio-1280.webp | public/images/cs-market-portfolio.png | 重采样 1280 宽 webp | ≤300KB |
| public/world/screens/moss-terrarium-1280.webp | public/images/moss-world-terrarium.png | 重采样 1280 宽 webp | ≤300KB |
| public/world/gallery/hero-clean-1024.webp | public/images/hero-clean.png | 重采样 1024 宽 webp | ≤250KB |
| public/world/gallery/hero-full-1024.webp | public/images/hero-full.png | 同上 | ≤250KB |
| public/world/gallery/concept-art-1024.webp | **仓库根目录** Ageha.tech未来数字世界作品集.png | **拷贝入 public/world/ 后**重采样 1024 宽 webp（原图不动） | ≤250KB |

- **预算与测试**：保留产物存在性、体积和来源检查；新增模型、纹理和音频分别设定合理预算。预算调整须有画面与性能依据并同步测试，不直接套用初版图片上限，也不静默绕过门禁。
- **按需加载**：首屏可加载保证构图与操作所需的模型、纹理和环境资源；远处项目区、画廊、音频与附加体验分批加载。初版距离阈值（项目屿 <60、画廊 <40）可按当前布局和加载时延调整，低档采用简化资产而不丢失核心展示与交互。`public/images/` 原图继续供项目详情页与 HTML 面板的 next/image 使用。
- **混合资产路线**：程序化几何与原创或授权的外部模型、纹理、HDR、动画、烘焙资源均可采用。记录来源、许可证及所需署名，统一风格、尺度、材质与碰撞代理；根据实测选择压缩与 LOD，兼顾下载、解码、显存和运行成本。

## 12. 性能与降级策略

### 12.1 档位（lib/world/performance.ts 数据化，测试可校验）

下表为初版预算基线，可随资产和设备实测调整；后处理、动态刚体与音频接入时也须建立对应预算，低档不能失去核心交互与内容。

| 参数 | 高（桌面默认） | 中（移动/降一档） | 低（自适应触发） |
|---|---|---|---|
| DPR 上限 | min(dpr, 2) | min(dpr, 1.5) | 1.0（可再降 0.75） |
| 阴影 | 2048 单光源 | 关，blob 假阴影 | 关 |
| transmission 材质 | 初版 ≤3 处，可调 | 降级为 opacity | 无 |
| 鳞粉/雾粒子 | 1200 | 600 | 300 / 云减半 |
| 屏幕贴图（§11.2） | 按需加载 | 按需加载 | 降低分辨率或提供等价展示，不用空框替代内容 |
| 远景岛 | 7 座 | 5 座 | 3 座剪影 |
| 蝶群精灵 | 12 | 6 | 4 |

### 12.2 帧率自适应（AdaptiveQuality）

帧时间滑动平均（120 帧窗口）：>22ms 持续 2s → 降一档（DPR → 阴影 → 粒子/远景/贴图，逐级）；<14ms 持续 8s → 允许升一档（每次运行最多升 2 次防振荡）。档位变化经 Context 通知 HUD 显示一次性提示。

### 12.3 失败与无障碍降级

- **WebGL 不可用/初始化失败**：WorldShell 检测（`canvas.getContext('webgl2'/'webgl')` 试探 + Canvas onError）→ 渲染 `FallbackProjects.tsx`：完整可访问的项目浏览页（复用 ProjectCard 视觉与 next/image，三项目全数据 + 全路由导航），绝不白屏（brief §10）。
- **prefers-reduced-motion**：帧循环保留（角色可控性优先），但环境自动动画全部静止或极慢（蝶枢开合停、引导蝶悬停待命、云/粒子冻结在当前帧、曲线柱停止滚动、传送改淡入淡出）；globals.css 现有兜底不覆盖 r3f，需在 `useReducedMotion` 钩子内单独实现并测试断言。
- **上下文丢失**：`webglcontextlost` → 显示恢复提示遮罩，`restored` → 重建资源；页面切换离开首页时 Canvas 卸载全清理。
- 验证口径遵 brief §10：CSS 视口 ≠ 物理分辨率，实测 2560×1440 / 1920×1080 / 1440×900 + 移动视口；60 FPS 是**实测目标**，未实测不得宣称。

## 13. HTML 信息层设计（重建，非旧页套壳）

### 13.1 流程与首页标题层级

加载屏（真实进度 + 品牌）→ 进入世界（初始构图 + 3s 品牌识别角标）→ IntroToast 引导（可关闭、可跳过、任意操作即隐）→ 自由探索 → 靠近提示 → 详情面板 → 返回世界 / 快捷导航。

**首页 `<h1>` 归属**（v1.0 缺口，评审意见 4）：现首页唯一 h1 在 `components/home/Hero.tsx:131`，Hero 退役后由 **WorldShell 的 SSR 标题承接**——加载屏品牌大字即 `<h1>Ageha.tech</h1>`（subtitle p：tagline「用技术构建更有趣的数字世界」，与 metadata 同源 lib/site.ts:30/34-35）；世界就绪后**同一 h1 节点**经 CSS 过渡收缩为 HUD 左上品牌角标（节点不卸载、文字不变，hydration 安全）。初始 HTML 即含 h1，SEO 与无障碍标题层级无缺口；内页 h1 仍由 PageHeader 提供（routes.test.mjs:252-257 断言不受影响）。

### 13.2 加载屏

ButterflyLogo 呼吸与真实加载状态结合（文案「正在点亮群岛…」）。世界 JS chunk 由壳的 dynamic loading 态覆盖，资源下载可使用 `useProgress`；模型解码、着色器编译与场景就绪用实际阶段状态表达，不能把下载结束当成可交互完成。仅在能准确计算时显示数值，**禁假百分比，也不预先宣称加载极快**。资源失败显示「部分区域未能点亮」+ 重试 + 「直接浏览项目列表」降级入口。

### 13.3 HUD（常态，不抢主视觉）

- 左上：品牌角标（h1 收缩态，见 §13.1）。
- 左下：操作提示（桌面键位 / 移动端摇杆，10s 后收成 ? 图标）。
- 右下：三项目快捷入口（蝶形小按钮 + 名称）+ M 面板按钮。
- 顶中：当前区域名牌（进入区域时淡入 2s：「苏醒环礁」「AgehaOS · 悬浮终端塔」…）。
- 中下：交互提示条（有目标时）。
- 全部玻璃令牌（`--color-glass*`）、文字 `--color-text-primary`、对比度按 contrast.test.mjs 既有口径控制（新类串进 §14 断言）。

### 13.4 项目详情面板（右侧 380px 滑入，移动端底部抽屉）

内容渲染**直接来自 `lib/projects.ts` 原对象**（零复制）：cover（真实截图，**next/image 渲染**，懒加载）+ name + category + description + tags + status + links（**Moss World 显示「本地项目 · 未公开上线，暂无公开链接」，无链接按钮**）；底部两动作：「在详情页打开」→ `/projects/[slug]`（SEO 路由双保险）、「返回探索」。

### 13.5 世界导航面板（M）

三项目传送卡（名称+状态+直达）、主岛回航、茧居所（发现后）、站点路由区（/projects /about /tech /contact /articles——数据单源 `components/layout/navigation.ts`，与 Navbar 同源）+ 联系入口（GitHub https://github.com/Ageha6912，lib/site.ts:53 唯一 configured 渠道；未配置渠道依 configured:false 隐藏）。

### 13.6 操作说明（H）

桌面键位表 / 触屏手势图示 / reduced-motion 与降级说明 / 「跳过探索，直接看项目列表」入口。

## 14. 测试改写映射（铁律 2 落地——随施工同步，不许事后补）

### 14.0 组件退役与保留清单（首页 3D 化的删改边界，先于测试改写定案）

| 处置 | 组件 | 理由 |
|---|---|---|
| **退役**（删除文件，随阶段 1） | components/home/Hero.tsx、HeroScene.tsx、FeaturedProjects.tsx、LatestNotes.tsx | 仅首页消费；首页主体重构为世界后无引用 |
| **保留**（内页复用，不动） | AboutSection.tsx、JourneySection.tsx（/about）、TechStackSection.tsx（/tech）、ContactSection.tsx（/contact）、ProjectCard.tsx（/projects 与 [slug]） | 内页路由仍在消费（架构审计 preserveList） |
| **保留**（数据单源，不动） | lib/notes.ts、lib/tech-stack.ts 等全部 lib/* | 数据永不删；写作计划标注的渲染新家为 /articles 空状态页 |

### 14.1 测试文件逐条改写（现有 11 文件 + 新增 2 文件）

| 测试文件 | 击穿点（实读行号） | 改写方向 |
|---|---|---|
| structure.test.mjs | 七版块导入顺序（:24-31） | 改守：page.tsx 渲染 WorldShell、WorldShell 含 ssr:false 动态加载、lib/world/ 四模块存在、#world-root 锚点存在 |
| hero.test.mjs | Hero 文案/STATS 逐字 | Hero.tsx 退役：文案契约迁移至 LoadingScreen/IntroToast 的新家（逐字断言搬迁，不删除覆盖）；STATS 口径注释随之迁移 |
| home-sections.test.mjs | 三版块结构与数据同源 | 改守：ProjectDetailPanel/WorldNavPanel 渲染 lib/projects.ts 同源数据、三 slug 覆盖；LatestNotes 相关断言迁移至 /articles 页 |
| sections.test.mjs | 版块类串逐字 | 改守：HUD/面板类串新契约（玻璃令牌、对比度类） |
| site.test.mjs | **:70-100「七版块顺序」必挂**；:120-124 素材存在性不受影响 | :70-100 改写为「page.tsx 渲染 WorldShell + world 数据模块存在」；素材存在性断言保留（原图全保留） |
| routes.test.mjs | :243-247 readFileSync 读 HeroScene.tsx/FeaturedProjects.tsx（删文件即 ENOENT）；:225-241 裸 img 递归扫描**保留有效** | :243-247 首屏 priority 断言改写：详情面板封面 next/image 懒加载断言落 ProjectDetailPanel.tsx；:225-241 扫描不动——world/ui 新组件必须遵守（§11.1），违反即失败，这正是它的职责 |
| contrast.test.mjs | :222-293 hero-gradient-* CSS 端点与 Hero.tsx 品牌字/右缘面板断言随 Hero 退役失效 | 迁移为新家对比度契约：加载屏/HUD 品牌字新类串对玻璃底的 ≥3:1/≥4.5:1 同口径断言（断言迁移+目标类更新，守护意图不变）；hero-gradient-* 若 HTML 层不再用渐变文字则删除该组并记录于 §16 |
| content-honesty.test.mjs | :112-123 LatestNotes.tsx 消费 plannedNoteLabel 断言（删文件即挂） | 断言迁移至写作计划常驻新家 app/articles/page.tsx 渲染 {plannedNoteLabel}（施工时核对，未渲染则补齐渲染而非改断言）；域名白名单核心（:44,60-76）**不动**，并扩展断言 3D 面板/彩蛋文案不含白名单外域名与编造宣称 |
| responsive-perf.test.mjs | 响应式类断言 | 改守：performance.ts 档位表完整性、reduced-motion 钩子存在、FallbackProjects 存在、dpr 配置 |
| contrast / design-system 其余 | 现行口径 | design-system 基本不动；新类串同步补录 |
| readme.test.mjs | 测试计数 | 计数随本轮实跑更新（95→实数） |
| **新增** world-layout.test.mjs | — | 坐标表校验：三径起点在主岛边缘内、终点落在对应屿、交互登记覆盖三 slug+彩蛋、碰撞体含蝶枢与三屿主体、性能档位表三档齐全、**三屿屏幕贴图登记齐全**（§4 共同规范可测化） |
| **新增** world-assets.test.mjs | — | 按 §11 修订资产契约：允许配置本地授权字体的 `<Text>` 及来源明确的外部资产，不隐式依赖不稳定外链；检查运行资源路径、来源记录与预算；**world 组件无裸 `<img>`（对齐 routes 口径）**；**§11.2 产物存在 + statSync 体积预算断言**；资产处理脚本存在且维护来源记录 |

以上是测试迁移与修订要求，不表示本轮已经修改测试或通过验证。新技术接入时同步覆盖碰撞与输入行为、资源加载失败、静音、低档及卸载清理，不仅检查源码关键字。

## 15. 初版施工阶段记录（四阶段，每阶段独立过门禁）

> 以下保留初版阶段划分，不是当前工作区状态或新一轮待办。后续优化按 [优化方案](3d-world-optimization-plan.md) 的 P0—P4 执行，不重复初版退役、配置修改或基线提交操作。
>
> **初版阶段 0 记录**：当时工作区有 25 个未提交文件（+978/−499），要求在获准后保存基线；另记录 eslint 的 screenshots 忽略范围与 README 测试计数问题。此处仅保留历史背景，不授权本轮提交或修改配置。

### 阶段 1 · 核心世界骨架（可跑可走）

- **交付**：依赖安装；WorldShell/WorldCanvas/LoadingScreen（含 h1，§13.1）；主岛+蝶径雏形（几何光带，无美术精修、零纹理）+天空/雾/冰海/远景剪影；浮游信灯 + 桌面键鼠控制 + 移动摇杆；跟随相机（含遮挡）；三项目屿**占位体**（简单体量+名牌）；HUD 空壳 + 首页沉浸 CSS（:has 方案）；**按 §14.0 执行组件退役**。
- **测试**：新增 world-layout.test.mjs / world-assets.test.mjs（基础断言）；**同步改写八个文件**中被首页退役击穿的断言：structure/hero/home-sections/sections/site/routes/contrast/content-honesty（逐条见 §14.1——v1.0 仅列五文件的口径作废）。
- **门禁**：`npm run build` + `npm test` 全绿；浏览器实操：加载→移动→三径行走→相机拖拽/缩放→无控制台报错。

### 阶段 2 · 项目交互与信息层（体验闭环）

- **交付**：三项目屿正式造型（§4 差异化）；**prepare-world-assets.mjs 脚本 + 三屿屏幕贴图压缩版 + 蝶精灵**（§11.2）；交互系统全量（靠近/悬停/触发/提示）；项目详情面板（next/image 封面 + 真实数据 + 链接白名单 + Moss 诚实空链）；世界导航/传送；操作说明；IntroToast；茧居所旋梯与画廊雏形；路由双保险（面板→/projects/[slug]）。
- **测试**：home-sections/content-honesty 迁移断言完成态；world-layout 补三屿屏幕贴图登记断言；world-assets 补产物体积断言。
- **门禁**：build+test 绿；浏览器全闭环实测：靠近→提示→面板→**4 条白名单链接逐条点击验证**（① https://os.ageha.cn ② https://cs.ageha.cn ③ https://github.com/Ageha6912/cs-market——以上 lib/projects.ts；④ https://github.com/Ageha6912——lib/site.ts:53，世界导航面板联系区）→返回→传送→路由页往返。

### 阶段 3 · 品牌视觉与美术完整

- **交付**：butterflyShape 转换工具 + 蝶枢/引导蝶/蝶群三件套；材质灯光精修（transmission 名额管控）；云层/冰海/远景层次；鳞粉粒子；茧居所画廊完整（三画框压缩版纹理 + 按需加载 + 蝶茧彩蛋）；主岛石碑与名牌美术化。
- **测试**：world-assets 扩展（蝶精灵来源注释、画廊产物存在）；design-system/contrast 新类串核对。
- **门禁**：build+test 绿；2560×1440 / 1920×1080 / 1440×900 三分辨率构图实测（初始构图完整性、UI 不挡交互、对比度）。

### 阶段 4 · 响应式、性能与降级

- **交付**：AdaptiveQuality 帧率自适应；移动端全项优化（档位/热区/摇杆实测调参）；WebGL 失败降级页；reduced-motion 全项；webglcontextlost 恢复；资源清理审计（往返首页无泄漏，含 §11.2 按需纹理的 dispose）；README 更新。
- **测试**：responsive-perf 改写完成态（§14.1）；readme 计数更新。
- **门禁**：build+test 绿；brief §11 验证清单全项实测（帧率/帧时间/内存稳定性/移动视口/低性能/失败路径），**实测结果如实记录进阶段报告，未验证项明确标注**。

## 16. 关键决策记录与风险清单

1. **角色选型**：浮游信灯是初版选择，服务光蝶引路的世界观并区别于参考站载具；后续可按操作可读性与手感改进模型、动画和控制，不以零骨骼动画成本限制表现。
2. **音效已允许，尚待实施**：可使用原创合成或授权明确的音效与音乐。用户手势后启动，提供静音与音量控制，管理空间衰减、并发播放、后台暂停和资源释放；重要反馈始终保留视觉通道。
3. **Navbar 叠加用 CSS `:has()`**：零 JS、SSR 安全、其它路由零影响；需要的目标浏览器（2023+ 全线）均支持；`WorldShell` 根节点 `id="world-root"` 为契约锚点，测试断言锁定。
4. **渲染预算与字体契约可修订**：`transmission ≤3 mesh` 是初版预算，不是永久红线；允许后处理与本地授权字体的 `<Text>`。调整时同步档位和测试，保留可读性、可控资源交付与性能验证。
5. **Moss World 岛视觉可丰富但零链接**：作品集生态舱演示须与真实项目能力区分；保留“可本地运行、无公开入口”的状态，不编造在线入口或完整生态模拟能力。
6. **图片契约不松口**（v1.1 修订核心）：routes.test.mjs:225-241 全站禁裸 `<img>` 保持原样，world 组件遵守而非破例——新 UI 用 next/image 的成本可忽略，保住既有优化纪律。
7. **资产工具依赖按需声明**：初版使用随 Next 安装的 sharp；后续直接依赖的图片、模型、纹理与音频工具应按实际需要显式声明版本，核实许可与兼容性，保证处理过程可复现，不受零新增依赖限制。
8. **遗留风险**：①three@0.186 与 drei@10.7 的 API 若在施工期有 breaking 变化，以实装版本实测为准并回报；②移动端低端 WebGL 实测设备有限，帧率结论必须注明测试机型；③hero.test.mjs 的 STATS 口径迁移需逐字对账，防止文案走样；④contrast 的 hero-gradient-* 断言若新 HTML 层无渐变文字则按 §14.1 记录后删除，须在阶段 1 报告中列明。
