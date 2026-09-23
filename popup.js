function formatTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function update() {
  try {
    const s = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (!s || !s.ok) return;

    document.getElementById("remaining").textContent = formatTime(s.remainingSeconds);
    document.getElementById("used").textContent = `Used today: ${formatTime(s.usedSeconds)}`;

    const percent = Math.min(100, (s.usedSeconds / s.limitSeconds) * 100);
    document.getElementById("fill").style.width = `${percent}%`;

    document.getElementById("locked").textContent =
      s.locked ? "Facebook is locked until tomorrow." : "";
  } catch (e) {}
}

update();
setInterval(update, 1000);
