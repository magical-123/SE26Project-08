function cleanText(value, maxLength = 4000) {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeUrl(href) {
  try {
    const url = new URL(href, location.origin);
    if (!/^https:\/\/www\.zhihu\.com\/(question\/\d+|p\/\d+|zvideo\/\d+|video\/\d+|pin\/\d+)/.test(url.href)) return null;
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function extractItems() {
  const seen = new Set();
  const items = [];
  const links = document.querySelectorAll('a[href]');
  for (const link of links) {
    const url = normalizeUrl(link.href);
    if (!url || seen.has(url)) continue;

    const card = link.closest('.TopstoryItem, .Card, article, [data-zop], [class*="Item"], [class*="item"]') || link.parentElement;
    const linkTitle = cleanText(link.textContent, 300);
    const titleEl = card?.querySelector('h1, h2, h3, [class*="Title"]');
    const title = linkTitle.length >= 4 ? linkTitle : cleanText(titleEl?.textContent, 300);
    if (title.length < 4 || /^(登录|注册|首页|发现|想法|盐选|搜索)$/.test(title)) continue;

    const authorEl = card?.querySelector('[class*="Author"], [class*="author"], [class*="UserLink"]');
    const rawText = cleanText(card?.innerText || link.textContent);
    seen.add(url);
    items.push({
      title,
      url,
      platform: 'ZHIHU',
      author: cleanText(authorEl?.textContent, 100),
      category: '深度知识',
      durationMinutes: Math.max(1, Math.ceil(rawText.length / 500)),
      contentRaw: rawText,
      processStatus: 'UNPROCESSED',
    });
    if (items.length >= 50) break;
  }
  return items;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_ZHIHU_ITEMS') sendResponse({ items: extractItems() });
});

// 自动时长记录：仅内容详情页、仅前台标签页，每 10 秒最多上报一次。
let lastTick = Date.now();
let lastVideoTime = null;

function currentContent() {
  const match = location.pathname.match(/^\/(question\/\d+|p\/\d+|zvideo\/\d+|video\/\d+|pin\/\d+)/);
  if (!match) return null;
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  const pageTitle = document.title.replace(/\s*-\s*知乎\s*$/, '');
  // 不直接取 h2：知乎回答页的第一个 h2 可能是“发布于……”等元信息。
  const title = cleanText(ogTitle || pageTitle || document.querySelector('h1, [class*="QuestionHeader-title"]')?.textContent, 300);
  if (!title) return null;
  const author = cleanText(document.querySelector('[class*="Author"], [class*="author"], [class*="UserLink"]')?.textContent, 100);
  const contentRaw = cleanText(document.querySelector('main')?.innerText || document.body?.innerText, 4000);
  return { title, author, contentRaw, url: location.href.split('?')[0].split('#')[0], platform: 'ZHIHU' };
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
