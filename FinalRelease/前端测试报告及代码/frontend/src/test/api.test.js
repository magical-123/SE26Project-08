import apiFetch, {
  fetchData,
  inboxApi,
  graphApi,
  dashboardApi,
  wordCloudApi,
  settingsApi,
  crawlApi,
  aiConfigApi,
  authApi,
} from '../utils/api.js';

// =====================================================
// 全局 fetch mock — 每个测试前重新设置
// =====================================================

const createMockResponse = (overrides = {}) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ data: 'test' }),
  text: () => Promise.resolve(''),
  ...overrides,
});

const createFetchMock = (responseOverrides = {}) =>
  vi.fn().mockResolvedValue(createMockResponse(responseOverrides));

// 辅助：模拟 sessionStorage 中存有 token
function setToken(token = 'mock-jwt-token') {
  window.sessionStorage.setItem('token', token);
}

function clearToken() {
  window.sessionStorage.removeItem('token');
  window.sessionStorage.removeItem('username');
}

// 辅助：监听 auth:expired 事件
function listenAuthExpired() {
  const handler = vi.fn();
  window.addEventListener('auth:expired', handler);
  return handler;
}

describe('apiFetch — 核心请求封装', () => {
  beforeEach(() => {
    clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('成功 GET 请求返回 Response 对象', async () => {
    global.fetch = createFetchMock();
    const res = await apiFetch('/api/test');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toEqual({ data: 'test' });
  });

  test('自动注入 JWT Token（Authorization header）', async () => {
    setToken('my-token');
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.headers['Authorization']).toBe('Bearer my-token');
      return Promise.resolve(createMockResponse());
    });
    await apiFetch('/api/test');
  });

  test('无 Token 时不添加 Authorization header', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.headers['Authorization']).toBeUndefined();
      return Promise.resolve(createMockResponse());
    });
    await apiFetch('/api/test');
  });

  test('始终添加 Content-Type: application/json', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.headers['Content-Type']).toBe('application/json');
      return Promise.resolve(createMockResponse());
    });
    await apiFetch('/api/test');
  });

  test('自定义 headers 会与默认 headers 合并', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-Custom']).toBe('custom-value');
      return Promise.resolve(createMockResponse());
    });
    await apiFetch('/api/test', { headers: { 'X-Custom': 'custom-value' } });
  });

  test('401 状态 → 清除 token 并触发 auth:expired 事件', async () => {
    setToken('expired-token');
    const handler = listenAuthExpired();
    global.fetch = createFetchMock({ ok: false, status: 401 });

    await expect(apiFetch('/api/test')).rejects.toThrow('Authentication required');
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('username')).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('403 状态 → 清除 token 并触发 auth:expired 事件', async () => {
    setToken('forbidden-token');
    const handler = listenAuthExpired();
    global.fetch = createFetchMock({ ok: false, status: 403 });

    await expect(apiFetch('/api/test')).rejects.toThrow('Authentication required');
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('401 静默模式 → 不触发 auth:expired、不清除 token', async () => {
    setToken('silent-token');
    const handler = listenAuthExpired();
    global.fetch = createFetchMock({ ok: false, status: 401 });

    await expect(apiFetch('/api/test', { silent: true })).rejects.toThrow(
      'Authentication required',
    );
    // 静默模式下不清除 token
    expect(window.sessionStorage.getItem('token')).toBe('silent-token');
    expect(handler).toHaveBeenCalledTimes(0);
  });

  test('403 静默模式 → 不触发 auth:expired', async () => {
    setToken('silent-token');
    const handler = listenAuthExpired();
    global.fetch = createFetchMock({ ok: false, status: 403 });

    await expect(apiFetch('/api/test', { silent: true })).rejects.toThrow(
      'Authentication required',
    );
    expect(handler).toHaveBeenCalledTimes(0);
  });

  test('请求超时（AbortError）→ 抛出友好提示', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(apiFetch('/api/test')).rejects.toThrow('请求超时，请稍后重试');
  });

  test('非 2xx 错误 → 抛出 API Error 并包含状态码', async () => {
    global.fetch = createFetchMock({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow(
      'API Error (500): Internal Server Error',
    );
  });

  test('非 2xx 且 text() 解析失败 → 降级为 Unknown error', async () => {
    global.fetch = createFetchMock({
      ok: false,
      status: 502,
      text: () => Promise.reject(new Error('stream error')),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('API Error (502): Unknown error');
  });

  test('网络错误（非 AbortError）→ 原样抛出', async () => {
    const netError = new TypeError('Failed to fetch');
    global.fetch = vi.fn().mockRejectedValue(netError);

    await expect(apiFetch('/api/test')).rejects.toThrow('Failed to fetch');
  });

  test('自定义 timeout 参数传递给 fetchWithTimeout', async () => {
    global.fetch = createFetchMock();
    // 超时时间不会影响 mock，只验证不会报错即可
    const res = await apiFetch('/api/test', { timeout: 1000 });
    expect(res.ok).toBe(true);
  });
});

describe('fetchData — 带超时的快速数据获取', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('正常返回数据', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ items: [1, 2, 3] }),
    });
    const res = await fetchData('/api/data');
    const data = await res.json();
    expect(data).toEqual({ items: [1, 2, 3] });
  });

  test('超时时抛出 AbortError', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(fetchData('/api/data')).rejects.toThrow('The operation was aborted');
  });
});

