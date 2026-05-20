const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePracticeText,
  isTypingKey,
  evaluateCharacter,
  calculateStats
} = require("../src/text-metrics.js");

test("normalizePracticeText collapses whitespace for stable typing", () => {
  assert.equal(normalizePracticeText("  One\n\n  two\tthree  "), "One two three");
});

test("isTypingKey accepts printable keys without command modifiers", () => {
  assert.equal(isTypingKey({ key: "a" }), true);
  assert.equal(isTypingKey({ key: "Backspace" }), false);
  assert.equal(isTypingKey({ key: "a", metaKey: true }), false);
});

test("evaluateCharacter compares the expected character exactly", () => {
  assert.equal(evaluateCharacter("a", "a"), true);
  assert.equal(evaluateCharacter("a", "A"), false);
});

test("calculateStats reports WPM and accuracy from completed characters", () => {
  const result = calculateStats({
    startedAt: 0,
    now: 60000,
    typedCount: 10,
    completedCount: 10,
    mistakeCount: 2
  });

  assert.deepEqual(result, {
    accuracy: 80,
    wpm: 2,
    elapsedMs: 60000
  });
});
