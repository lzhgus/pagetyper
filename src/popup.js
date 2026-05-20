(async function pageTyperPopup() {
  const status = document.getElementById("status");
  const overlay = document.getElementById("overlay");
  const inline = document.getElementById("inline");
  const defaultMode = document.getElementById("default-mode");
  const rewardsEnabled = document.getElementById("rewards-enabled");
  const effectLevel = document.getElementById("effect-level");
  const soundEnabled = document.getElementById("sound-enabled");
  const statsEnabled = document.getElementById("stats-enabled");
  const statsSummary = document.getElementById("stats-summary");
  const RUNNABLE_PAGE_PATTERN = /^(https?:|file:)/;
  const rewards = window.PageTyperRewards;
  let settings = rewards.DEFAULT_SETTINGS;

  function canRunOnTab(tab) {
    return tab && tab.id && RUNNABLE_PAGE_PATTERN.test(tab.url || "");
  }

  async function getTargetTabs() {
    const queryOptions = [{ active: true, lastFocusedWindow: true }, { active: true, currentWindow: true }, { active: true }];
    const seen = new Set();
    const tabs = [];

    for (const options of queryOptions) {
      const matches = await chrome.tabs.query(options);
      for (const tab of matches) {
        if (!canRunOnTab(tab) || seen.has(tab.id)) {
          continue;
        }

        seen.add(tab.id);
        tabs.push(tab);
      }
    }

    return tabs;
  }

  async function sendToActiveTab(message) {
    const tabs = await getTargetTabs();
    let lastError = null;

    for (const tab of tabs) {
      try {
        return await chrome.tabs.sendMessage(tab.id, message);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("No active article tab.");
  }

  async function loadSettings() {
    const result = await chrome.storage.sync.get(rewards.SETTINGS_KEY);
    settings = rewards.normalizeSettings(result[rewards.SETTINGS_KEY]);
    defaultMode.value = settings.defaultMode;
    rewardsEnabled.checked = settings.rewardsEnabled;
    effectLevel.value = settings.effectLevel;
    soundEnabled.checked = settings.soundEnabled;
    statsEnabled.checked = settings.statsEnabled;
  }

  async function loadStats() {
    const result = await chrome.storage.local.get(rewards.STATS_KEY);
    const stats = rewards.normalizeStats(result[rewards.STATS_KEY]);
    const badges = stats.badges.length === 0 ? "No badges yet" : `${stats.badges.length} badge${stats.badges.length === 1 ? "" : "s"}`;
    statsSummary.textContent = `${stats.totalCharacters.toLocaleString()} milestone characters · best streak ${stats.bestStreak} · ${badges}`;
  }

  async function saveSettings() {
    settings = rewards.normalizeSettings({
      defaultMode: defaultMode.value,
      rewardsEnabled: rewardsEnabled.checked,
      effectLevel: effectLevel.value,
      soundEnabled: soundEnabled.checked,
      statsEnabled: statsEnabled.checked
    });
    await chrome.storage.sync.set({ [rewards.SETTINGS_KEY]: settings });

    try {
      await sendToActiveTab({ type: "PAGE_TYPER_SETTINGS_UPDATED", settings });
    } catch (error) {
      // The active page may not have the content script yet; saved settings still apply next start.
    }
  }

  async function refreshStatus() {
    try {
      const response = await sendToActiveTab({ type: "PAGE_TYPER_STATUS" });
      overlay.textContent = response.enabled ? "Stop typing mode" : "Overlay mode";
      inline.disabled = response.enabled;
      status.textContent = response.enabled ? `${response.mode} mode is active.` : "Ready on this page.";
    } catch (error) {
      overlay.disabled = true;
      inline.disabled = true;
      status.textContent = "This page cannot run PageTyper.";
    }
  }

  overlay.addEventListener("click", async () => {
    try {
      const response = await sendToActiveTab({ type: "PAGE_TYPER_TOGGLE" });
      overlay.textContent = response.enabled ? "Stop typing mode" : "Overlay mode";
      inline.disabled = response.enabled;
      status.textContent = response.message || "Updated.";
    } catch (error) {
      status.textContent = "Refresh the page, then try again.";
    }
  });

  inline.addEventListener("click", async () => {
    try {
      const response = await sendToActiveTab({ type: "PAGE_TYPER_START", mode: "inline" });
      overlay.textContent = response.enabled ? "Stop typing mode" : "Overlay mode";
      inline.disabled = response.enabled;
      status.textContent = response.message || "Updated.";
    } catch (error) {
      status.textContent = "Refresh the page, then try again.";
    }
  });

  [defaultMode, rewardsEnabled, effectLevel, soundEnabled, statsEnabled].forEach((control) => {
    control.addEventListener("change", saveSettings);
  });

  await loadSettings();
  await loadStats();
  await refreshStatus();
})();
