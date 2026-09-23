let lastTick = Date.now();
let sending = false;

function isActivelyViewed() {
  return document.visibilityState === "visible" && document.hasFocus();
}

async function checkLimit() {
  try {
    await chrome.runtime.sendMessage({ type: "CHECK_LIMIT" });
  } catch (e) {}
}

async function tick() {
  const now = Date.now();
  const elapsed = (now - lastTick) / 1000;
  lastTick = now;

  if (!isActivelyViewed() || sending) return;

  const seconds = Math.max(0, Math.min(2, elapsed));
  if (seconds < 0.2) return;

  sending = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "ADD_ACTIVE_TIME",
      seconds
    });

    if (result && result.locked) {
      clearInterval(timer);
    }
  } catch (e) {
  } finally {
    sending = false;
  }
}

checkLimit();

document.addEventListener("visibilitychange", () => {
  lastTick = Date.now();
  if (document.visibilityState === "visible") checkLimit();
});

window.addEventListener("focus", () => {
  lastTick = Date.now();
  checkLimit();
});

window.addEventListener("blur", () => {
  lastTick = Date.now();
});

const timer = setInterval(tick, 1000);
