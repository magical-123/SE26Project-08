const cleanText = (value, maxLength = 4000) =>
  (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

function getAuthor(container = document) {
  const dataZop = container.querySelector?.('[data-zop]') || container.closest?.('[data-zop]');
  if (dataZop) {
    try {
      const data = JSON.parse(dataZop.getAttribute('data-zop') || '{}');
      const author = cleanText(data.authorName || data.author_name || data.author?.name, 100);
      if (author) return author;
    } catch { /* 继续使用 DOM 选择器 */ }
  }
  const selectors = [
    '.AuthorInfo-name .UserLink-link',
    '[class*="AuthorInfo-name"] a[href*="/people/"]',
    '.UserLink-link',
    '[data-za-detail-view-element_name="User"]',
    'a[href*="/people/"]',
  ];
  for (const selector of selectors) {
    const author = cleanText(container.querySelector?.(selector)?.textContent, 100);
    if (author) return author;
  }
  return '';
}

function currentContent() {
  const path = location.pathname;
  if (!/^\/(question\/\d+(?:\/answer\/\d+)?|p\/\d+|zvideo\/\d+|video\/\d+|pin\/\d+)/.test(path)) {
    return null;
  }
  const title = cleanText(
    document.querySelector('meta[property="og:title"]')?.content
      || document.querySelector('h1, .QuestionHeader-title, [class*="ContentItem-title"]')?.textContent
      || document.title.replace(/\s*-\s*知乎\s*$/, ''),
    300,
  );
  if (title.length < 2) return null;

  const answerMatch = path.match(/\/answer\/(\d+)/);
  const answerContainer = answerMatch
    ? [...document.querySelectorAll('.AnswerItem, [data-zop]')].find((element) =>
        (element.getAttribute('name') || '').includes(answerMatch[1])
        || (element.getAttribute('data-zop') || '').includes(answerMatch[1]))
    : null;
  const contentContainer = answerContainer || document.querySelector('main') || document.body;
  const author = cleanText(document.querySelector('meta[name="author"]')?.content, 100)
    || getAuthor(contentContainer);
  const contentRaw = cleanText(contentContainer.innerText, 4000);
  return {
    title,
    author,
    contentRaw,
    url: `${location.origin}${path}`.replace(/\/$/, ''),
    platform: 'ZHIHU',
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
setInterval(async () => {
  const { autoTracking } = await chrome.storage.local.get({ autoTracking: true });
  const now = Date.now();
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