describe('inboxApi — 信息项 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getItems', () => {
    test('默认分页参数 page=0 & size=100', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('page=0');
        expect(url).toContain('size=100');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems();
    });

    test('自定义分页参数', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('page=2');
        expect(url).toContain('size=20');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems(2, 20);
    });

    test('platform 筛选参数', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('platform=bilibili');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems(0, 100, { platform: 'bilibili' });
    });

    test('platform 含特殊字符时正确编码', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('platform=zhihu%2Btest');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems(0, 100, { platform: 'zhihu+test' });
    });

    test('premium 筛选参数', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('premium=true');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems(0, 100, { premium: true });
    });

    test('同时使用 platform + premium 筛选', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        expect(url).toContain('page=1');
        expect(url).toContain('size=50');
        expect(url).toContain('platform=weibo');
        expect(url).toContain('premium=true');
        return Promise.resolve(
          createMockResponse({ json: () => Promise.resolve({ items: [] }) }),
        );
      });
      await inboxApi.getItems(1, 50, { platform: 'weibo', premium: true });
    });

    test('silent 模式透传给 apiFetch', async () => {
      // 返回 401 验证 silent 被传递
      global.fetch = createFetchMock({ ok: false, status: 401 });
      // 非静默模式应当触发事件
      const handler = listenAuthExpired();
      await expect(inboxApi.getItems(0, 100, { silent: true })).rejects.toThrow(
        'Authentication required',
      );
      expect(handler).toHaveBeenCalledTimes(0);
    });

    test('返回 JSON 数据', async () => {
      global.fetch = createFetchMock({
        json: () => Promise.resolve({ items: [{ id: 1 }], total: 1 }),
      });
      const data = await inboxApi.getItems();
      expect(data).toEqual({ items: [{ id: 1 }], total: 1 });
    });
  });

  test('getItem — 获取单个信息项', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ id: 42, title: 'Test' }),
    });
    const data = await inboxApi.getItem(42);
    expect(data).toEqual({ id: 42, title: 'Test' });
  });

  test('createItem — POST 创建信息项', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ title: 'New', url: 'http://x.com' }));
      return Promise.resolve(
        createMockResponse({ json: () => Promise.resolve({ id: 1, title: 'New' }) }),
      );
    });
    const data = await inboxApi.createItem({ title: 'New', url: 'http://x.com' });
    expect(data).toEqual({ id: 1, title: 'New' });
  });

  test('updateItem — PUT 更新信息项', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify({ title: 'Updated' }));
      return Promise.resolve(
        createMockResponse({ json: () => Promise.resolve({ id: 5, title: 'Updated' }) }),
      );
    });
    const data = await inboxApi.updateItem(5, { title: 'Updated' });
    expect(data).toEqual({ id: 5, title: 'Updated' });
  });

  test('deleteItem — DELETE 删除信息项', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('DELETE');
      return Promise.resolve(createMockResponse({ json: () => Promise.resolve({}) }));
    });
    // deleteItem 不返回内容
    await expect(inboxApi.deleteItem(10)).resolves.toBeUndefined();
  });

  test('toggleLike — POST 切换点赞', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('/like');
      return Promise.resolve(
        createMockResponse({ json: () => Promise.resolve({ liked: true }) }),
      );
    });
    const data = await inboxApi.toggleLike(3);
    expect(data).toEqual({ liked: true });
  });

  test('toggleFavorite — POST 切换收藏', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('/favorite');
      return Promise.resolve(
        createMockResponse({ json: () => Promise.resolve({ favorited: true }) }),
      );
    });
    const data = await inboxApi.toggleFavorite(7);
    expect(data).toEqual({ favorited: true });
  });

  test('regenerateSummary — POST 重新生成摘要', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('/regenerate-summary');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ summary: 'New summary text' }),
        }),
      );
    });
    const data = await inboxApi.regenerateSummary(2);
    expect(data).toEqual({ summary: 'New summary text' });
  });
});

