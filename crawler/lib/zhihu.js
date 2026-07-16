/**
 * 知乎 API 封装（Playwright 版）
 *
 * 使用 Playwright 浏览器环境调用知乎 API，自动处理 x-zse-96 签名。
 */
const { chromium } = require('playwright');

let browser = null;
let context = null;
let page = null;

/**
 * 初始化/复用浏览器（只启动一次）
 */
async function getPage() {
  if (page && !page.isClosed()) return page;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  page = await context.newPage();
  return page;
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  try { if (page) await page.close(); } catch {}
  try { if (context) await context.close(); } catch {}
  try { if (browser) await browser.close(); } catch {}
  page = null;
  context = null;
  browser = null;
}

/**
 * 设置 Cookie 并验证
 */
async function loginWithCookie(cookie) {
  const p = await getPage();

  // 先导航到知乎，确保域名为 .zhihu.com
  console.log('    打开知乎首页...');
  await p.goto('https://www.zhihu.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1000);

  // 再设置 cookie
  if (cookie && cookie.trim()) {
    const cookiePairs = cookie.split(';').map(c => c.trim()).filter(Boolean);
    const cookies = cookiePairs.map(pair => {
      const idx = pair.indexOf('=');
      if (idx === -1) return null;
      return {
        name: pair.substring(0, idx).trim(),
        value: pair.substring(idx + 1).trim(),
        domain: '.zhihu.com',
        path: '/',
      };
    }).filter(Boolean);
    console.log(`    设置 ${cookies.length} 个 cookie: ${cookies.map(c => c.name).join(', ')}`);
    await context.addCookies(cookies);
  }

  // 刷新页面让 cookie 生效
  await p.goto('https://www.zhihu.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(2000);

  // 多种方式检测登录状态
  const isLoggedIn = await p.evaluate(() => {
    const hasZC0 = document.cookie.includes('z_c0');
    const hasDC0 = document.cookie.includes('d_c0');
    const hasSession = document.cookie.includes('SESSIONID');
    const bodyText = document.body ? document.body.innerText.substring(0, 500) : '';
    const hasLoginBtn = bodyText.includes('登录') && bodyText.includes('注册');
    return (hasZC0 || hasDC0 || hasSession) && !hasLoginBtn;
  });

  if (!isLoggedIn) {
    const storedCookies = await context.cookies();
    const hasKeyCookie = storedCookies.some(c => c.name === 'z_c0' || c.name === 'd_c0' || c.name === 'SESSIONID');
    console.log(`    key cookie stored: ${hasKeyCookie}, count: ${storedCookies.length}`);
    if (!hasKeyCookie) {
      console.log('    ✗ Cookie 中不含登录凭证（需要 z_c0 / d_c0 / SESSIONID）');
      return false;
    }
    console.log('    ⚠ Cookie 含登录凭证但页面检测未完全通过，尝试继续...');
  }

  console.log('    ✓ Cookie 有效，已登录');
  return true;
}

/**
 * 通过 page.evaluate fetch 知乎 API（自动带上浏览器签名）
 */
async function zhihuFetch(p, url, options = {}) {
  const result = await p.evaluate(async ({ url, options }) => {
    try {
      const r = await fetch(url, { credentials: 'include', ...options });
      const text = await r.text();
      return { ok: r.ok, status: r.status, text };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, { url, options });
  return result;
}

// ===== 公共 API =====

/**
 * 校验 Cookie
 */
async function validateCookie() {
  // 登录已在 loginWithCookie 中完成
  return true;
}

/**
 * 获取推荐内容
 */
async function fetchRecommendations(clientDummy, options = {}) {
  const { limit = 10, offset = 0 } = options;
  const p = await getPage();

  const result = await zhihuFetch(p, 'https://www.zhihu.com/api/v3/feed/topstory/recommend', {
    headers: {
      'x-api-version': '3.0.40',
      'x-requested-with': 'fetch',
    },
  });

  if (!result.ok) {
    console.log(`    推荐接口 HTTP ${result.status}: ${result.text?.substring(0, 200)}`);
    return { items: [], hasMore: false };
  }

  try {
    const data = JSON.parse(result.text);
    const items = extractRecommendItems(data);
    console.log(`    ✓ 推荐接口返回 ${items.length} 条`);
    return { items, hasMore: false };
  } catch (e) {
    console.log(`    推荐数据解析失败: ${e.message}`);
    return { items: [], hasMore: false };
  }
}

/**
 * 获取历史浏览记录
 */
async function fetchHistory(clientDummy, options = {}) {
  const { limit = 10, offset = 0 } = options;
  const p = await getPage();

  const result = await zhihuFetch(p, `https://www.zhihu.com/api/v3/feed/topstory/history?limit=${limit}&offset=${offset}`, {
    headers: {
      'x-api-version': '3.0.40',
      'x-requested-with': 'fetch',
    },
  });

  if (!result.ok) {
    console.log(`    历史接口 HTTP ${result.status}`);
    return { items: [], hasMore: false };
  }

  try {
    const data = JSON.parse(result.text);
    const items = extractHistoryItems(data);
    console.log(`    ✓ 历史接口返回 ${items.length} 条`);
    return { items, hasMore: false };
  } catch (e) {
    console.log(`    历史数据解析失败: ${e.message}`);
    return { items: [], hasMore: false };
  }
}

/**
 * 获取收藏夹内容（配合 fetchCollectionsByIds）
 */
async function fetchCollections(clientDummy, options = {}) {
  const { limit = 10, offset = 0 } = options;
  const p = await getPage();

  // 先获取收藏夹列表
  const favResult = await zhihuFetch(p, `https://www.zhihu.com/api/v4/members/unlimited/collections?limit=5&offset=0`, {
    headers: {
      'x-api-version': '3.0.40',
      'x-requested-with': 'fetch',
    },
  });

  const allItems = [];

  if (favResult.ok) {
    try {
      const favData = JSON.parse(favResult.text);
      const favList = favData.data || [];

      // 获取每个收藏夹的内容
      for (const fav of favList.slice(0, 3)) {
        const collId = fav.id || fav.content?.id;
        if (!collId) continue;

        const contentResult = await zhihuFetch(p, `https://www.zhihu.com/api/v4/favlists/${collId}/contents?limit=5&offset=0`, {
          headers: {
            'x-api-version': '3.0.40',
            'x-requested-with': 'fetch',
          },
        });

        if (contentResult.ok) {
          try {
            const contentData = JSON.parse(contentResult.text);
            const contentItems = (contentData.data || []).map(ci => {
              const c = ci.content || ci;
              return {
                title: c.title || c.question?.title || '无标题',
                url: c.url || `https://www.zhihu.com/question/${c.question?.id}/answer/${c.id}`,
                excerpt: c.excerpt || '',
              };
            });
            allItems.push(...contentItems);
          } catch {}
        }
      }
    } catch (e) {
      console.log(`    收藏夹解析失败: ${e.message}`);
    }
  }

  console.log(`    ✓ 收藏夹返回 ${allItems.length} 条`);
  return { items: allItems.slice(0, limit), hasMore: false };
}

/**
 * 获取回答/文章全文
 */
async function fetchContentDetail(clientDummy, item) {
  try {
    const url = item.url;
    if (!url) return item.excerpt || '';

    const p = await getPage();

    // 提取内容 ID
    let apiUrl = '';
    if (url.includes('/answer/')) {
      const match = url.match(/answer\/(\d+)/);
      if (match) apiUrl = `https://www.zhihu.com/api/v4/answers/${match[1]}`;
    } else if (url.includes('/p/')) {
      const match = url.match(/\/p\/(\d+)/);
      if (match) apiUrl = `https://www.zhihu.com/api/v4/articles/${match[1]}`;
    }

    if (apiUrl) {
      const result = await zhihuFetch(p, apiUrl, {
        headers: {
          'x-api-version': '3.0.40',
          'x-requested-with': 'fetch',
        },
      });
      if (result.ok) {
        const data = JSON.parse(result.text);
        return extractTextFromContent(data.content || '');
      }
    }

    return item.excerpt || '';
  } catch {
    return item.excerpt || '';
  }
}

// ===== 数据提取 =====

function extractRecommendItems(data) {
  const items = [];
  const raw = data.data || [];
  for (const item of raw) {
    const target = item.target || item;
    const title = target.title || target.question?.title || '';
    const url = target.url || (target.question ? `https://www.zhihu.com/question/${target.question.id}` : '');
    const excerpt = target.excerpt || '';
    items.push({ title: title || '无标题', url, excerpt });
  }
  return items;
}

function extractHistoryItems(data) {
  const items = [];
  const raw = data.data || [];
  for (const item of raw) {
    const target = item.target || item;
    const title = target.title || target.question?.title || '';
    const url = target.url || (target.question ? `https://www.zhihu.com/question/${target.question.id}` : '');
    const excerpt = target.excerpt || '';
    items.push({ title: title || '无标题', url, excerpt });
  }
  return items;
}

function extractTextFromContent(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .substring(0, 4000);
}

module.exports = {
  createZhihuClient(cookie) {
    // 返回 dummy client，loginWithCookie 会处理登录
    return { cookie };
  },
  loginWithCookie,
  validateCookie,
  fetchRecommendations,
  fetchCollections,
  fetchContentDetail,
  closeBrowser,
};
