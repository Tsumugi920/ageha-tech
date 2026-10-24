/**
 * 设计系统测试（node:test）：
 * 解析 app/globals.css 的 @theme 令牌块（花括号配平 + 声明切分），
 * 校验核心设计令牌（--color-sky / --color-blue / --color-glass 等）
 * 与 .glass-panel / .glass-card 玻璃拟态类的存在、令牌消费与真实使用。
 * 运行方式：npm test（即 node --test "tests/*.test.mjs"）
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readProjectFile = (relativePath) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

/**
 * 解析 @theme 块内全部 CSS 自定义属性（令牌名 → 值）。
 * 真正做花括号配平与声明切分，而不是对整份 CSS 做单点正则匹配，
 * 这样「令牌只出现在注释里」也会被判为缺失。
 */
function parseThemeTokens(css) {
  const themeStart = css.indexOf("@theme");
  assert.ok(themeStart !== -1, "globals.css 应包含 @theme 设计令牌块");

  const open = css.indexOf("{", themeStart);
  assert.ok(open !== -1, "@theme 块应正常开启");

  let depth = 0;
  let close = -1;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  assert.ok(close !== -1, "@theme 块应正常闭合");

  const tokens = new Map();
  for (const declaration of css.slice(open + 1, close).split(";")) {
    const match = declaration.match(/(--[\w-]+)\s*:\s*([\s\S]+)/);
    if (match) {
      tokens.set(match[1], match[2].trim());
    }
  }
  return tokens;
}

/* ------------------------------ 核心令牌 ------------------------------ */

test("globals.css @theme：核心设计令牌全部就位且带非空值", () => {
  const tokens = parseThemeTokens(readProjectFile("app/globals.css"));

  const requiredTokens = [
    // 表面 / 背景
    "--color-sky",
    "--color-ice",
    "--color-lavender",
    // 文字
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-muted",
    // 品牌强调色
    "--color-blue",
    "--color-cyan",
    "--color-purple",
    "--color-pink",
    // 玻璃拟态与细线
    "--color-glass",
    "--color-glass-strong",
    "--color-glass-border",
    "--color-line",
    // 投影
    "--shadow-glow",
    "--shadow-card",
    // 字体栈
    "--font-display",
    "--font-sans",
    "--font-mono",
  ];
  for (const token of requiredTokens) {
    const value = tokens.get(token);
    assert.ok(value !== undefined, `@theme 缺少设计令牌 ${token}`);
    assert.ok(value.length > 0, `设计令牌 ${token} 不应为空值`);
  }

  // 核心色值与设计稿逐字一致（取自 globals.css 现值）
  assert.equal(tokens.get("--color-sky"), "#DDF3FF", "--color-sky 应为冰蓝天空色");
  assert.equal(tokens.get("--color-blue"), "#269DFF", "--color-blue 应为品牌蓝");
  assert.equal(
    tokens.get("--color-glass"),
    "rgba(255,255,255,0.48)",
    "--color-glass 应为半透明白玻璃",
  );
  assert.equal(
    tokens.get("--color-glass-strong"),
    "rgba(255,255,255,0.74)",
    "--color-glass-strong 应为更实的白玻璃",
  );
});

test("globals.css @theme：全部 --color-* 令牌值为合法颜色格式", () => {
  const tokens = parseThemeTokens(readProjectFile("app/globals.css"));

  const colorTokens = [...tokens.entries()].filter(([name]) =>
    name.startsWith("--color-"),
  );
  assert.ok(
    colorTokens.length >= 14,
    `应解析出至少 14 个颜色令牌，实际 ${colorTokens.length}`,
  );
  for (const [name, value] of colorTokens) {
    assert.match(
      value,
      /^#(?:[0-9a-f]{3,8})$|^rgba?\([\s\S]+\)$/i,
      `令牌 ${name} 的值 "${value}" 不是合法的 hex / rgb() 颜色`,
    );
  }
});

/* --------------------------- 玻璃拟态类 --------------------------- */

test("globals.css：.glass-panel / .glass-card 类就位并真实消费核心令牌", () => {
  const css = readProjectFile("app/globals.css");

  const panel = css.match(/\.glass-panel\s*\{([\s\S]*?)\}/);
  assert.ok(panel, "缺少 .glass-panel 玻璃面板类");
  assert.match(panel[1], /var\(--color-glass\)/, ".glass-panel 应消费 --color-glass 令牌");
  assert.match(
    panel[1],
    /var\(--color-glass-border\)/,
    ".glass-panel 应消费 --color-glass-border 令牌",
  );
  assert.match(panel[1], /backdrop-filter:\s*blur\(/i, ".glass-panel 应有毛玻璃模糊");
  assert.match(panel[1], /var\(--shadow-card\)/, ".glass-panel 应消费 --shadow-card 令牌");

  const card = css.match(/\.glass-card\s*\{([\s\S]*?)\}/);
  assert.ok(card, "缺少 .glass-card 玻璃卡片类");
  assert.match(
    card[1],
    /var\(--color-glass-strong\)/,
    ".glass-card 应消费 --color-glass-strong 令牌",
  );
  assert.match(card[1], /backdrop-filter:\s*blur\(/i, ".glass-card 应有毛玻璃模糊");

  // body 底色渐变同样消费天空令牌（--color-sky → --color-ice）
  const body = css.match(/\bbody\s*\{([\s\S]*?)\}/);
  assert.ok(body, "缺少 body 全局规则");
  assert.match(body[1], /var\(--color-sky\)/, "body 渐变应消费 --color-sky");
  assert.match(body[1], /var\(--color-ice\)/, "body 渐变应消费 --color-ice");
});

test("玻璃拟态类被真实消费：app/ 与 components/ 中至少各命中一次", () => {
  let panelUsages = 0;
  let cardUsages = 0;
  const scan = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.name.endsWith(".tsx")) {
        const source = readFileSync(full, "utf8");
        if (source.includes("glass-panel")) panelUsages += 1;
        if (source.includes("glass-card")) cardUsages += 1;
      }
    }
  };
  scan(path.join(projectRoot, "app"));
  scan(path.join(projectRoot, "components"));

  assert.ok(panelUsages >= 1, ".glass-panel 应至少被一个组件使用（当前 0 次）");
  assert.ok(cardUsages >= 1, ".glass-card 应至少被一个组件使用（当前 0 次）");
});
