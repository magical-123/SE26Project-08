function cleanText(value, maxLength = 4000) {
  return (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isMetadataTitle(value) {
  return /^(?:发布于|编辑于|[?？]{2,})\s*\d{4}(?:[-/.年]|\s)/.test(cleanText(value, 300));
}

function isUsableTitle(value) {
  const title = cleanText(value, 300);
  return title.length >= 4
    && !isMetadataTitle(title)
    && !/^(登录|注册|首页|发现|想法|盐选|搜索)$/.test(title);
}

function getCardTitle(card, link) {
  // “最近浏览”卡片里有指向内容的链接，但它的文本有时只是“发布于…”。
  // 优先使用卡片标题元素，并把链接文本仅作为兜底。
  const headingTitle = [...(card?.querySelectorAll(
    'h1, h2, h3, [class*="QuestionHeader-title"], [class*="ContentItem-title"], [class*="Title"]'
  ) || [])]
    .map((element) => cleanText(element.textContent, 300))
    .find(isUsableTitle);
  const linkTitle = cleanText(link.textContent, 300);
  return headingTitle || (isUsableTitle(linkTitle) ? linkTitle : '');
}

function getZhihuAuthor(container = document) {
  const dataZopElement = container.querySelector?.('[data-zop]');
  if (dataZopElement) {
    try {
      const data = JSON.parse(dataZopElement.getAttribute('data-zop') || '{}');
      const author = cleanText(data.authorName || data.author_name || data.author?.name, 100);
      if (author) return author;
    } catch { /* 继续使用 DOM 兜底 */ }
  }

  const selectors = [
    '.AuthorInfo-name .UserLink-link',
    '[class*="AuthorInfo-name"] a[href*="/people/"]',
    '.UserLink-link',
    '[data-za-detail-view-element_name="User"]',
    'a[href*="/people/"]',
    '[class*="author"]',
    '[class*="Author"]',
  ];
  for (const selector of selectors) {
    const author = cleanText(container.querySelector?.(selector)?.textContent, 100);
    if (author && !/^(关注|匿名用户|未知作者)$/.test(author)) return author;
  }
  return '';
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
    const title = getCardTitle(card, link);
    if (!isUsableTitle(title)) continue;

    const rawText = cleanText(card?.innerText || link.textContent);
    seen.add(url);
    items.push({
      title,
      url,
      platform: 'ZHIHU',
      author: getZhihuAuthor(card || document),
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
  const candidates = [
    document.querySelector('meta[property="og:title"]')?.content,
    document.querySelector('h1, [class*="QuestionHeader-title"], [class*="ContentItem-title"]')?.textContent,
    document.title.replace(/\s*-\s*知乎\s*$/, ''),
  ].map((value) => cleanText(value, 300));
  const title = candidates.find(isUsableTitle);
  if (!title) return null;
  const metaAuthor = cleanText(document.querySelector('meta[name="author"]')?.content, 100);
  const author = metaAuthor || getZhihuAuthor(document);
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
