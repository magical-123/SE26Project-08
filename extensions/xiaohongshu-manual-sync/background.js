const DEFAULT_API_BASE = 'http://127.0.0.1:8080';

async function settings() {
  const saved = await chrome.storage.local.get({ apiBase: DEFAULT_API_BASE, token: '' });
  return { apiBase: saved.apiBase.replace(/\/$/, ''), token: saved.token };
}

async function login({ apiBase, username, password }) {
  const base = apiBase.replace(/\/$/, '');
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('InfoDigest 用户名或密码错误');
  const data = await response.json();
  if (!data.token) throw new Error('登录响应中没有 Token');
  await chrome.storage.local.set({ apiBase: base, token: data.token });
  return { username: data.username || username };
}

async function extractFromCurrentTab(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const clean = (value, limit = 4000) => (value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
      const normalize = (href) => {
        try {
          const url = new URL(href, location.origin);
          if (!/^https:\/\/www\.xiaohongshu\.com\/(explore|discovery\/item)\//.test(url.href)) return null;
          url.search = '';
          url.hash = '';
          return url.href;
        } catch { return null; }
      };
      const seen = new Set();
      const items = [];
      for (const link of document.querySelectorAll('a[href]')) {
        const url = normalize(link.href);
        if (!url || seen.has(url)) continue;
        const card = link.closest('section, article, [class*="note"], [class*="feed"], [class*="card"]') || link.parentElement;
        const linkTitle = clean(link.textContent, 300);
        const titleEl = card?.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]');
        const title = linkTitle.length >= 2 ? linkTitle : clean(titleEl?.textContent, 300);
        if (!title || /^(首页|发现|登录|注册)$/.test(title)) continue;
        const authorEl = card?.querySelector('[class*="author"], [class*="user"], [class*="Author"], [class*="User"]');
        const text = clean(card?.innerText || link.textContent);
        seen.add(url);
        items.push({
          title, url, platform: 'XIAOHONGSHU', author: clean(authorEl?.textContent, 100),
          category: '深度知识', durationMinutes: Math.max(1, Math.ceil(text.length / 500)),
          contentRaw: text, processStatus: 'UNPROCESSED',
        });
        if (items.length >= 50) break;
      }
      return { items };
    },
  });
  return result?.result?.items || [];
}

async function sync() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://www.xiaohongshu.com/')) {
    throw new Error('请先打开小红书页面，再点击“同步当前小红书页面”');
  }
  const { apiBase, token } = await settings();
  if (!token) throw new Error('请先登录 InfoDigest');
  const items = await extractFromCurrentTab(tab.id);
  if (!items.length) throw new Error('当前页面没有识别到笔记；请等待内容加载或滚动后重试');
  const response = await fetch(`${apiBase}/api/inbox/items/batch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  const { apiBase, token } = await settings();
  if (!token) return { ignored: true, reason: 'not-logged-in' };
  const response = await fetch(`${apiBase}/api/inbox/items/engagement`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    if (message.type === 'SYNC') return sync();
    if (message.type === 'RECORD_ENGAGEMENT') return recordEngagement(message.engagement);
    if (message.type === 'STATUS') {
      const { apiBase, token } = await settings();
      return { apiBase, loggedIn: Boolean(token) };
    }
    throw new Error('未知扩展操作');
  })().then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
