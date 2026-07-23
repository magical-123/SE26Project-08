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
 * 手动注入的反检测脚本（隐藏 Playwright 自动化指纹）
 */
const stealthScript = `
// 1. 覆盖 navigator.webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => false });

// 2. 覆盖 chrome.runtime
window.chrome = {
  runtime: {},
  loadTimes: function() {},
  csi: function() {},
  app: {},
};

// 3. 覆盖 plugins（正常浏览器至少有一些插件）
Object.defineProperty(navigator, 'plugins', {
  get: () => [1, 2, 3, 4, 5],
});

// 4. 覆盖 languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['zh-CN', 'zh', 'en'],
});

// 5. 覆盖 permissions.query
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
  parameters.name === 'notifications' ?
    Promise.resolve({ state: Notification.permission }) :
    originalQuery(parameters)
);

// 6. 覆盖 headless 检测相关属性
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

// 7. 覆盖 iframe contentWindow 检测
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function(init) {
  return originalAttachShadow.call(this, { ...init, mode: 'closed' });
};
`;

/**
 * 初始化/复用浏览器（只启动一次，注入手动反检测脚本）
 */
async function getPage() {
  if (page && !page.isClosed()) return page;
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  page = await context.newPage();
  // 在每个页面加载前注入反检测脚本
  await page.addInitScript(stealthScript);
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
 * 创建知乎客户端（占位，当前各函数直接用 Playwright page 工作）
 */
function createZhihuClient(cookie) {
  return {};
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
  // loginWithCookie 已经验证了登录状态，此处无需重复调用 API
  try {
    const p = await getPage();
    const name = await p.evaluate(() => {
      // 尝试从 DOM 中获取用户名
      const el = document.querySelector('[class*="ProfileHeader-name"]') 
              || document.querySelector('[class*="AppHeader-profile"] span');
      return el ? el.textContent.trim() : null;
    });
    return { valid: true, name: name || '知乎用户' };
  } catch {
    return { valid: true, name: '知乎用户' };
  }
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
 * 获取赞同/投票内容（知乎 API 受限，返回空）
 */
async function fetchVotedContent(clientDummy, options = {}) {
  return { items: [], hasMore: false };
}

// ===== 无需登录：公共发现页抓取 =====

/**
 * 从知乎发现页 /explore 抓取公共推荐内容（无需登录）
 */
async function fetchExplore(clientDummy, options = {}) {
  const { limit = 10 } = options;
  const p = await getPage();

  // 导航到发现页（无需登录即可访问）
  console.log('    打开知乎发现页 /explore...');
  await p.goto('https://www.zhihu.com/explore', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(3000);

  // 滚动加载
  const scrollCount = Math.ceil(limit / 5) + 3;
  for (let i = 0; i < scrollCount; i++) {
    await p.evaluate(() => window.scrollBy(0, 800));
    await p.waitForTimeout(1500);
  }

  // 提取内容
  const items = await p.evaluate(() => {
    const results = [];
    const seen = new Set();

    // 从所有链接中提取知乎问题/文章
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.href;
      if (!href) continue;

      const isQuestion = href.match(/zhihu\.com\/question\/(\d+)/);
      const isArticle = href.match(/zhihu\.com\/p\/(\d+)/);
      if (!isQuestion && !isArticle) continue;

      const cleanUrl = href.split('?')[0];
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);

      // 提取标题：优先用 h2/h3，其次用链接附近最大的文本块
      let title = '';
      let author = '';
      const card = link.closest('[class*="item"], [class*="card"], [class*="Card"], [class*="feed"], li, div');

      const heading = card?.querySelector('h2, h3, [class*="title"], [class*="Title"]');
      if (heading) {
        title = heading.textContent.trim();
      }

      if (!title || title.length < 5) {
        // 取链接自身文本或附近最近的有意义文本
        title = link.textContent.trim();
        if (title.length < 5 && card) {
          // 取卡片中第一个有意义的文本块
          const textNodes = card.querySelectorAll('a, span, strong');
          for (const node of textNodes) {
            const t = node.textContent.trim();
            if (t.length > title.length && t.length >= 5) title = t;
          }
        }
      }

      // 尝试提取作者
      const dataZopEl = card?.querySelector('[data-zop]') || (card?.hasAttribute?.('data-zop') ? card : null);
      if (dataZopEl) {
        try {
          const dataZop = JSON.parse(dataZopEl.getAttribute('data-zop') || '{}');
          author = dataZop.authorName || dataZop.author_name || dataZop.author?.name || '';
        } catch { /* DOM fallback below */ }
      }
      if (!author) {
        const authorEl = card?.querySelector(
          '.AuthorInfo-name .UserLink-link, [class*="AuthorInfo-name"] a[href*="/people/"], .UserLink-link, ' +
          '[data-za-detail-view-element_name="User"], a[href*="/people/"], ' +
          '[class*="author"], [class*="Author"], .author-name, [class*="user-name"]'
        );
        if (authorEl) author = authorEl.textContent.trim();
      }

      // 过滤无效标题
      if (!title || title.length < 5) continue;
      if (/^(登录|注册|举报|侵权|联系|关于|隐私|协议|条款|帮助|反馈|下载|App|APP|首页|发现|会员|消息)/.test(title)) continue;

      // 提取摘要
      let excerpt = '';
      if (card) {
        const text = card.textContent.replace(/\s+/g, ' ').trim();
        const idx = text.indexOf(title);
        if (idx >= 0) {
          excerpt = text.substring(idx + title.length).trim().substring(0, 500);
        }
      }

      results.push({ title, url: href, excerpt, author });
    }

    return results;
  });

  const limited = items.slice(0, limit);
  console.log(`    ✓ 发现页抓取到 ${limited.length} 条`);
  return { items: limited, hasMore: items.length > limit };
}

// ===== DOM 抓取（绕过 API 反爬） =====

/**
 * 从知乎首页 DOM 抓取推荐内容
 * 通过滚动加载 + DOM 提取替代 API 调用
 */
async function fetchFromDOM(clientDummy, options = {}) {
  const { limit = 10 } = options;
  const p = await getPage();

  // 确保在知乎首页
  const currentUrl = p.url();
  if (!currentUrl.includes('zhihu.com')) {
    await p.goto('https://www.zhihu.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  }
  await p.waitForTimeout(2000);

  // 滚动加载更多内容
  const scrollCount = Math.ceil(limit / 5) + 2; // 每次滚动大约加载 4-5 条
  for (let i = 0; i < scrollCount; i++) {
    await p.evaluate(() => window.scrollBy(0, 800));
    await p.waitForTimeout(1500);
  }

  // 从 DOM 提取内容
  const items = await p.evaluate(() => {
    const results = [];
    const seen = new Set();

    // 优先从知乎的推荐卡片容器中查找
    const cardContainers = document.querySelectorAll(
      '[class*="TopstoryItem"], [class*="TopStory-item"], ' +
      '[class*="ContentItem"], [class*="Card"], ' +
      'div[data-zop], [class*="feed-item"], [class*="feedItem"]'
    );

    // 如果找到卡片容器，从容器内提取
    const containers = cardContainers.length > 0 ? cardContainers : [document.body];
    
    for (const container of containers) {
      const links = container.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.href;
        if (!href) continue;

        // 只匹配知乎的问题、文章链接
        const isQuestion = href.match(/zhihu\.com\/question\/(\d+)/);
        const isArticle = href.match(/zhihu\.com\/p\/(\d+)/);
        if (!isQuestion && !isArticle) continue;
        
        // 排除明显不是内容卡片的链接（太短、纯数字、页脚链接）
        const linkText = link.textContent.trim();
        if (!linkText || linkText.length < 5) continue;
        if (/^[\d]+$/.test(linkText)) continue;
        if (/^(登录|注册|举报|侵权|联系|关于|隐私|协议|条款|帮助|反馈|下载|App|APP|首页|发现|会员|消息|私信|通知|设置|退出|写文章|提问|发视频)/.test(linkText)) continue;

        // 去重
        const cleanUrl = href.split('?')[0];
        if (seen.has(cleanUrl)) continue;
        seen.add(cleanUrl);

        // 从卡片容器中提取标题
        let title = '';
        const card = link.closest('[class*="TopstoryItem"], [class*="ContentItem"], [class*="Card"], div[data-zop]') || link.closest('div');
        
        const h2 = card?.querySelector('h2, h3');
        if (h2) {
          title = h2.textContent.trim();
        }
        if (!title || title.length < 3) {
          // 取链接附近最长的文本块
          const textEls = card?.querySelectorAll('span, strong, [class*="title"], [class*="Title"]');
          let bestText = '';
          if (textEls) {
            for (const el of textEls) {
              const t = el.textContent.trim();
              if (t.length > bestText.length && t.length >= 5 && !/^(登录|注册|举报|侵权)/.test(t)) {
                bestText = t;
              }
            }
          }
          title = bestText || linkText;
        }

        // 排除无效标题
        if (!title || title.length < 3) continue;
        if (/^(登录|注册|举报|侵权|联系|关于)/.test(title)) continue;

        // 提取作者。知乎的 data-zop 往往比易变化的 className 更稳定。
        let author = '';
        const dataZopEl = card?.querySelector('[data-zop]') || (card?.hasAttribute?.('data-zop') ? card : null);
        if (dataZopEl) {
          try {
            const dataZop = JSON.parse(dataZopEl.getAttribute('data-zop') || '{}');
            author = dataZop.authorName || dataZop.author_name || dataZop.author?.name || '';
          } catch { /* DOM fallback below */ }
        }
        if (!author) {
          const authorEl = card?.querySelector(
            '.AuthorInfo-name .UserLink-link, [class*="AuthorInfo-name"] a[href*="/people/"], .UserLink-link, ' +
            '[data-za-detail-view-element_name="User"], a[href*="/people/"], ' +
            '[class*="author"], [class*="Author"]'
          );
          if (authorEl) author = authorEl.textContent.trim();
        }

        // 提取摘要
        let excerpt = '';
        if (card) {
          const excerptEl = card.querySelector('[class*="excerpt"], [class*="RichText"], [class*="Summary"], [class*="content"]');
          if (excerptEl) {
            excerpt = excerptEl.textContent.trim().substring(0, 500);
          }
          if (!excerpt) {
            // 取卡片中的第二长文本块作为摘要
            const allText = card.textContent.trim();
            // 去掉标题部分取剩下的
            if (allText.length > title.length + 20) {
              excerpt = allText.replace(title, '').trim().substring(0, 500);
            }
          }
        }

        results.push({ title, url: href, excerpt, author });
      }
    }

    return results;
  });

  const limited = items.slice(0, limit);
  console.log(`    ✓ DOM 抓取到 ${limited.length} 条`);
  return { items: limited, hasMore: items.length > limit };
}

/**
 * 通过 page.goto 导航到详情页，从 DOM 提取全文
 */
async function fetchContentDetailFromDOM(clientDummy, item) {
  try {
    const url = item.url;
    if (!url) return item.excerpt || '';

    const p = await getPage();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await p.waitForTimeout(2000);

    const text = await p.evaluate(() => {
      // 知乎答案/文章的主要内容区域
      const selectors = [
        '[class*="RichText"]',
        '[class*="Post-RichText"]',
        '[class*="ArticleItem-content"]',
        '[class*="AnswerItem-content"]',
        '[class*="QuestionAnswer-content"]',
        'article',
        '.RichContent-inner',
        '[class*="content"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 100) {
          return el.textContent.trim();
        }
      }
      // 兜底：取 body 文本
      return document.body ? document.body.innerText.substring(0, 4000) : '';
    });

    return text ? text.substring(0, 4000) : (item.excerpt || '');
  } catch {
    return item.excerpt || '';
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
            const items = extractCollectionItems(contentData);
            allItems.push(...items);
          } catch (e) {
            console.log(`    收藏夹 ${collId} 解析失败: ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.log(`    收藏夹列表解析失败: ${e.message}`);
    }
  }

  return { items: allItems.slice(0, limit), hasMore: false };
}

// ===== 数据提取辅助函数 =====

function extractRecommendItems(data) {
  const items = [];
  const dataList = data.data || [];
  
  for (const item of dataList) {
    if (!item || typeof item !== 'object') continue;
    
    const target = item.target || item;
    if (!target) continue;
    
    const title = target.title || target.question?.title || '';
    const url = target.url || `https://www.zhihu.com/question/${target.id || ''}`;
    const excerpt = target.excerpt || target.content || '';
    
    if (title && url) {
      items.push({
        title: title.substring(0, 200),
        url,
        excerpt: excerpt.substring(0, 500),
      });
    }
  }
  
  return items;
}

function extractHistoryItems(data) {
  const items = [];
  const dataList = data.data || [];
  
  for (const item of dataList) {
    if (!item || typeof item !== 'object') continue;
    
    const target = item.target || item;
    if (!target) continue;
    
    const title = target.title || target.question?.title || '';
    const url = target.url || `https://www.zhihu.com/question/${target.id || ''}`;
    const excerpt = target.excerpt || target.content || '';
    
    if (title && url) {
      items.push({
        title: title.substring(0, 200),
        url,
        excerpt: excerpt.substring(0, 500),
      });
    }
  }
  
  return items;
}

function extractCollectionItems(data) {
  const items = [];
  const dataList = data.data || [];
  
  for (const item of dataList) {
    if (!item || typeof item !== 'object') continue;
    
    const content = item.content || item;
    if (!content) continue;
    
    const title = content.title || content.question?.title || '';
    const url = content.url || `https://www.zhihu.com/question/${content.id || ''}`;
    const excerpt = content.excerpt || content.content || '';
    
    if (title && url) {
      items.push({
        title: title.substring(0, 200),
        url,
        excerpt: excerpt.substring(0, 500),
      });
    }
  }
  
  return items;
}

module.exports = {
  createZhihuClient,
  getPage,
  closeBrowser,
  loginWithCookie,
  validateCookie,
  fetchExplore,
  fetchRecommendations,
  fetchHistory,
  fetchVotedContent,
  fetchFromDOM,
  fetchContentDetailFromDOM,
  fetchCollections,
};
