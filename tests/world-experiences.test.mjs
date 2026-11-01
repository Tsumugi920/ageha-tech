/**
 * P3 三项目区场景体验数据测试：
 * - 每区恰好 3 个演示选项，id/label 唯一且非空；
 * - 体验标题、复位文案齐全；
 * - 诚实边界：所有体验说明明确是演示，不得宣称实时连接/行情/生态模拟。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPERIENCE_NOTES,
  EXPERIENCE_OPTIONS,
  EXPERIENCE_RESET_LABELS,
  EXPERIENCE_TITLES,
  getExperienceOptions,
  isExperienceProjectSlug,
  isValidExperienceOption,
} from "../lib/world/experiences.ts";
import { PROJECT_ISLES } from "../lib/world/layout.ts";

test("三项目区各有 3 个不重复的场景体验选项", () => {
  const slugs = PROJECT_ISLES.map((isle) => isle.slug).sort();
  assert.deepEqual(slugs, ["agehaos", "cs-skin-invest", "moss-world"]);
  for (const slug of slugs) {
    const options = getExperienceOptions(slug);
    assert.ok(options, `${slug} 应有体验选项`);
    assert.equal(options.length, 3, `${slug} 应恰好 3 个选项`);
    assert.equal(
      new Set(options.map((option) => option.id)).size,
      3,
      `${slug} 选项 id 不得重复`,
    );
    assert.equal(
      new Set(options.map((option) => option.label)).size,
      3,
      `${slug} 选项 label 不得重复`,
    );
    for (const option of options) {
      assert.ok(option.id.length > 0, `${slug} 选项 id 非空`);
      assert.ok(option.label.length > 0, `${slug} 选项 label 非空`);
    }
    assert.ok(EXPERIENCE_TITLES[slug].length > 0);
    assert.ok(EXPERIENCE_RESET_LABELS[slug].length > 0);
    assert.ok(EXPERIENCE_NOTES[slug].length > 0);
  }
});

test("体验说明保持诚实边界：演示、非实时、非生态模拟", () => {
  assert.match(EXPERIENCE_NOTES.agehaos, /演示/);
  assert.match(EXPERIENCE_NOTES.agehaos, /非实时/);
  assert.match(EXPERIENCE_NOTES["cs-skin-invest"], /演示数据/);
  assert.match(EXPERIENCE_NOTES["cs-skin-invest"], /非实时/);
  assert.match(EXPERIENCE_NOTES["moss-world"], /演示/);
  assert.match(EXPERIENCE_NOTES["moss-world"], /非生态/);
  for (const note of Object.values(EXPERIENCE_NOTES)) {
    assert.doesNotMatch(note, /(?<!非)实时(?:行情|连接)|完整生态/);
  }
});

test("体验选项校验：未知 slug / id 被拒绝，null 表示复位", () => {
  assert.equal(isExperienceProjectSlug("agehaos"), true);
  assert.equal(isExperienceProjectSlug("moss-world"), true);
  assert.equal(isExperienceProjectSlug("unknown"), false);
  assert.equal(isValidExperienceOption("agehaos", "windows"), true);
  assert.equal(isValidExperienceOption("agehaos", "unknown"), false);
  assert.equal(isValidExperienceOption("unknown", "windows"), false);
  assert.equal(isValidExperienceOption("moss-world", null), true);
  assert.equal(EXPERIENCE_OPTIONS.agehaos[0].label, "窗口");
});
