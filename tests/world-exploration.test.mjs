/**
 * P4 探索进度行为测试（node:test）：
 * - 五个目标登记 / 事件映射；
 * - 完成状态幂等、计数与登记顺序；
 * - 版本化 localStorage payload 的序列化 / 解析 / 损坏数据忽略；
 * - Storage 读 / 写 / 清除失败不抛异常，并如实返回可退化的结果。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPLORE_GOALS,
  EXPLORE_TOTAL,
  completeExploreGoal,
  countCompletedGoals,
  createEmptyExploreProgress,
  goalIdForExperience,
  isExploreComplete,
  isExploreGoalId,
  listCompletedGoals,
} from "../lib/world/exploration.ts";
import {
  EXPLORE_STORAGE_KEY,
  EXPLORE_STORAGE_VERSION,
  clearExploreProgress,
  loadExploreProgress,
  parseExploreProgress,
  saveExploreProgress,
  serializeExploreProgress,
} from "../lib/world/explorationStorage.ts";
import { EXPERIENCE_OPTIONS } from "../lib/world/experiences.ts";

/** 内存 Storage 替身：可注入读 / 写 / 删除失败 */
function memoryStorage({ failGet = false, failSet = false, failRemove = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem(key) {
      if (failGet) throw new Error("get blocked");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (failSet) throw new Error("set blocked");
      map.set(key, value);
    },
    removeItem(key) {
      if (failRemove) throw new Error("remove blocked");
      map.delete(key);
    },
  };
}

test("探索目标：恰好五个、id 唯一，三个项目体验映射到各自目标", () => {
  assert.equal(EXPLORE_TOTAL, 5);
  assert.equal(EXPLORE_GOALS.length, 5);
  assert.equal(new Set(EXPLORE_GOALS.map((goal) => goal.id)).size, 5);
  assert.deepEqual(
    EXPLORE_GOALS.map((goal) => goal.id),
    [
      "north-relay",
      "agehaos-experience",
      "cs-experience",
      "moss-experience",
      "nook-discovery",
    ],
  );
  for (const goal of EXPLORE_GOALS) {
    assert.ok(goal.title.length > 0, `${goal.id} 应有标题`);
    assert.ok(goal.hint.length > 0, `${goal.id} 应有提示`);
  }
  assert.equal(goalIdForExperience("agehaos"), "agehaos-experience");
  assert.equal(goalIdForExperience("cs-skin-invest"), "cs-experience");
  assert.equal(goalIdForExperience("moss-world"), "moss-experience");
  assert.equal(goalIdForExperience("unknown"), null);
  // 三项目与 lib/world/experiences.ts 的 slug 单源一致
  for (const slug of Object.keys(EXPERIENCE_OPTIONS)) {
    assert.ok(goalIdForExperience(slug), `${slug} 应有对应探索目标`);
  }
  assert.equal(isExploreGoalId("nook-discovery"), true);
  assert.equal(isExploreGoalId("history"), false);
  assert.equal(isExploreGoalId(null), false);
});

test("完成状态：幂等、不修改原对象、计数与顺序稳定", () => {
  const empty = createEmptyExploreProgress();
  assert.equal(countCompletedGoals(empty), 0);
  assert.equal(isExploreComplete(empty), false);
  assert.deepEqual(listCompletedGoals(empty), []);

  const one = completeExploreGoal(empty, "cs-experience");
  assert.notEqual(one, empty, "完成目标应返回新状态");
  assert.equal(empty["cs-experience"], false, "原状态不得被修改");
  assert.equal(countCompletedGoals(one), 1);
  assert.deepEqual(listCompletedGoals(one), ["cs-experience"]);

  const again = completeExploreGoal(one, "cs-experience");
  assert.equal(again, one, "重复完成应原样返回（不重复写盘）");

  const all = EXPLORE_GOALS.reduce(
    (progress, goal) => completeExploreGoal(progress, goal.id),
    one,
  );
  assert.equal(countCompletedGoals(all), 5);
  assert.equal(isExploreComplete(all), true);
  assert.deepEqual(
    listCompletedGoals(all),
    EXPLORE_GOALS.map((goal) => goal.id),
    "存档顺序应与目标登记顺序一致",
  );
  assert.equal(isExploreGoalId("bogus"), false);
});

test("存档 payload：带版本号、只含目标 id，可往返解析", () => {
  const progress = completeExploreGoal(
    completeExploreGoal(createEmptyExploreProgress(), "north-relay"),
    "moss-experience",
  );
  const raw = serializeExploreProgress(progress);
  const payload = JSON.parse(raw);
  assert.equal(payload.version, EXPLORE_STORAGE_VERSION);
  assert.deepEqual(payload.completed, ["north-relay", "moss-experience"]);
  assert.deepEqual(Object.keys(payload).sort(), ["completed", "version"]);
  assert.deepEqual(parseExploreProgress(raw), progress);

  const emptyRaw = serializeExploreProgress(createEmptyExploreProgress());
  assert.deepEqual(parseExploreProgress(emptyRaw), createEmptyExploreProgress());
});

