chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-typing-mode") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PAGE_TYPER_TOGGLE" });
  } catch (error) {
    // Some Chrome pages and restricted frames cannot receive content-script messages.
  }
});
