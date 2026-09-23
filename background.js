const DAILY_LIMIT_SECONDS = 15 * 60;

function localDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getState() {
  const today = localDateKey();
  const stored = await chrome.storage.local.get(["dateKey", "usedSeconds", "locked"]);

  if (stored.dateKey !== today) {
    const fresh = { dateKey: today, usedSeconds: 0, locked: false };
    await chrome.storage.local.set(fresh);
    return fresh;
  }

  return {
    dateKey: stored.dateKey || today,
    usedSeconds: Number(stored.usedSeconds || 0),
    locked: Boolean(stored.locked)
  };
}

async function closeFacebookTab(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (e) {}
}

async function enforceOnTab(tabId, url) {
  if (!url || !/https?:\/\/([^/]+\.)?facebook\.com\//i.test(url)) return;
  const state = await getState();
  if (state.locked || state.usedSeconds >= DAILY_LIMIT_SECONDS) {
    await chrome.storage.local.set({ locked: true });
    await closeFacebookTab(tabId);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (message.type === "GET_STATUS") {
      sendResponse({
        ok: true,
        usedSeconds: state.usedSeconds,
        remainingSeconds: Math.max(0, DAILY_LIMIT_SECONDS - state.usedSeconds),
        locked: state.locked || state.usedSeconds >= DAILY_LIMIT_SECONDS,
        limitSeconds: DAILY_LIMIT_SECONDS
      });
      return;
    }

    if (!sender.tab || !sender.tab.id) {
      sendResponse({ ok: false });
      return;
    }

    const tabId = sender.tab.id;

    if (message.type === "CHECK_LIMIT") {
      const locked = state.locked || state.usedSeconds >= DAILY_LIMIT_SECONDS;
      if (locked) {
        await chrome.storage.local.set({ locked: true });
        sendResponse({ ok: true, locked: true, usedSeconds: state.usedSeconds });
        await closeFacebookTab(tabId);
      } else {
        sendResponse({
          ok: true,
          locked: false,
          usedSeconds: state.usedSeconds,
          remainingSeconds: DAILY_LIMIT_SECONDS - state.usedSeconds
        });
      }
      return;
    }

    if (message.type === "ADD_ACTIVE_TIME") {
      const add = Math.max(0, Math.min(3, Number(message.seconds || 0)));
      const usedSeconds = Math.min(DAILY_LIMIT_SECONDS, state.usedSeconds + add);
      const locked = usedSeconds >= DAILY_LIMIT_SECONDS;

      await chrome.storage.local.set({
        dateKey: localDateKey(),
        usedSeconds,
        locked
      });

      sendResponse({
        ok: true,
        usedSeconds,
        remainingSeconds: Math.max(0, DAILY_LIMIT_SECONDS - usedSeconds),
        locked
      });

      if (locked) {
        await closeFacebookTab(tabId);
      }
      return;
    }

    sendResponse({ ok: false });
  })();

  return true;
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await enforceOnTab(tabId, tab.url);
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    await enforceOnTab(tabId, changeInfo.url || tab.url);
  }
});
