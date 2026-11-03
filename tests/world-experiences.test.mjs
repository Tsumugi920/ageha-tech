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
  assert.deepEqual(slugs, ["blog-cms", "calendar", "cs-major-archive"]);
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

test("体验说明保持诚实边界：演示、非项目实时画面", () => {
  for (const slug of ["cs-major-archive", "calendar", "blog-cms"]) {
    assert.match(EXPERIENCE_NOTES[slug], /演示/);
    assert.match(EXPERIENCE_NOTES[slug], /非项目实时画面/);
  }
  for (const note of Object.values(EXPERIENCE_NOTES)) {
    assert.doesNotMatch(note, /(?<!非)实时(?:行情|连接)|完整生态/);
  }
});

test("体验选项校验：未知 slug / id 被拒绝，null 表示复位", () => {
  assert.equal(isExperienceProjectSlug("cs-major-archive"), true);
  assert.equal(isExperienceProjectSlug("blog-cms"), true);
  assert.equal(isExperienceProjectSlug("unknown"), false);
  assert.equal(isValidExperienceOption("cs-major-archive", "champions"), true);
  assert.equal(isValidExperienceOption("cs-major-archive", "unknown"), false);
  assert.equal(isValidExperienceOption("unknown", "champions"), false);
  assert.equal(isValidExperienceOption("blog-cms", null), true);
  assert.equal(EXPERIENCE_OPTIONS["cs-major-archive"][0].label, "冠军堂");
});