describe('graphApi — 知识图谱 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getItemKeywords — GET 获取关键字', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ keywords: ['AI', 'ML'] }),
    });
    const data = await graphApi.getItemKeywords(10);
    expect(data).toEqual({ keywords: ['AI', 'ML'] });
  });

  test('updateItemKeywords — PUT 更新关键字', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify(['AI', 'NLP']));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ keywords: ['AI', 'NLP'] }),
        }),
      );
    });
    const data = await graphApi.updateItemKeywords(10, ['AI', 'NLP']);
    expect(data).toEqual({ keywords: ['AI', 'NLP'] });
  });

  test('toggleItemKeyword — PUT 切换关键字高亮', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify({ label: 'AI' }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ label: 'AI', highlighted: true }),
        }),
      );
    });
    const data = await graphApi.toggleItemKeyword(10, 'AI');
    expect(data).toEqual({ label: 'AI', highlighted: true });
  });

  test('analyzeKeywords — POST AI 同步推荐关键词', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ note: 'tech' }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ keywords: ['AI', 'Blockchain'] }),
        }),
      );
    });
    const data = await graphApi.analyzeKeywords(10, 'tech');
    expect(data).toEqual({ keywords: ['AI', 'Blockchain'] });
  });

  test('deleteKeyword — DELETE 删除关键字', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('DELETE');
      expect(url).toContain(encodeURIComponent('AI'));
      return Promise.resolve(createMockResponse({ json: () => Promise.resolve({}) }));
    });
    await expect(graphApi.deleteKeyword('AI')).resolves.toBeUndefined();
  });

  test('deleteKeyword 对含特殊字符的 label 编码', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      expect(url).toContain(encodeURIComponent('C++'));
      expect(url).not.toContain('C++');
      return Promise.resolve(createMockResponse({ json: () => Promise.resolve({}) }));
    });
    await graphApi.deleteKeyword('C++');
  });
});

describe('dashboardApi — 报表 / Dashboard API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getReport — 获取报表数据', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      expect(url).toContain('date=2026-07-30');
      expect(url).toContain('type=weekly');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ clicks: 100, views: 500 }),
        }),
      );
    });
    const data = await dashboardApi.getReport('2026-07-30', 'weekly');
    expect(data).toEqual({ clicks: 100, views: 500 });
  });

  test('getTodayReviews — 获取今日复习卡片', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ reviews: [{ id: 1 }, { id: 2 }] }),
    });
    const data = await dashboardApi.getTodayReviews();
    expect(data).toEqual({ reviews: [{ id: 1 }, { id: 2 }] });
  });
});

