(function pageTyperContent() {
  if (window.__pageTyperInstalled) {
    return;
  }

  window.__pageTyperInstalled = true;

  const MIN_ARTICLE_LENGTH = 240;
  const MAX_ARTICLE_LENGTH = 60000;
  const ARTICLE_CANDIDATE_SELECTORS = [
    "#markdown",
    "[data-pagefind-body]",
    "[data-mdx-content]",
    "article",
    "main",
    "[role='main']",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".article-body",
    "#article",
    "#content"
  ];
  const READABLE_BLOCK_SELECTOR = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "blockquote",
    "pre",
    "[class*='mdx-p']",
    "[class*='mdx-h']",
    "[class*='mdx-ul']",
    "[class*='mdx-ol']",
    "[class*='callout']"
  ].join(",");
  const metrics = window.PageTyperMetrics;
  const rewards = window.PageTyperRewards;
  let state = null;
  let cachedSettings = rewards.normalizeSettings();
  let cachedStats = rewards.normalizeStats();
  let typingAudio = null;

  function readStorage(area, key) {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage[area]) {
        resolve(undefined);
        return;
      }

      chrome.storage[area].get(key, (result) => {
        resolve(result ? result[key] : undefined);
      });
    });
  }

  function writeStorage(area, key, value) {
    if (!chrome.storage || !chrome.storage[area]) {
      return;
    }

    chrome.storage[area].set({ [key]: value });
  }

  async function loadStoredState() {
    const [storedSettings, storedStats] = await Promise.all([
      readStorage("sync", rewards.SETTINGS_KEY),
      readStorage("local", rewards.STATS_KEY)
    ]);
    cachedSettings = rewards.normalizeSettings(storedSettings);
    cachedStats = rewards.normalizeStats(storedStats);
  }

  function getText(node) {
    return metrics.normalizePracticeText(node ? node.innerText || node.textContent : "");
  }

  function getLinkDensity(node) {
    const textLength = getText(node).length || 1;
    const linkLength = Array.from(node.querySelectorAll("a")).reduce((sum, link) => sum + getText(link).length, 0);
    return linkLength / textLength;
  }

  function getCandidatePriority(node) {
    const marker = `${node.id || ""} ${node.className || ""}`.toLowerCase();

    if (node.matches("#markdown,[data-pagefind-body],[data-mdx-content]")) {
      return 20000;
    }

    if (node.matches("article")) {
      return 12000;
    }

    if (/\b(post|entry|article|markdown|mdx|content)\b/.test(marker)) {
      return 3000;
    }

    if (node.matches("main,[role='main']")) {
      return 1000;
    }

    return 0;
  }

  function scoreCandidate(node) {
    const text = getText(node);
    const paragraphCount = node.querySelectorAll("p,[class*='mdx-p']").length;
    const headingCount = node.querySelectorAll("h1,h2,h3,h4,[class*='mdx-h']").length;
    const linkPenalty = getLinkDensity(node) * text.length * 0.8;
    const priority = getCandidatePriority(node);

    return text.length + paragraphCount * 120 + headingCount * 40 + priority - linkPenalty;
  }

  function findArticleNode() {
    const candidates = ARTICLE_CANDIDATE_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const uniqueCandidates = Array.from(new Set(candidates)).filter((node) => getText(node).length >= MIN_ARTICLE_LENGTH);

    if (uniqueCandidates.length === 0) {
      return document.body;
    }

    return uniqueCandidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  }

  function isNestedInSelectedBlock(node, selectedBlocks) {
    return selectedBlocks.some((block) => block !== node && block.contains(node));
  }

  function getReadableBlockNodes(articleNode) {
    const selectedBlocks = [];
    const blocks = Array.from(articleNode.querySelectorAll(READABLE_BLOCK_SELECTOR));

    for (const block of blocks) {
      const text = getText(block);
      if (text.length < 10 || isNestedInSelectedBlock(block, selectedBlocks)) {
        continue;
      }

      selectedBlocks.push(block);
    }

    return selectedBlocks;
  }

  function getReadableBlocks(articleNode) {
    return getReadableBlockNodes(articleNode).map((node) => getText(node));
  }

  function extractArticle() {
    const articleNode = findArticleNode();
    const blockNodes = getReadableBlockNodes(articleNode);
    const blocks = blockNodes.map((node) => getText(node));
    const articleText = metrics.normalizePracticeText(blocks.join(" "));
    const fallbackText = getText(articleNode);
    const text = articleText.length >= MIN_ARTICLE_LENGTH ? articleText : fallbackText;

    return {
      articleNode,
      blockNodes,
      title: document.title || "Untitled page",
      text: text.slice(0, MAX_ARTICLE_LENGTH)
    };
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text) {
      element.textContent = text;
    }
    return element;
  }

  function renderCharacterSpans(container, text) {
    const fragment = document.createDocumentFragment();

    for (const character of text) {
      const span = createElement("span", "pagetyper-char", character);
      fragment.appendChild(span);
    }

    container.replaceChildren(fragment);
  }

  function createStatItems() {
    return [
      ["Progress", "0%"],
      ["WPM", "0"],
      ["Accuracy", "100%"],
      ["Mistakes", "0"]
    ].map(([label, value]) => {
      const item = createElement("div", "pagetyper-stat");
      item.append(createElement("span", "", label), createElement("strong", "", value));
      return item;
    });
  }

  function updateStats() {
    if (!state) {
      return;
    }

    const stat = metrics.calculateStats({
      startedAt: state.startedAt || Date.now(),
      now: Date.now(),
      typedCount: state.typedCount,
      completedCount: state.index,
      mistakeCount: state.mistakeCount
    });
    state.progressValue.textContent = `${Math.round((state.index / state.text.length) * 100)}%`;
    state.wpmValue.textContent = String(stat.wpm);
    state.accuracyValue.textContent = `${stat.accuracy}%`;
    state.mistakesValue.textContent = String(state.mistakeCount);
  }

  function getTypingAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }

    if (!typingAudio || typingAudio.state === "closed") {
      typingAudio = new AudioContext();
    }

    if (typingAudio.state === "suspended") {
      typingAudio.resume().catch(() => {});
    }

    return typingAudio;
  }

  function playTone({ frequency, duration, type, peakVolume }) {
    const audio = getTypingAudio();
    if (!audio) {
      return;
    }

    const start = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakVolume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function playTypingSound(isMistake) {
    if (isMistake && cachedSettings.mistakeSoundEnabled) {
      playTone({ frequency: 185, duration: 0.07, type: "square", peakVolume: 0.035 });
      return;
    }

    if (!cachedSettings.keypressSoundEnabled) {
      return;
    }

    playTone({ frequency: 760, duration: 0.026, type: "triangle", peakVolume: 0.018 });
  }

  function playMilestoneSound() {
    if (!cachedSettings.soundEnabled) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
    gain.connect(audio.destination);

    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(audio.currentTime + index * 0.045);
      oscillator.stop(audio.currentTime + 0.24 + index * 0.045);
    });

    window.setTimeout(() => audio.close(), 520);
  }

  function showMilestoneToast(event) {
    if (cachedSettings.effectLevel === "off") {
      return;
    }

    const toast = createElement("div", "pagetyper-milestone-toast");
    const title = createElement("strong", "", `${event.count.toLocaleString()} correct chars`);
    const detail = createElement("span", "", `Streak ${event.streak}`);
    toast.append(title, detail);

    if (event.badges.length > 0) {
      toast.append(createElement("em", "", event.badges.map((badge) => badge.label).join(" · ")));
    }

    document.documentElement.append(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function showMilestoneBurst() {
    if (cachedSettings.effectLevel === "off") {
      return;
    }

    const burst = createElement("div", `pagetyper-burst is-${cachedSettings.effectLevel}`);
    const sparkCount = cachedSettings.effectLevel === "full" ? 24 : 10;

    for (let index = 0; index < sparkCount; index += 1) {
      const spark = createElement("span", "");
      spark.style.setProperty("--angle", `${(360 / sparkCount) * index}deg`);
      spark.style.setProperty("--distance", `${cachedSettings.effectLevel === "full" ? 86 : 48}px`);
      burst.appendChild(spark);
    }

    document.documentElement.append(burst);
    window.setTimeout(() => burst.remove(), 900);
  }

  function handleRewardProgress() {
    if (!state || state.correctCount <= state.rewardProgressIndex) {
      return;
    }

    const result = rewards.applyMilestoneProgress({
      previousIndex: state.rewardProgressIndex,
      currentIndex: state.correctCount,
      mistakeCount: state.mistakeCount,
      settings: cachedSettings,
      stats: cachedStats
    });

    state.rewardProgressIndex = state.correctCount;
    if (result.events.length === 0) {
      return;
    }

    cachedStats = result.stats;
    if (cachedSettings.statsEnabled) {
      writeStorage("local", rewards.STATS_KEY, cachedStats);
    }

    for (const event of result.events) {
      showMilestoneToast(event);
      showMilestoneBurst();
      playMilestoneSound();
    }
  }

  function setCurrentCharacter() {
    if (!state) {
      return;
    }

    state.characters.forEach((character) => character.classList.remove("is-current"));
    const current = state.characters[state.index];
    if (current) {
      current.classList.add("is-current");
      current.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  function markCharacter(index, className) {
    const character = state.characters[index];
    if (!character) {
      return;
    }

    character.classList.remove("is-current", "is-correct", "is-wrong");
    character.classList.add(className);
  }

  function handleTyping(event) {
    if (!state) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stop();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (state.index > 0) {
        state.index -= 1;
        if (state.characters[state.index].classList.contains("is-correct")) {
          state.correctCount = Math.max(0, state.correctCount - 1);
        }
        state.characters[state.index].classList.remove("is-correct", "is-wrong");
        setCurrentCharacter();
        updateStats();
      }
      return;
    }

    if (!metrics.isTypingKey(event) || state.index >= state.text.length) {
      return;
    }

    event.preventDefault();
    state.startedAt = state.startedAt || Date.now();
    state.typedCount += 1;

    const expected = state.text[state.index];
    const className = metrics.evaluateCharacter(expected, event.key) ? "is-correct" : "is-wrong";
    playTypingSound(className === "is-wrong");
    if (className === "is-wrong") {
      state.mistakeCount += 1;
    } else {
      state.correctCount += 1;
    }

    markCharacter(state.index, className);
    state.index += 1;
    setCurrentCharacter();
    updateStats();
    handleRewardProgress();
  }

  function handleShortcut(event) {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      state ? stop() : cachedSettings.defaultMode === "inline" ? startInlineMode() : startOverlayMode();
    }
  }

  function startOverlayMode() {
    if (state) {
      return { enabled: true, message: "Typing mode is already active." };
    }

    const article = extractArticle();
    if (article.text.length < MIN_ARTICLE_LENGTH) {
      return { enabled: false, message: "I could not find enough article text on this page." };
    }

    const root = createElement("section", "pagetyper-root");
    const panel = createElement("div", "pagetyper-panel");
    const header = createElement("header", "pagetyper-header");
    const title = createElement("div", "pagetyper-title");
    const titleText = createElement("strong", "", article.title);
    const subtitle = createElement("span", "", `${article.text.length.toLocaleString()} characters detected`);
    const closeButton = createElement("button", "pagetyper-close", "×");
    const stats = createElement("div", "pagetyper-stats");
    const text = createElement("div", "pagetyper-text");
    const footer = createElement("footer", "pagetyper-footer", "Type the highlighted text. Backspace rewinds one character. Esc closes.");

    text.tabIndex = 0;
    closeButton.type = "button";
    closeButton.addEventListener("click", stop);
    title.append(titleText, subtitle);
    header.append(title, closeButton);

    const statItems = createStatItems();
    stats.append(...statItems);
    renderCharacterSpans(text, article.text);
    panel.append(header, stats, text, footer);
    root.append(panel);
    document.documentElement.append(root);

    state = {
      mode: "overlay",
      root,
      text: article.text,
      index: 0,
      typedCount: 0,
      correctCount: 0,
      mistakeCount: 0,
      rewardProgressIndex: 0,
      startedAt: null,
      characters: Array.from(text.querySelectorAll(".pagetyper-char")),
      progressValue: statItems[0].querySelector("strong"),
      wpmValue: statItems[1].querySelector("strong"),
      accuracyValue: statItems[2].querySelector("strong"),
      mistakesValue: statItems[3].querySelector("strong")
    };

    document.addEventListener("keydown", handleTyping, true);
    setCurrentCharacter();
    text.focus();

    return { enabled: true, message: "Typing mode started." };
  }

  function renderInlineBlock(block, blockText, characters) {
    const fragment = document.createDocumentFragment();

    for (const character of blockText) {
      const span = createElement("span", "pagetyper-char pagetyper-inline-char", character);
      characters.push(span);
      fragment.appendChild(span);
    }

    block.replaceChildren(fragment);
  }

  function startInlineMode() {
    if (state) {
      return { enabled: true, message: "Typing mode is already active." };
    }

    const article = extractArticle();
    const usableBlocks = article.blockNodes
      .map((node) => ({ node, text: getText(node) }))
      .filter((block) => block.text.length >= 10);
    const text = usableBlocks.map((block) => block.text).join("");

    if (text.length < MIN_ARTICLE_LENGTH) {
      return { enabled: false, message: "I could not find enough article text on this page." };
    }

    const restoreBlocks = usableBlocks.map((block) => ({
      node: block.node,
      html: block.node.innerHTML
    }));
    const characters = [];

    for (const block of usableBlocks) {
      renderInlineBlock(block.node, block.text, characters);
    }

    const root = createElement("section", "pagetyper-inline-bar");
    const title = createElement("div", "pagetyper-inline-title");
    const stats = createElement("div", "pagetyper-inline-stats");
    const closeButton = createElement("button", "pagetyper-inline-close", "×");
    const statItems = createStatItems();

    title.append(
      createElement("strong", "", "PageTyper inline"),
      createElement("span", "", `${characters.length.toLocaleString()} characters`)
    );
    closeButton.type = "button";
    closeButton.addEventListener("click", stop);
    stats.append(...statItems);
    root.append(title, stats, closeButton);
    document.documentElement.append(root);

    state = {
      mode: "inline",
      root,
      restoreBlocks,
      text,
      index: 0,
      typedCount: 0,
      correctCount: 0,
      mistakeCount: 0,
      rewardProgressIndex: 0,
      startedAt: null,
      characters,
      progressValue: statItems[0].querySelector("strong"),
      wpmValue: statItems[1].querySelector("strong"),
      accuracyValue: statItems[2].querySelector("strong"),
      mistakesValue: statItems[3].querySelector("strong")
    };

    article.articleNode.classList.add("pagetyper-inline-active");
    document.addEventListener("keydown", handleTyping, true);
    setCurrentCharacter();

    return { enabled: true, message: "Inline typing mode started." };
  }

  function stop() {
    if (!state) {
      return { enabled: false, message: "Typing mode is already closed." };
    }

    document.removeEventListener("keydown", handleTyping, true);
    if (state.mode === "inline") {
      for (const block of state.restoreBlocks) {
        block.node.innerHTML = block.html;
      }
      document.querySelectorAll(".pagetyper-inline-active").forEach((node) => {
        node.classList.remove("pagetyper-inline-active");
      });
    }
    state.root.remove();
    state = null;
    return { enabled: false, message: "Typing mode stopped." };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PAGE_TYPER_STATUS") {
      sendResponse({ enabled: Boolean(state), mode: state ? state.mode : null, settings: cachedSettings });
      return;
    }

    if (message.type === "PAGE_TYPER_TOGGLE") {
      sendResponse(state ? stop() : cachedSettings.defaultMode === "inline" ? startInlineMode() : startOverlayMode());
      return;
    }

    if (message.type === "PAGE_TYPER_START") {
      sendResponse(message.mode === "inline" ? startInlineMode() : startOverlayMode());
      return;
    }

    if (message.type === "PAGE_TYPER_SETTINGS_UPDATED") {
      cachedSettings = rewards.normalizeSettings(message.settings);
      sendResponse({ ok: true });
    }
  });

  loadStoredState();
  document.addEventListener("keydown", handleShortcut, true);
})();
