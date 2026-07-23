// 自动时长记录：仅笔记详情页、仅前台标签页，每 10 秒最多上报一次。
let lastTick = Date.now();
let lastVideoTime = null;

const clean = (value, limit = 4000) => (value || '').replace(/\s+/g, ' ').trim().slice(0, limit);

function currentContent() {
  if (!/^\/(explore|discovery\/item)\//.test(location.pathname)) return null;
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  const pageTitle = document.title.replace(/\s*-\s*小红书\s*$/, '');
  // 优先页面元标题，避免把笔记详情中的发布时间、互动数等元信息当成标题。
  const title = clean(ogTitle || pageTitle || document.querySelector('h1, [class*="title"], [class*="Title"]')?.textContent, 300);
  if (!title) return null;
  const author = clean(document.querySelector(
    '.author-wrapper .name, .author .name, .user-name, [class*="author"] [class*="name"], [class*="Author"] [class*="Name"], [class*="user"] [class*="name"]'
  )?.textContent, 100);
  const contentRaw = clean(document.querySelector('main')?.innerText || document.body?.innerText, 4000);
  return { title, author, contentRaw, url: location.href.split('?')[0].split('#')[0], platform: 'XIAOHONGSHU' };
}

async function report(deltaSeconds, contentDurationSeconds = 0) {
  const content = currentContent();
  if (!content || deltaSeconds < 1) return;
  try {
    await chrome.runtime.sendMessage({ type: 'RECORD_ENGAGEMENT', engagement: { ...content, deltaSeconds, contentDurationSeconds } });
  } catch { /* 后端未启动或扩展重新加载时静默跳过本周期 */ }
}

setInterval(async () => {
  const { autoTracking } = await chrome.storage.local.get({ autoTracking: true });
  const now = Date.now();
  const elapsed = Math.min(10, Math.floor((now - lastTick) / 1000));
  lastTick = now;
  if (!autoTracking || document.visibilityState !== 'visible') { lastVideoTime = null; return; }
  const video = document.querySelector('video');
  if (video && !video.paused && Number.isFinite(video.duration) && video.duration > 0) {
    const currentTime = Math.floor(video.currentTime);
    const played = lastVideoTime === null ? elapsed : Math.min(10, Math.max(0, currentTime - lastVideoTime));
    lastVideoTime = currentTime;
    await report(played, Math.floor(video.duration));
  } else {
    lastVideoTime = null;
    await report(elapsed);
  }
}, 10000);
