(function pageTyperMetricsModule(global) {
  function normalizePracticeText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isTypingKey(event) {
    return Boolean(
      event &&
        event.key &&
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
    );
  }

  function evaluateCharacter(expected, actual) {
    return String(expected) === String(actual);
  }

  function calculateStats(stats) {
    const typedCount = Math.max(0, stats.typedCount || 0);
    const mistakeCount = Math.max(0, stats.mistakeCount || 0);
    const completedCount = Math.max(0, stats.completedCount || 0);
    const elapsedMs = Math.max(0, (stats.now || 0) - (stats.startedAt || 0));
    const elapsedMinutes = elapsedMs / 60000;
    const accuracy = typedCount === 0 ? 100 : Math.max(0, ((typedCount - mistakeCount) / typedCount) * 100);
    const wpm = elapsedMinutes === 0 ? 0 : completedCount / 5 / elapsedMinutes;

    return {
      accuracy: Math.round(accuracy),
      wpm: Math.round(wpm),
      elapsedMs
    };
  }

  const api = {
    normalizePracticeText,
    isTypingKey,
    evaluateCharacter,
    calculateStats
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.PageTyperMetrics = api;
  }
})(globalThis);
