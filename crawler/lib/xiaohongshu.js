/**
 * 小红书爬虫
 * 支持：
 *   1. 公开发现页（无 Cookie）
 *   2. 带 Cookie 个性化推荐
 *
 * 实现策略：
 *   - 用 Playwright 访问 /explore，拦截 feed API 响应（浏览器自带合法签名）
 *   - 如果 API 拦截失败，用 DOM 解析兜底
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://www.xiaohongshu.com';
const MAX_ITEMS_PER_RUN = 20;

// 可能命中的 feed API 路径
const FEED_PATH_PATTERNS = [
  '/api/sns/web/v1/feed',
  '/api/sns/web/v1/homefeed',
  '/api/sns/web/v1/explore/feed',
  '/api/sns/web/v1/search/notes',
];

function isFeedResponse(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return FEED_PATH_PATTERNS.some((pat) => pathname.includes(pat));
  } catch {
    return false;
  }
}

function parseCookieString(cookieStr) {
  if (!cookieStr) return [];
  return cookieStr
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.includes('='))
    .map((part) => {
      const idx = part.indexOf('=');
      return {
        name: part.substring(0, idx).trim(),
        value: part.substring(idx + 1).trim(),
        domain: '.xiaohongshu.com',
        path: '/',
      };
    });
}

function extractNotesFromFeedResponse(responseText) {
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    return [];
  }
  if (!data || typeof data !== 'object') return [];

  const payload = data.data || data;
  if (!payload || typeof payload !== 'object') return [];

  const rawItems = payload.items || payload.notes || payload.list || [];
  const notes = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;

    // 小红书 homefeed 结构：item.id + item.note_card
    let noteId = item.id;
    let title = '';
    let author = '';

    const noteCard = item.note_card;
    if (noteCard && typeof noteCard === 'object') {
      title = noteCard.display_title || noteCard.title || '';
      const user = noteCard.user || noteCard.user_info || {};
      author = user.nickname || user.nick_name || user.user_name || user.name || '';
    }

    // 兼容其他结构（如 item.note）
    const legacyNote = item.note || item;
    if (!noteId) noteId = legacyNote.note_id || legacyNote.id;
    if (!title) title = legacyNote.title || legacyNote.display_title || legacyNote.desc || '';
    if (!author) {
      const user = legacyNote.user || legacyNote.user_info || {};
      author = user.nickname || user.nick_name || user.user_name || user.name || '';
    }

    const displayTitle = (title || '无标题').trim();
    if (!noteId) continue;

    notes.push({
      noteId,
      title: displayTitle,
      url: `${BASE_URL}/explore/${noteId}`,
      author,
    });
  }
  return notes;
}

async function extractNotesFromDom(page, limit) {
  return page.evaluate((maxItems) => {
    const BASE = 'https://www.xiaohongshu.com';
    const results = [];
    const seen = new Set();
    const selectors = [
      'section.note-item',
      'div.note-item',
      'a[href^="/explore/"]',
      'div.feed-card',
      '[class*="note-item"]',
      '[class*="feed-card"]',
    ];

    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        if (results.length >= maxItems) break;
        const link = el.tagName === 'A' ? el : el.querySelector('a[href^="/explore/"]');
        if (!link) continue;
        const href = link.getAttribute('href') || '';
        const noteId = href.replace('/explore/', '').split('?')[0];
        if (!noteId || seen.has(noteId)) continue;
        seen.add(noteId);

        let title = '';
        for (const tsel of ['.title', '.note-title', '[class*="title"]']) {
          const t = el.querySelector(tsel);
          if (t) {
            title = t.innerText.trim();
            if (title) break;
          }
        }
        let author = '';
        for (const asel of [
          '.author-wrapper .name',
          '.author .name',
          '.user-name',
          '[class*="author"] [class*="name"]',
          '[class*="author"]',
        ]) {
          const a = el.querySelector(asel);
          if (a) {
            author = a.innerText.trim();
            if (author) break;
          }
        }
        results.push({
          noteId,
          title: title || '无标题',
          url: `${BASE}${href}`,
          author,
        });
      }
      if (results.length >= maxItems) break;
    }
    return results;
  }, limit);
}

function classifyByText(title) {
  const text = (title || '').toLowerCase();
  const deepKeywords = ['架构', '算法', '源码', '原理', '设计模式', '编译', '系统', '网络协议', '数据库', '分布式', '机器学习', '深度学习', '数学', '量子', '论文', 'rust', 'typescript'];
  const industryKeywords = ['趋势', '2026', '报告', '融资', '上市', '裁员', '招聘', '行业', '市场', '政策', 'ai', 'openai', '大模型', '估值'];
  const creativeKeywords = ['设计', 'ui', 'ux', '动画', '字体', '配色', '插画', '摄影', '美食', '穿搭', '旅行'];

  for (const kw of deepKeywords) {
    if (text.includes(kw)) return '深度知识';
  }
  for (const kw of industryKeywords) {
    if (text.includes(kw)) return '行业资讯';
  }
  for (const kw of creativeKeywords) {
    if (text.includes(kw)) return '创意灵感';
  }
  return '深度知识';
}

function transformXiaohongshuItem(item) {
  const title = item.title || '无标题';
  const contentRaw = title;
  return {
    title,
    url: item.url,
    platform: 'XIAOHONGSHU',
    author: item.author || '',
    category: classifyByText(title),
    durationMinutes: Math.max(1, Math.ceil(contentRaw.length / 500)),
    contentRaw: contentRaw.substring(0, 4000),
    processStatus: 'UNPROCESSED',
  };
}

/**
 * 主入口：抓取小红书笔记
 * @param {string} cookie - 可选，小红书 Cookie 字符串
 * @param {number} limit - 最大抓取条数
 */
async function fetchXiaohongshuItems(cookie = '', limit = MAX_ITEMS_PER_RUN) {
  console.log(`[xiaohongshu] 启动爬虫，模式: ${cookie ? 'Cookie' : '公开'}，limit: ${limit}`);

  let browser;
  const captured = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    });

    if (cookie) {
      const cookies = parseCookieString(cookie);
      if (cookies.length > 0) {
        await context.addCookies(cookies);
      }
    }

    const page = await context.newPage();

    page.on('response', async (response) => {
      if (!isFeedResponse(response.url())) return;
      try {
        const body = await response.body();
        captured.push({ url: response.url(), body: body.toString('utf-8') });
      } catch {
        /* ignore body fetch errors */
      }
    });

    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);

    // 滚动触发懒加载
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 900));
      await page.waitForTimeout(1500);
    }

    // API 拦截结果
    const apiNotes = [];
    for (const cap of captured) {
      const notes = extractNotesFromFeedResponse(cap.body);
      apiNotes.push(...notes);
    }

    // DOM 兜底
    const domNotes = await extractNotesFromDom(page, limit * 2);

    await browser.close();
    browser = null;

    // 合并去重：API 优先
    const seen = new Set();
    const uniqueNotes = [];
    for (const note of [...apiNotes, ...domNotes]) {
      if (!note.noteId || seen.has(note.noteId)) continue;
      seen.add(note.noteId);
      uniqueNotes.push(note);
      if (uniqueNotes.length >= limit) break;
    }

    console.log(`[xiaohongshu] API 拦截 ${apiNotes.length} 条，DOM 兜底 ${domNotes.length} 条，去重后 ${uniqueNotes.length} 条`);
    return uniqueNotes.map(transformXiaohongshuItem);
  } catch (err) {
    console.error('[xiaohongshu] 抓取失败:', err.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { fetchXiaohongshuItems };