describe('wordCloudApi — 词云 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('generate — POST 生成词云', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('userId=u1');
      expect(url).toContain('date=2026-07-30');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ words: [{ text: 'AI', value: 10 }] }),
        }),
      );
    });
    const data = await wordCloudApi.generate('u1', '2026-07-30');
    expect(data).toEqual({ words: [{ text: 'AI', value: 10 }] });
  });

  test('getDaily — 获取每日词云', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      expect(url).toContain('userId=u1');
      expect(url).toContain('date=2026-07-30');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ words: [] }),
        }),
      );
    });
    const data = await wordCloudApi.getDaily('u1', '2026-07-30');
    expect(data).toEqual({ words: [] });
  });

  test('getWeekly — 获取最近 7 天词云', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      expect(url).toContain('userId=u1');
      expect(url).toContain('endDate=2026-07-30');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ words: [] }),
        }),
      );
    });
    const data = await wordCloudApi.getWeekly('u1', '2026-07-30');
    expect(data).toEqual({ words: [] });
  });
});

describe('settingsApi — 设置 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPrivacy', () => {
    test('defaultVisibility === PUBLIC 时返回 publicGraph: true', async () => {
      global.fetch = createFetchMock({
        json: () => Promise.resolve({ defaultVisibility: 'PUBLIC' }),
      });
      const data = await settingsApi.getPrivacy();
      expect(data).toEqual({ publicGraph: true });
    });

    test('defaultVisibility !== PUBLIC 时返回 publicGraph: false', async () => {
      global.fetch = createFetchMock({
        json: () => Promise.resolve({ defaultVisibility: 'PRIVATE' }),
      });
      const data = await settingsApi.getPrivacy();
      expect(data).toEqual({ publicGraph: false });
    });

    test('defaultVisibility 为 undefined 时返回 publicGraph: false', async () => {
      global.fetch = createFetchMock({
        json: () => Promise.resolve({}),
      });
      const data = await settingsApi.getPrivacy();
      expect(data).toEqual({ publicGraph: false });
    });
  });

  test('updatePrivacy — PUT 更新隐私设置', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify({ publicGraph: true }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ publicGraph: true }),
        }),
      );
    });
    const data = await settingsApi.updatePrivacy(true);
    expect(data).toEqual({ publicGraph: true });
  });

  test('getPlatforms — 获取平台连接状态', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ platforms: ['bilibili'] }),
    });
    const data = await settingsApi.getPlatforms();
    expect(data).toEqual({ platforms: ['bilibili'] });
  });

  test('saveCredential — POST 保存平台凭证', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('/platforms/bilibili/credential');
      expect(options.body).toBe(JSON.stringify({ credential: 'token-abc' }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ success: true }),
        }),
      );
    });
    const data = await settingsApi.saveCredential('bilibili', 'token-abc');
    expect(data).toEqual({ success: true });
  });

  test('deleteCredential — DELETE 删除平台凭证', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('DELETE');
      expect(url).toContain('/platforms/zhihu');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ success: true }),
        }),
      );
    });
    const data = await settingsApi.deleteCredential('zhihu');
    expect(data).toEqual({ success: true });
  });

  test('clearCredentialOnly — DELETE 清除旧凭证', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('DELETE');
      expect(url).toContain('/credential-only');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ success: true }),
        }),
      );
    });
    const data = await settingsApi.clearCredentialOnly('weibo');
    expect(data).toEqual({ success: true });
  });

  test('getBilibiliQrcode — 获取 B 站扫码二维码', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ qrcodeUrl: 'https://bilibili.com/qr' }),
    });
    const data = await settingsApi.getBilibiliQrcode();
    expect(data).toEqual({ qrcodeUrl: 'https://bilibili.com/qr' });
  });

  test('pollBilibiliQrcode — 轮询 B 站扫码状态', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ status: 'scanned' }),
    });
    const data = await settingsApi.pollBilibiliQrcode('key123');
    expect(data).toEqual({ status: 'scanned' });
  });

  test('getZhihuQrcode — 获取知乎扫码二维码', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ qrcodeUrl: 'https://zhihu.com/qr' }),
    });
    const data = await settingsApi.getZhihuQrcode();
    expect(data).toEqual({ qrcodeUrl: 'https://zhihu.com/qr' });
  });

  test('pollZhihuQrcode — 轮询知乎扫码状态', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ status: 'confirmed' }),
    });
    const data = await settingsApi.pollZhihuQrcode('qr-key-456');
    expect(data).toEqual({ status: 'confirmed' });
  });
});

