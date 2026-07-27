const DEFAULT_API_BASE = 'http://127.0.0.1:8080';

async function getSettings() {
  const saved = await chrome.storage.local.get({ apiBase: DEFAULT_API_BASE, token: '' });
  return { apiBase: saved.apiBase.replace(/\/$/, ''), token: saved.token };
}

async function login({ apiBase, username, password }) {
  const base = apiBase.replace(/\/$/, '');
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('InfoDigest 用户名或密码错误');
  const payload = await response.json();
  if (!payload.token) throw new Error('登录响应中没有 Token');
  await chrome.storage.local.set({ apiBase: base, token: payload.token });
  return { username: payload.username || username };
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
  if (!response.ok) throw new Error(`记录失败：HTTP ${response.status}`);
  return response.json();
}

async function getCurrentContent(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_CONTENT' });
  } catch (error) {
    if (!String(error?.message || error).includes('Receiving end does not exist')) throw error;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_CONTENT' });
  }
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://www.zhihu.com/')) {
    throw new Error('请先打开知乎内容详情页');
  }
  const content = await getCurrentContent(tab.id);
  if (!content) throw new Error('当前不是可记录的知乎问题、回答、文章或视频详情页');
  const result = await recordEngagement({ ...content, deltaSeconds: 1, contentDurationSeconds: 0 });
  if (result.ignored) {
    throw new Error(result.reason === 'token-expired' ? '登录已过期，请重新登录 InfoDigest' : '请先登录 InfoDigest');
  }
  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'LOGIN') return login(message);
    if (message.type === 'CAPTURE_CURRENT') return captureCurrentTab();
    if (message.type === 'RECORD_ENGAGEMENT') return recordEngagement(message.engagement);
    if (message.type === 'GET_STATUS') {
      const { apiBase, token } = await getSettings();
      return { apiBase, loggedIn: Boolean(token) };
    }
    throw new Error('未知扩展消息');
  })().then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
