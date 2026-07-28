if (!globalThis.__infoDigestXhsTrackerInstalled) {
globalThis.__infoDigestXhsTrackerInstalled = true;

const cleanText = (value, maxLength = 4000) =>
  (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

function currentContent() {
  const path = location.pathname;
  if (!/^\/(explore|discovery\/item)\//.test(path)) return null;
  const title = cleanText(
    document.querySelector('meta[property="og:title"]')?.content
      || document.querySelector('h1, [class*="title"], [class*="Title"]')?.textContent
      || document.title.replace(/\s*-\s*小红书\s*$/, ''),
    300,
  );
  if (title.length < 2) return null;
  const author = cleanText(document.querySelector(
    '.author-wrapper .name, .author .name, .user-name, [class*="author"] [class*="name"], [class*="Author"] [class*="Name"], [class*="user"] [class*="name"]'
  )?.textContent, 100);
  const contentCandidates = [
    document.querySelector('#detail-desc'),
    document.querySelector('[class*="note-text"]'),
    document.querySelector('[class*="desc"]'),
    document.querySelector('meta[property="og:description"]')?.content,
    document.querySelector('main'),
  ];
  const contentText = contentCandidates
    .map((candidate) => typeof candidate === 'string' ? candidate : candidate?.innerText || candidate?.textContent)
    .map((value) => cleanText(value, 4000))
    .find((value) => value.length > title.length + 20)
    || title;
  return {
    title,
    author,
    contentRaw: contentText,
    url: `${location.origin}${path}`.replace(/\/$/, ''),
    platform: 'XIAOHONGSHU',
  };
}

async function report(deltaSeconds, contentDurationSeconds = 0) {
  const content = currentContent();
  if (!content || deltaSeconds < 1) return;
  try {
    await chrome.runtime.sendMessage({
      type: 'RECORD_ENGAGEMENT',
      engagement: { ...content, deltaSeconds, contentDurationSeconds },
    });
  } catch { /* 后端未启动或扩展正在重载时等待下一次心跳 */ }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_CONTENT') sendResponse(currentContent());
});

let lastTick = Date.now();
let lastVideoTime = null;
let lastTrackedUrl = location.href;
setInterval(async () => {
  const { autoTracking } = await chrome.storage.local.get({ autoTracking: true });
  const now = Date.now();
  if (location.href !== lastTrackedUrl) {
    lastTrackedUrl = location.href;
    lastTick = now;
    lastVideoTime = null;
    return;
  }
  const elapsed = Math.min(5, Math.max(0, Math.floor((now - lastTick) / 1000)));
  lastTick = now;
  if (!autoTracking || document.visibilityState !== 'visible') {
    lastVideoTime = null;
    return;
  }
  const video = document.querySelector('video');
  if (video && !video.paused && Number.isFinite(video.duration) && video.duration > 0) {
    const currentTime = Math.floor(video.currentTime);
    const played = lastVideoTime === null
      ? elapsed
      : Math.min(5, Math.max(0, currentTime - lastVideoTime));
    lastVideoTime = currentTime;
    await report(played, Math.floor(video.duration));
  } else {
    lastVideoTime = null;
    await report(elapsed);
  }
}, 5000);
}
