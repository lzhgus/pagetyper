(function pageTyperRewardsModule(global) {
  const DEFAULT_SETTINGS = Object.freeze({
    defaultMode: "overlay",
    rewardsEnabled: true,
    milestoneSize: 100,
    effectLevel: "minimal",
    keypressSoundEnabled: false,
    mistakeSoundEnabled: false,
    soundEnabled: false,
    statsEnabled: true
  });
  const DEFAULT_STATS = Object.freeze({
    totalCharacters: 0,
    currentStreak: 0,
    bestStreak: 0,
    badges: []
  });
  const BADGES = Object.freeze([
    { id: "first-100", label: "First 100" },
    { id: "perfect-100", label: "Perfect 100" },
    { id: "focus-flow", label: "Focus Flow" },
    { id: "thousand-typed", label: "1,000 Typed" }
  ]);
  const SETTINGS_KEY = "pagetyper:settings";
  const STATS_KEY = "pagetyper:stats";

  function pickAllowed(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function normalizeSettings(input) {
    const settings = input && typeof input === "object" ? input : {};
    const milestoneSize = Number.isInteger(settings.milestoneSize) && settings.milestoneSize >= 25 ? settings.milestoneSize : DEFAULT_SETTINGS.milestoneSize;

    return {
      defaultMode: pickAllowed(settings.defaultMode, ["overlay", "inline"], DEFAULT_SETTINGS.defaultMode),
      rewardsEnabled: typeof settings.rewardsEnabled === "boolean" ? settings.rewardsEnabled : DEFAULT_SETTINGS.rewardsEnabled,
      milestoneSize,
      effectLevel: pickAllowed(settings.effectLevel, ["off", "minimal", "full"], DEFAULT_SETTINGS.effectLevel),
      keypressSoundEnabled: typeof settings.keypressSoundEnabled === "boolean" ? settings.keypressSoundEnabled : DEFAULT_SETTINGS.keypressSoundEnabled,
      mistakeSoundEnabled: typeof settings.mistakeSoundEnabled === "boolean" ? settings.mistakeSoundEnabled : DEFAULT_SETTINGS.mistakeSoundEnabled,
      soundEnabled: typeof settings.soundEnabled === "boolean" ? settings.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      statsEnabled: typeof settings.statsEnabled === "boolean" ? settings.statsEnabled : DEFAULT_SETTINGS.statsEnabled
    };
  }

  function normalizeStats(input) {
    const stats = input && typeof input === "object" ? input : {};
    return {
      totalCharacters: Math.max(0, Number(stats.totalCharacters) || 0),
      currentStreak: Math.max(0, Number(stats.currentStreak) || 0),
      bestStreak: Math.max(0, Number(stats.bestStreak) || 0),
      badges: Array.isArray(stats.badges) ? Array.from(new Set(stats.badges.filter((badge) => typeof badge === "string"))) : []
    };
  }

  function getNewBadges(stats, milestoneCount, mistakeCount) {
    const badgeIds = new Set(stats.badges);
    const newBadgeIds = [];

    if (stats.totalCharacters >= 100 && !badgeIds.has("first-100")) {
      newBadgeIds.push("first-100");
    }

    if (milestoneCount === 100 && mistakeCount === 0 && !badgeIds.has("perfect-100")) {
      newBadgeIds.push("perfect-100");
    }

    if (stats.currentStreak >= 5 && !badgeIds.has("focus-flow")) {
      newBadgeIds.push("focus-flow");
    }

    if (stats.totalCharacters >= 1000 && !badgeIds.has("thousand-typed")) {
      newBadgeIds.push("thousand-typed");
    }

    return newBadgeIds.map((id) => BADGES.find((badge) => badge.id === id)).filter(Boolean);
  }

  function applyMilestoneProgress({ previousIndex, currentIndex, mistakeCount, settings, stats }) {
    const normalizedSettings = normalizeSettings(settings);
    const nextStats = normalizeStats(stats);
    const events = [];

    if (!normalizedSettings.rewardsEnabled) {
      return { stats: nextStats, events };
    }

    const milestoneSize = normalizedSettings.milestoneSize;
    const startMilestone = Math.floor(Math.max(0, previousIndex || 0) / milestoneSize) + 1;
    const endMilestone = Math.floor(Math.max(0, currentIndex || 0) / milestoneSize);

    for (let milestone = startMilestone; milestone <= endMilestone; milestone += 1) {
      const count = milestone * milestoneSize;
      nextStats.totalCharacters += milestoneSize;
      nextStats.currentStreak += 1;
      nextStats.bestStreak = Math.max(nextStats.bestStreak, nextStats.currentStreak);

      const badges = getNewBadges(nextStats, count, mistakeCount || 0);
      if (badges.length > 0) {
        nextStats.badges = nextStats.badges.concat(badges.map((badge) => badge.id));
      }

      events.push({
        type: "milestone",
        count,
        streak: nextStats.currentStreak,
        badges
      });
    }

    return { stats: nextStats, events };
  }

  const api = {
    DEFAULT_SETTINGS,
    DEFAULT_STATS,
    BADGES,
    SETTINGS_KEY,
    STATS_KEY,
    normalizeSettings,
    normalizeStats,
    applyMilestoneProgress
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.PageTyperRewards = api;
  }
})(globalThis);
