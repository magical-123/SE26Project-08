/**
 * InfoDigest 前端 API 工具模块
 * 
 * 支持所有后端 API 的认证请求封装，包括：
 * - 自动注入 JWT Token
 * - Token 过期自动重定向
 * - 统一错误处理
 */

const API_BASE = 'http://localhost:8080';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

/**
 * 带超时的 fetch 封装
 */
function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

/**
 * 发起认证 API 请求
 *
 * @param {string} path - API 路径，如 '/api/inbox/items'
 * @param {Object} options - fetch 选项
 * @param {number} timeout - 超时时间（毫秒），默认 30000
 * @returns {Promise<Response>}
 */
async function apiFetch(path, options = {}, timeout = 30000) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...options,
      headers,
    }, timeout);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw err;
  }

  // Token 过期或未授权 → 清空 token 并通过事件通知 React Router 跳转
  if (response.status === 401 || response.status === 403) {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('username');
    // 使用自定义事件通知 React，避免 window.location.href 硬刷新导致数据丢失
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Authentication required');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response;
}

// ===== Inbox API =====

export const inboxApi = {
  /** 获取当前用户的信息项（支持分页） */
  async getItems(page = 0, size = 10) {
    const res = await apiFetch(
      `/api/inbox/items?page=${page}&size=${size}`
    );
    return res.json();
  },

  /** 获取单个信息项 */
  async getItem(id) {
    const res = await apiFetch(`/api/inbox/items/${id}`);
    return res.json();
  },

  /** 创建信息项 */
  async createItem(item) {
    const res = await apiFetch('/api/inbox/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return res.json();
  },

  /** 更新信息项 */
  async updateItem(id, patch) {
    const res = await apiFetch(`/api/inbox/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return res.json();
  },

  /** 删除信息项 */
  async deleteItem(id) {
    await apiFetch(`/api/inbox/items/${id}`, {
      method: 'DELETE',
    });
  },
};

// ===== Dashboard / Report API =====

export const dashboardApi = {
  /** 获取报表数据 */
  async getReport(date, type) {
    const res = await apiFetch(
      `/api/dashboard/report?date=${date}&type=${type}`
    );
    return res.json();
  },

  /** 获取今日复习卡片 */
  async getTodayReviews() {
    const res = await apiFetch('/api/dashboard/reviews/today');
    return res.json();
  },
};

// ===== Word Cloud API =====

export const wordCloudApi = {
  /** 生成指定日期的词云数据 */
  async generate(userId, date) {
    const res = await apiFetch(
      `/api/wordcloud/generate?userId=${userId}&date=${date}`,
      { method: 'POST' }
    );
    return res.json();
  },

  /** 获取指定日期的词云数据 */
  async getDaily(userId, date) {
    const res = await apiFetch(
      `/api/wordcloud/daily?userId=${userId}&date=${date}`
    );
    return res.json();
  },

  /** 获取最近7天的词云数据 */
  async getWeekly(userId, endDate) {
    const res = await apiFetch(
      `/api/wordcloud/weekly?userId=${userId}&endDate=${endDate}`
    );
    return res.json();
  },
};

// ===== Settings API =====

export const settingsApi = {
  /** 获取当前用户各平台连接状态 */
  async getPlatforms() {
    const res = await apiFetch('/api/settings/platforms');
    return res.json();
  },

  /** 保存平台凭证 */
  async saveCredential(platform, credential) {
    const res = await apiFetch(`/api/settings/platforms/${platform}/credential`, {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    return res.json();
  },

  /** 删除平台凭证（断开连接） */
  async deleteCredential(platform) {
    const res = await apiFetch(`/api/settings/platforms/${platform}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  /** 切换娱乐信息隐藏开关 */
  async toggleEntertainmentHide() {
    const res = await apiFetch('/api/settings/toggle-entertainment-hide', {
      method: 'POST',
    });
    return res.json();
  },

  /** 获取 B 站扫码登录二维码 */
  async getBilibiliQrcode() {
    const res = await apiFetch('/api/settings/bilibili/qrcode');
    return res.json();
  },

  /** 轮询 B 站扫码登录状态 */
  async pollBilibiliQrcode(oauthKey) {
    const res = await apiFetch(`/api/settings/bilibili/poll/${oauthKey}`);
    return res.json();
  },

  /** 获取知乎扫码登录二维码 */
  async getZhihuQrcode() {
    const res = await apiFetch('/api/settings/zhihu/qrcode');
    return res.json();
  },

  /** 轮询知乎扫码登录状态 */
  async pollZhihuQrcode(qrcodeKey) {
    const res = await apiFetch(`/api/settings/zhihu/poll/${qrcodeKey}`);
    return res.json();
  },
};

// ===== Crawl API =====

export const crawlApi = {
  /** 触发爬虫抓取指定平台 */
  async trigger(platform) {
    const res = await apiFetch(`/api/crawl/trigger?platform=${platform}`, {
      method: 'POST',
    });
    return res.json();
  },
};

// ===== 认证 API =====

export const authApi = {
  /** 登录 */
  async login(username, password) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid username or password');
    return res.json();
  },

  /** 注册 */
  async register(username, email, password) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Registration failed');
    }
    return res.json();
  },
};

export default apiFetch;
