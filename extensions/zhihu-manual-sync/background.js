const DEFAULT_API_BASE = 'http://127.0.0.1:8080';

async function getSettings() {
  const settings = await chrome.storage.local.get({ apiBase: DEFAULT_API_BASE, token: '' });
  return { apiBase: settings.apiBase.replace(/\/$/, ''), token: settings.token };
}

async function login({ apiBase, username, password }) {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('InfoDigest 用户名或密码错误');
  const payload = await response.json();
  if (!payload.token) throw new Error('登录响应中没有 Token');
  await chrome.storage.local.set({ apiBase: apiBase.replace(/\/$/, ''), token: payload.token });
  return { username: payload.username || username };
}

async function syncCurrentZhihuTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://www.zhihu.com/')) {
    throw new Error('请先打开一个知乎页面，再点击“同步当前页面”');
  }
  // 推荐流不做批量同步；仅在用户实际打开内容详情页时由 content.js
  // 按 10 秒心跳记录前台浏览时长并写入 Inbox。
  if (!/^https:\/\/www\.zhihu\.com\/(question\/\d+|p\/\d+|zvideo\/\d+|video\/\d+|pin\/\d+)/.test(tab.url)) {
    throw new Error('请打开一个知乎问题、文章或视频详情；推荐流不会被批量同步');
  }
  return { found: 0, inserted: 0, skipped: 0, trackingOnly: true };

  const { apiBase, token } = await getSettings();
  if (!token) throw new Error('请先登录 InfoDigest');

  // 扩展可能是在知乎页面已经打开后才安装，此时 content script 尚未注入。
  // 因此每次手动同步都在当前标签页执行一次只读提取，避免要求用户刷新页面。
  const [extraction] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const cleanText = (value, maxLength = 4000) => (value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
      const isMetadataTitle = (value) => /^(?:发布于|编辑于|[?？]{2,})\s*\d{4}(?:[-/.年]|\s)/.test(cleanText(value, 300));
      const isUsableTitle = (value) => {
        const title = cleanText(value, 300);
        return title.length >= 4
          && !isMetadataTitle(title)
          && !/^(登录|注册|首页|发现|想法|盐选|搜索)$/.test(title);
      };
      const getAuthor = (container) => {
        const dataZopElement = container?.querySelector?.('[data-zop]');
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
          const author = cleanText(container?.querySelector?.(selector)?.textContent, 100);
          if (author && !/^(关注|匿名用户|未知作者)$/.test(author)) return author;
        }
        return '';
      };
      const normalizeUrl = (href) => {
        try {
          const url = new URL(href, location.origin);
          if (!/^https:\/\/www\.zhihu\.com\/(question\/\d+|p\/\d+|zvideo\/\d+|video\/\d+|pin\/\d+)/.test(url.href)) return null;
          url.search = '';
          url.hash = '';
          return url.href;
        } catch { return null; }
      };
      const seen = new Set();
      const items = [];
      // 最近浏览页的内容链接不一定带 question/p 选择器；统一从全部链接中筛选真实内容 URL。
      for (const link of document.querySelectorAll('a[href]')) {
        const url = normalizeUrl(link.href);
        if (!url || seen.has(url)) continue;
        const card = link.closest('.TopstoryItem, .Card, article, [data-zop], [class*="Item"], [class*="item"]') || link.parentElement;
        const headingTitle = [...(card?.querySelectorAll(
          'h1, h2, h3, [class*="QuestionHeader-title"], [class*="ContentItem-title"], [class*="Title"]'
        ) || [])]
          .map((element) => cleanText(element.textContent, 300))
          .find(isUsableTitle);
        const linkTitle = cleanText(link.textContent, 300);
        const title = headingTitle || (isUsableTitle(linkTitle) ? linkTitle : '');
        if (!isUsableTitle(title)) continue;
        const rawText = cleanText(card?.innerText || link.textContent);
        seen.add(url);
        items.push({
          title, url, platform: 'ZHIHU', author: getAuthor(card || document),
          category: '深度知识', durationMinutes: Math.max(1, Math.ceil(rawText.length / 500)),
          contentRaw: rawText, processStatus: 'UNPROCESSED',
        });
        if (items.length >= 50) break;
      }
      return { items };
    },
  });
  const items = extraction?.result?.items || [];
  if (!items.length) throw new Error('当前页面没有识别到知乎问题或文章卡片；请滚动加载内容后重试');

  const response = await fetch(`${apiBase}/api/inbox/items/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(items),
  });
  if (response.status === 401 || response.status === 403) {
    await chrome.storage.local.remove('token');
    throw new Error('InfoDigest 登录已过期，请重新登录');
  }
  if (!response.ok) throw new Error(`同步失败：HTTP ${response.status}`);
  return { found: items.length, ...await response.json() };
}

async function recordEngagement(engagement) {
  const { apiBase, token } = await getSettings();
  if (!token) return { ignored: true, reason: 'not-logged-in' };
  const response = await fetch(`${apiBase}/api/inbox/items/engagement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(engagement),
  });
  if (response.status === 401 || response.status === 403) {
    await chrome.storage.local.remove('token');
    return { ignored: true, reason: 'token-expired' };
  }
  if (!response.ok) throw new Error(`时长上报失败：HTTP ${response.status}`);
  return response.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'LOGIN') return login(message);
    if (message.type === 'SYNC_CURRENT_ZHIHU') return syncCurrentZhihuTab();
    if (message.type === 'RECORD_ENGAGEMENT') return recordEngagement(message.engagement);
    if (message.type === 'GET_STATUS') {
      const { apiBase, token } = await getSettings();
      return { apiBase, loggedIn: Boolean(token) };
    }
    throw new Error('未知扩展操作');
  })().then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
