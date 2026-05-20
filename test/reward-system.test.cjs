const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
  normalizeSettings,
  applyMilestoneProgress
} = require("../src/reward-system.js");

test("normalizeSettings keeps feedback configurable with safe defaults", () => {
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ milestoneSize: 0, effectLevel: "loud" }), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ rewardsEnabled: false, milestoneSize: 50, effectLevel: "full" }), {
    ...DEFAULT_SETTINGS,
    rewardsEnabled: false,
    milestoneSize: 50,
    effectLevel: "full"
  });
});

test("applyMilestoneProgress emits one event per crossed milestone", () => {
  const result = applyMilestoneProgress({
    previousIndex: 95,
    currentIndex: 205,
    mistakeCount: 2,
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS
  });

  assert.equal(result.stats.totalCharacters, 200);
  assert.equal(result.stats.currentStreak, 2);
  assert.equal(result.stats.bestStreak, 2);
  assert.deepEqual(
    result.events.map((event) => event.count),
    [100, 200]
  );
});

test("applyMilestoneProgress awards starter and perfect badges", () => {
  const result = applyMilestoneProgress({
    previousIndex: 0,
    currentIndex: 100,
    mistakeCount: 0,
    settings: DEFAULT_SETTINGS,
    stats: DEFAULT_STATS
  });

  assert.deepEqual(result.stats.badges, ["first-100", "perfect-100"]);
  assert.deepEqual(
    result.events[0].badges.map((badge) => badge.id),
    ["first-100", "perfect-100"]
  );
});

test("applyMilestoneProgress does not emit events when rewards are disabled", () => {
  const result = applyMilestoneProgress({
    previousIndex: 0,
    currentIndex: 100,
    mistakeCount: 0,
    settings: { ...DEFAULT_SETTINGS, rewardsEnabled: false },
    stats: DEFAULT_STATS
  });

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.stats, DEFAULT_STATS);
});
