/**
* 技术栈数据：四组 × 每组四项，供 TechStackSection 渲染。
*
* 以下名单只表示「在用 / 在学」的能力方向，不附带任何熟练度、年限或认证声明；前两组对应助手作品的实际套路（原生前端 +
* Node.js + Express + data.json，或纯静态 localStorage）与本站的
* Next.js 结构，后两组为开发工具与在做的方向。
*
* - icon：lucide 图标键（在 TechStackSection 内统一映射，
* 保证 16 个图标尺寸与线条风格一致；lucide 无品牌 Logo，取语义近似的图形）；
* - color：各技术品牌色的近色值，仅用于图标配色点缀（整段保持素净）。
*/

export type TechIconKey =
| "atom"
| "layers"
| "file-type"
| "wind"
| "hexagon"
| "worm"
| "database"
| "leaf"
| "git-branch"
| "container"
| "square-code"
| "terminal"
| "flower"
| "asterisk"
| "box"
| "shell";

export type TechItem = {
/** 技术名 */
name: string;
/** lucide 图标键 */
icon: TechIconKey;
/** 品牌近色值（图标配色点缀） */
color: string;
};

export type TechGroup = {
/** 分组名 */
name: string;
items: TechItem[];
};

export const techGroups: TechGroup[] = [
{
name: "前端开发",
items: [
{ name: "原生 HTML / CSS / JS", icon: "file-type", color: "#E8590C"},
{ name: "React", icon: "atom", color: "#0EA5E9"},
{ name: "Next.js", icon: "layers", color: "#1F2937"},
{ name: "Tailwind CSS", icon: "wind", color: "#08A5C4"},
],
},
{
name: "后端与数据",
items: [
{ name: "Node.js", icon: "hexagon", color: "#4E9A3F"},
{ name: "Express", icon: "shell", color: "#334155"},
{ name: "JSON 文件存储", icon: "database", color: "#33679E"},
{ name: "localStorage", icon: "box", color: "#3F9E4D"},
],
},
{
name: "开发工具",
items: [
{ name: "Git", icon: "git-branch", color: "#E8491F"},
{ name: "GitHub", icon: "container", color: "#1D8FE1"},
{ name: "VS Code", icon: "square-code", color: "#0B78C2"},
{ name: "Linux", icon: "terminal", color: "#D97706"},
],
},
{
name: "在做的方向",
items: [
{ name: "网页小工具", icon: "flower", color: "#10A37F"},
{ name: "数据档案", icon: "asterisk", color: "#D97757"},
{ name: "交互实验", icon: "leaf", color: "#3F9E4D"},
{ name: "静态站点", icon: "worm", color: "#3776AB"},
],
},
];