test("解析容错：缺省 / 损坏 / 版本不符返回 null，同版本未知 id 被忽略", () => {
  assert.equal(parseExploreProgress(null), null);
  assert.equal(parseExploreProgress(""), null);
  assert.equal(parseExploreProgress("   "), null);
  assert.equal(parseExploreProgress("{"), null);
  assert.equal(parseExploreProgress("null"), null);
  assert.equal(parseExploreProgress("[]"), null);
  assert.equal(parseExploreProgress(JSON.stringify({ completed: [] })), null);
  assert.equal(
    parseExploreProgress(JSON.stringify({ version: 99, completed: ["north-relay"] })),
    null,
  );
  assert.equal(
    parseExploreProgress(JSON.stringify({ version: 1, completed: "north-relay" })),
    null,
  );
  const parsed = parseExploreProgress(
    JSON.stringify({
      version: 1,
      completed: ["north-relay", "unknown-goal", "north-relay", 42, null],
      extra: "ignored",
    }),
  );
  assert.deepEqual(listCompletedGoals(parsed), ["north-relay"]);
});

test("Storage 适配：读取、写入、清除均可用，且只写必要字段", () => {
  const storage = memoryStorage();
  const empty = loadExploreProgress(storage);
  assert.equal(empty.persisted, true);
  assert.equal(countCompletedGoals(empty.progress), 0);

  const progress = completeExploreGoal(
    completeExploreGoal(createEmptyExploreProgress(), "agehaos-experience"),
    "nook-discovery",
  );
  assert.equal(saveExploreProgress(storage, progress), true);
  assert.equal(storage.map.has(EXPLORE_STORAGE_KEY), true);

  const loaded = loadExploreProgress(storage);
  assert.equal(loaded.persisted, true);
  assert.deepEqual(listCompletedGoals(loaded.progress), [
    "agehaos-experience",
    "nook-discovery",
  ]);

  assert.equal(clearExploreProgress(storage), true);
  assert.equal(storage.map.has(EXPLORE_STORAGE_KEY), false);
  const cleared = loadExploreProgress(storage);
  assert.equal(cleared.persisted, true);
  assert.equal(countCompletedGoals(cleared.progress), 0);
});

test("Storage 失败：读 / 写 / 删除受限时退化且不抛异常", () => {
  const blockedRead = loadExploreProgress(memoryStorage({ failGet: true }));
  assert.equal(blockedRead.persisted, false);
  assert.equal(countCompletedGoals(blockedRead.progress), 0);

  const progress = completeExploreGoal(
    createEmptyExploreProgress(),
    "north-relay",
  );
  assert.equal(
    saveExploreProgress(memoryStorage({ failSet: true }), progress),
    false,
  );
  assert.equal(saveExploreProgress(null, progress), false);

  const blockedNone = loadExploreProgress(null);
  assert.equal(blockedNone.persisted, false);
  assert.equal(countCompletedGoals(blockedNone.progress), 0);
  assert.equal(clearExploreProgress(null), false);

  // removeItem 不可用时退化为写入空进度并复核
  const noRemove = memoryStorage({ failRemove: true });
  noRemove.map.set(
    EXPLORE_STORAGE_KEY,
    serializeExploreProgress(progress),
  );
  assert.equal(clearExploreProgress(noRemove), true);
  assert.equal(
    countCompletedGoals(loadExploreProgress(noRemove).progress),
    0,
    "删除失败后应已用空记录覆盖，刷新不会恢复旧进度",
  );

  const bothBlocked = memoryStorage({ failRemove: true, failSet: true });
  bothBlocked.map.set(
    EXPLORE_STORAGE_KEY,
    serializeExploreProgress(progress),
  );
  assert.equal(clearExploreProgress(bothBlocked), false);
});

test("损坏的本地记录不会伪造完成状态", () => {
  const storage = memoryStorage();
  storage.map.set(EXPLORE_STORAGE_KEY, "{broken");
  const loaded = loadExploreProgress(storage);
  assert.equal(loaded.persisted, true);
  assert.equal(countCompletedGoals(loaded.progress), 0);

  storage.map.set(
    EXPLORE_STORAGE_KEY,
    JSON.stringify({ version: 1, completed: ["north-relay", "make-believe"] }),
  );
  const sanitized = loadExploreProgress(storage);
  assert.deepEqual(listCompletedGoals(sanitized.progress), ["north-relay"]);
});