describe('crawlApi — 爬虫 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('trigger — POST 触发爬虫抓取', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(url).toContain('platform=bilibili');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ taskId: 't-1' }),
        }),
      );
    });
    const data = await crawlApi.trigger('bilibili');
    expect(data).toEqual({ taskId: 't-1' });
  });
});

describe('aiConfigApi — AI 配置 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getConfig — GET 获取 AI 配置', async () => {
    global.fetch = createFetchMock({
      json: () => Promise.resolve({ model: 'gpt-4', provider: 'openai' }),
    });
    const data = await aiConfigApi.getConfig();
    expect(data).toEqual({ model: 'gpt-4', provider: 'openai' });
  });

  test('saveConfig — POST 保存 AI 配置', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ model: 'gpt-4' }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ success: true }),
        }),
      );
    });
    const data = await aiConfigApi.saveConfig({ model: 'gpt-4' });
    expect(data).toEqual({ success: true });
  });

  test('testConfig — POST 测试 AI 配置连通性', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ apiKey: 'sk-xxx' }));
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ reachable: true }),
        }),
      );
    });
    const data = await aiConfigApi.testConfig({ apiKey: 'sk-xxx' });
    expect(data).toEqual({ reachable: true });
  });

  test('deleteConfig — DELETE 删除 AI 配置', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      expect(options.method).toBe('DELETE');
      return Promise.resolve(
        createMockResponse({
          json: () => Promise.resolve({ success: true }),
        }),
      );
    });
    const data = await aiConfigApi.deleteConfig();
    expect(data).toEqual({ success: true });
  });
});

describe('authApi — 认证 API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    test('登录成功返回用户数据', async () => {
      global.fetch = vi.fn().mockImplementation((url, options) => {
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(options.body).toBe(
          JSON.stringify({ username: 'alice', password: 'pass123' }),
        );
        return Promise.resolve(
          createMockResponse({
            ok: true,
            json: () => Promise.resolve({ token: 'jwt-new', username: 'alice' }),
          }),
        );
      });
      const data = await authApi.login('alice', 'pass123');
      expect(data).toEqual({ token: 'jwt-new', username: 'alice' });
    });

    test('登录失败抛出 Invalid username or password', async () => {
      global.fetch = createFetchMock({ ok: false, status: 401 });
      await expect(authApi.login('alice', 'wrong')).rejects.toThrow(
        'Invalid username or password',
      );
    });
  });

  describe('register', () => {
    test('注册成功返回用户数据', async () => {
      global.fetch = vi.fn().mockImplementation((url, options) => {
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(options.body).toBe(
          JSON.stringify({
            username: 'bob',
            email: 'bob@test.com',
            password: 'pass456',
          }),
        );
        return Promise.resolve(
          createMockResponse({
            ok: true,
            json: () => Promise.resolve({ id: 2, username: 'bob' }),
          }),
        );
      });
      const data = await authApi.register('bob', 'bob@test.com', 'pass456');
      expect(data).toEqual({ id: 2, username: 'bob' });
    });

    test('注册失败 throw 后端返回的 message', async () => {
      global.fetch = createFetchMock({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Username already taken' }),
      });
      await expect(authApi.register('bob', 'bob@test.com', 'pass456')).rejects.toThrow(
        'Username already taken',
      );
    });

    test('注册失败且后端无 message → 降级为 Registration failed', async () => {
      global.fetch = createFetchMock({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });
      await expect(authApi.register('bob', 'bob@test.com', 'pass456')).rejects.toThrow(
        'Registration failed',
      );
    });

    test('注册失败后端返回空 JSON → 降级为 Registration failed', async () => {
      global.fetch = createFetchMock({
        ok: false,
        status: 400,
        json: () => Promise.resolve({}),
      });
      await expect(authApi.register('bob', 'bob@test.com', 'pass456')).rejects.toThrow(
        'Registration failed',
      );
    });
  });
});
