/**
 * InfoDigest 多平台爬虫 —— 主入口
 * 
 * 支持平台：B 站 (bilibili) | 知乎 (zhihu) | 小红书 (xiaohongshu, TODO)
 * 
 * 使用方式：
 *   node index.js                          # 单次抓取所有启用平台
 *   node index.js --poll --interval=3600  # 轮询模式（每3600秒抓一次）
 *   node index.js --platform=bilibili     # 只抓取指定平台
 * 
 * 环境变量：
 *   BILIBILI_COOKIE   - B 站 Cookie
 *   ZHIHU_COOKIE      - 知乎 Cookie
 *   ENABLED_PLATFORMS - 启用的平台，逗号分隔（默认 bilibili,zhihu）
 *   BACKEND_URL       - 后端地址（默认 http://localhost:8080）
 *   AUTH_USERNAME     - 登录用户名（默认 testuser）
 *   AUTH_PASSWORD     - 登录密码（默认 testpass）
 */

const config = require('./config');
const { withRetry } = require('./lib/antiCrawl');
const { getAuthToken, getCredential, batchWriteItems } = require('./lib/dataWriter');

// 按需加载平台模块
let bilibili, zhihu, github, xiaohongshu;
function loadBilibili() {
  if (!bilibili) bilibili = require('./lib/bilibili');
  return bilibili;
}
function loadZhihu() {
  if (!zhihu) zhihu = require('./lib/zhihu');
  return zhihu;
}
function loadGitHub() {
  if (!github) github = require('./lib/github');
  return github;
}
function loadXiaohongshu() {
  if (!xiaohongshu) xiaohongshu = require('./lib/xiaohongshu');
  return xiaohongshu;
}

// ===== 命令行参数解析 =====
const args = process.argv.slice(2);
const isPolling = args.includes('--poll');
const intervalArg = args.find(a => a.startsWith('--interval='));
const platformArg = args.find(a => a.startsWith('--platform='));
const pollInterval = intervalArg
  ? parseInt(intervalArg.split('=')[1], 10) * 1000
  : 3600000;
const forcePlatform = platformArg ? platformArg.split('=')[1].toLowerCase() : null;

// ===== 数据清洗公共方法 =====

/** 根据关键词判断内容分类 */
function classifyByText(title, excerpt) {
  const text = (title + ' ' + (excerpt || '')).toLowerCase();

  // 1. 娱乐科普：科学、自然、动物、冷知识、科普视频
  const entertainmentScience = ['科普', '科学', '自然', '动物', '物理', '化学', '生物', '天文', '宇宙', '冷知识', '实验', '纪录片'];
  for (const kw of entertainmentScience) {
    if (text.includes(kw)) return '娱乐科普';
  }

  // 2. 深度知识：硬核技术、学术、专业领域
  const deepKeywords = ['架构', '算法', '源码', '原理', '设计模式', '编译', '系统', '网络协议', '数据库', '分布式', '机器学习', '深度学习', '数学', '量子', '论文', 'rust', 'typescript', '编译原理', '操作系统', '内核', '微服务', '云原生', 'kubernetes', 'docker', '源码分析', '技术原理', '编程'];
  for (const kw of deepKeywords) {
    if (text.includes(kw)) return '深度知识';
  }

  // 3. 行业资讯：新闻、市场、趋势、商业
  const industryKeywords = ['趋势', '2026', '报告', '融资', '上市', '裁员', '招聘', '行业', '市场', '政策', 'ai', 'openai', '大模型', '估值', '新闻', '时政', '经济', '财经', 'GDP', '增长', '发布会', '新品'];
  for (const kw of industryKeywords) {
    if (text.includes(kw)) return '行业资讯';
  }

  // 4. 创意灵感：设计、艺术、摄影、音乐
  const creativeKeywords = ['设计', 'ui', 'ux', '动画', '字体', '配色', '插画', '摄影', '音乐创作', '写作', '创意', '艺术', '画作', '展览', '色彩', '视觉'];
  for (const kw of creativeKeywords) {
    if (text.includes(kw)) return '创意灵感';
  }

  // 5. 实用技巧：教程、工具、效率、经验分享
  const practicalKeywords = ['教程', '技巧', '工具', '效率', '经验', '方法', '指南', '实操', '手把手', '入门', '进阶', '实用', 'workflow', '插件', 'vim', 'git', 'linux命令'];
  for (const kw of practicalKeywords) {
    if (text.includes(kw)) return '实用技巧';
  }

  // 6. 娱乐短剧：游戏、影视、综艺、八卦、搞笑
  const entertainmentKeywords = ['游戏', '影视', '电影', '电视剧', '综艺', '搞笑', '八卦', '明星', '综艺节目', 'vlog', '吃播', '开箱', '测评', '手游', '电竞', '主播', '鬼畜'];
  for (const kw of entertainmentKeywords) {
    if (text.includes(kw)) return '娱乐短剧';
  }

  // 7. 生活/美食/旅游：不归为娱乐短剧，单独区分
  const lifestyleKeywords = ['美食', '餐厅', '探店', '烹饪', '食谱', '旅游', '旅行', '酒店', '民宿', '穿搭', '护肤', '健身', '运动', '生活', '日常', '好物', '种草'];
  for (const kw of lifestyleKeywords) {
    if (text.includes(kw)) return '娱乐短剧';
  }

  // 兜底： neutrally categorize by length and content type hints
  // 含"知乎"链接且标题较短，大概率是问答/讨论
  if (text.includes('知乎') || text.includes('回答') || text.includes('提问')) {
    return '深度知识';
  }

  return '娱乐科普'; // 默认归类为娱乐科普，避免全塞深度知识
}

/** B 站分类映射 */
function classifyBilibili(tagName) {
  const map = {
    science: '深度知识', tech: '深度知识', digital: '深度知识',
    knowledge: '深度知识', documentary: '深度知识', course: '深度知识',
    fashion: '创意灵感', music: '创意灵感', dance: '创意灵感', painting: '创意灵感',
    news: '行业资讯', finance: '行业资讯', military: '行业资讯', car: '行业资讯',
    entertainment: '娱乐短剧', game: '娱乐短剧', anime: '娱乐短剧',
    movie: '娱乐短剧', tv: '娱乐短剧', kichiku: '娱乐短剧',
    life: '娱乐短剧', food: '娱乐短剧', tourism: '娱乐短剧',
    animal: '娱乐短剧', sports: '娱乐短剧', virtual: '娱乐短剧',
  };
  return map[(tagName || '').toLowerCase()] || '深度知识';
}

/** B 站 → InformationItem */
function transformBilibiliItem(historyItem, subtitleText = '') {
  const duration = historyItem.duration || 0;
  return {
    title: historyItem.title || '无标题',
    url: historyItem.uri
      ? `https://www.bilibili.com${historyItem.uri}`
      : `https://www.bilibili.com/video/${historyItem.history?.bvid || ''}`,
    platform: 'BILIBILI',
    category: classifyBilibili(historyItem.tag_name),
    durationMinutes: Math.round(duration / 60) || 1,
    contentRaw: subtitleText
      ? subtitleText.substring(0, 4000)
      : historyItem.title || '',
    processStatus: 'UNPROCESSED',
  };
}

/** 知乎 → InformationItem */
function transformZhihuItem(item, fullText = '') {
  return {
    title: item.title || '无标题',
    url: item.url || '',
    platform: 'ZHIHU',
    category: classifyByText(item.title, item.excerpt),
    durationMinutes: Math.max(1, Math.ceil((fullText.length || item.excerpt?.length || 100) / 500)),
    contentRaw: fullText ? fullText.substring(0, 4000) : (item.excerpt || '').substring(0, 4000),
    processStatus: 'UNPROCESSED',
  };
}

/** GitHub → InformationItem */
function transformGitHubItem(item, readmeText = '', topics = []) {
  const topicText = topics.join(', ');
  const contentParts = [];
  if (item.description) contentParts.push(item.description);
  if (topicText) contentParts.push('Topics: ' + topicText);
  if (readmeText) contentParts.push(readmeText);
  const contentRaw = contentParts.join('\n\n');
  return {
    title: item.title || '未知仓库',
    url: item.url || '',
    platform: 'GITHUB',
    category: classifyByText(item.description || '', topicText),
    durationMinutes: Math.max(1, Math.ceil((contentRaw.length || 100) / 500)),
    contentRaw: contentRaw.substring(0, 4000),
    processStatus: 'UNPROCESSED',
  };
}

// ===== B 站抓取 =====
async function crawlBilibili(getToken) {
  const bl = loadBilibili();
  console.log('📺 【B 站】开始抓取...\n');

  const cookie = await getCredential('bilibili', 'BILIBILI_COOKIE');
  if (!cookie) {
    console.log('  ⏭ 未配置 B 站 Cookie，跳过');
    return;
  }

  const client = bl.createBilibiliClient(cookie);

  // 验证 Cookie
  console.log('  🔍 验证 Cookie...');
  try {
    const valid = await withRetry(() => bl.validateCookie(client), 'B站-Cookie验证');
    if (!valid) {
      console.error('  ❌ Cookie 无效，跳过\n');
      return;
    }
    console.log('  ✓ Cookie 有效');
  } catch (err) {
    console.error(`  ❌ Cookie 验证异常: ${err.message}，跳过\n`);
    return;
  }

  // 抓取历史记录
  console.log('  📥 拉取观看历史...');
  let allItems = [];
  let maxId = 0, viewAt = 0;

  try {
    while (allItems.length < config.MAX_ITEMS_PER_RUN) {
      const result = await withRetry(
        () => bl.fetchHistory(client, { maxId, viewAt, ps: config.PAGE_SIZE }),
        'B站-历史记录',
        () => console.error('  ❗ Cookie 已失效')
      );
      if (!result.items || result.items.length === 0) break;
      allItems = allItems.concat(result.items);
      if (!result.hasMore) break;
      maxId = result.nextMaxId;
      viewAt = result.nextViewAt;
    }
    console.log(`  ✓ 获取 ${allItems.length} 条记录`);
  } catch (err) {
    console.error(`  ❌ 抓取失败: ${err.message}`);
    return;
  }

  // CC 字幕提取（前 5 条）
  console.log('  📝 提取 CC 字幕（前5条）...');
  const subtitleMap = new Map();
  for (let i = 0; i < Math.min(allItems.length, 5); i++) {
    const item = allItems[i];
    const aid = item.history?.oid || item.oid;
    if (!aid) continue;
    try {
      await withRetry(async () => {
        const info = await bl.fetchVideoInfo(client, aid);
        const cid = info.cid || (info.pages && info.pages[0]?.cid);
        if (!cid) return;
        const subs = await bl.fetchSubtitleList(client, aid, cid);
        if (subs.length > 0) {
          const text = await bl.fetchSubtitleText(client, subs[0].url);
          subtitleMap.set(aid, text);
        }
      }, `B站-字幕-${item.title}`);
    } catch { /* skip */ }
  }

  // 写入后端
  console.log('  💾 写入后端...');
  const transformed = allItems.map(item => {
    const aid = item.history?.oid || item.oid;
    return transformBilibiliItem(item, subtitleMap.get(aid) || '');
  });
  const result = await batchWriteItems(transformed, getToken);
  console.log(`  📊 B站: 成功 ${result.success} / 失败 ${result.failed}\n`);
  return result;
}

// ===== 知乎抓取 =====
async function crawlZhihu(getToken) {
  const zh = loadZhihu();
  console.log('📘 【知乎】开始抓取...\n');

  const cookie = await getCredential('zhihu', 'ZHIHU_COOKIE');
  if (!cookie) {
    console.log('  ⏭ 未配置知乎 Cookie，跳过');
    return;
  }

  const client = zh.createZhihuClient(cookie);

  // 验证 Cookie（通过 Playwright 登录）
  console.log('  🔍 验证 Cookie（Playwright）...');
  try {
    const valid = await zh.loginWithCookie(cookie);
    if (!valid) {
      console.error('  ❌ Cookie 无效或缺少 z_c0，跳过\n');
      return;
    }
  } catch (err) {
    console.error(`  ❌ Playwright 登录异常: ${err.message}，跳过\n`);
    return;
  }

  // 抓取推荐/收藏内容
  console.log('  📥 拉取推荐内容...');
  let allItems = [];
  try {
    // 先尝试获取推荐内容
    const recResult = await withRetry(
      () => zh.fetchRecommendations(client, { limit: config.MAX_ITEMS_PER_RUN }),
      '知乎-推荐'
    );
    allItems = recResult.items || [];

    // 推荐内容不够 → 补充收藏夹
    if (allItems.length < config.MAX_ITEMS_PER_RUN) {
      const colResult = await withRetry(
        () => zh.fetchCollections(client, { limit: config.MAX_ITEMS_PER_RUN }),
        '知乎-收藏夹'
      );
      allItems = allItems.concat(colResult.items || []);
    }

    allItems = allItems.slice(0, config.MAX_ITEMS_PER_RUN);
    console.log(`  ✓ 获取 ${allItems.length} 条内容`);
  } catch (err) {
    console.error(`  ❌ 抓取失败: ${err.message}`);
    return;
  }

  // 提取全文
  console.log('  📝 提取全文内容（前5条）...');
  const contentMap = new Map();
  for (let i = 0; i < Math.min(allItems.length, 5); i++) {
    const item = allItems[i];
    try {
      await withRetry(async () => {
        const text = await zh.fetchContentDetail(client, item);
        contentMap.set(i, text);
      }, `知乎-全文-${item.title}`);
    } catch { /* skip */ }
  }

  // 写入后端
  console.log('  💾 写入后端...');
  const transformed = allItems.map((item, idx) =>
    transformZhihuItem(item, contentMap.get(idx) || '')
  );
  const result = await batchWriteItems(transformed, getToken);
  console.log(`  📊 知乎: 成功 ${result.success} / 失败 ${result.failed}\n`);

  // 关闭 Playwright 浏览器
  try { await zh.closeBrowser(); } catch {}
  return result;
}

// ===== GitHub 抓取 =====
async function crawlGitHub(getToken) {
  const gh = loadGitHub();
  console.log('🐙 【GitHub】开始抓取...\n');

  const token = await getCredential('github', 'GITHUB_TOKEN');
  if (!token) {
    console.log('  ⏭ 未配置 GitHub Token，跳过');
    return;
  }

  const client = gh.createGitHubClient(token);

  // 验证 Token，同时获取用户名
  console.log('  🔍 验证 Token...');
  let username = config.GITHUB_USERNAME;
  try {
    const res = await withRetry(async () => {
      const r = await client.get('/user');
      return r;
    }, 'GitHub-Token验证');
    if (!res.data?.login) {
      console.error('  ❌ Token 无效，跳过\n');
      return;
    }
    username = username || res.data.login;
    console.log(`  ✓ Token 有效，用户: ${username}`);
  } catch (err) {
    console.error(`  ❌ Token 验证异常: ${err.message}，跳过\n`);
    return;
  }

  let allItems = [];

  // 1. 抓取 Starred 仓库
  console.log('  📥 拉取 Starred 仓库...');
  try {
    const starResult = await withRetry(
      () => gh.fetchStarredRepos(client, username, { perPage: config.MAX_ITEMS_PER_RUN }),
      'GitHub-Starred'
    );
    allItems = starResult.items || [];
    console.log(`  ✓ Starred ${allItems.length} 个仓库`);
  } catch (err) {
    console.error(`  ⚠ Starred 抓取失败: ${err.message}`);
  }

  // 2. 补充近期公开活动
  if (allItems.length < 5) {
    try {
      const eventResult = await withRetry(
        () => gh.fetchUserEvents(client, username, { perPage: 10 }),
        'GitHub-Events'
      );
      allItems = allItems.concat(eventResult.items || []);
    } catch { /* skip */ }
  }

  allItems = allItems.slice(0, config.MAX_ITEMS_PER_RUN);

  if (allItems.length === 0) {
    console.log('  ⚠ 没有获取到内容，跳过\n');
    return;
  }

  // 3. 提取 README 和 Topics（前 5 条）
  console.log('  📝 提取仓库详情（前5条）...');
  const enrichMap = new Map();
  for (let i = 0; i < Math.min(allItems.length, 5); i++) {
    const item = allItems[i];
    if (item.contentType !== 'repository') continue;
    const [owner, repo] = (item.owner ? `${item.owner}/${item.title.split('/').pop()}` : item.title).split('/');
    if (!owner || !repo) continue;
    try {
      await withRetry(async () => {
        const [readme, topics] = await Promise.all([
          gh.fetchRepoReadme(client, owner, repo),
          gh.fetchRepoTopics(client, owner, repo),
        ]);
        enrichMap.set(i, { readme, topics });
      }, `GitHub-详情-${repo}`);
    } catch { /* skip */ }
  }

  // 4. 写入后端
  console.log('  💾 写入后端...');
  const transformed = allItems.map((item, idx) => {
    const enrich = enrichMap.get(idx) || {};
    return transformGitHubItem(item, enrich.readme || '', enrich.topics || []);
  });
  const result = await batchWriteItems(transformed, getToken);
  console.log(`  📊 GitHub: 成功 ${result.success} / 失败 ${result.failed}\n`);
  return result;
}

// ===== 小红书抓取 =====
async function crawlXiaohongshu(getToken) {
  const xhs = loadXiaohongshu();
  console.log('📕 【小红书】开始抓取...\n');

  const cookie = await getCredential('xiaohongshu', 'XIAOHONGSHU_COOKIE');
  if (cookie) {
    console.log('  ✓ 已配置小红书 Cookie，将尝试个性化推荐');
  } else {
    console.log('  ℹ 未配置小红书 Cookie，使用公开发现页');
  }

  let items = [];
  try {
    items = await withRetry(
      () => xhs.fetchXiaohongshuItems(cookie, config.MAX_ITEMS_PER_RUN),
      '小红书-发现页'
    );
    console.log(`  ✓ 共获取 ${items.length} 条内容`);
  } catch (err) {
    console.error(`  ❌ 抓取失败: ${err.message}`);
    return;
  }

  if (items.length === 0) {
    console.log('  ⚠ 没有获取到内容，跳过\n');
    return;
  }

  // 写入后端
  console.log('  💾 写入后端...');
  const result = await batchWriteItems(items, getToken);
  console.log(`  📊 小红书: 成功 ${result.success} / 失败 ${result.failed}\n`);
  return result;
}

// ===== 主流程 =====
async function runOnce() {
  console.log('═══════════════════════════════════════');
  console.log('  InfoDigest 多平台爬虫启动');
  console.log('═══════════════════════════════════════\n');

  // 验证后端连接：获取 JWT
  let getTokenFn;
  try {
    const token = await getAuthToken();
    getTokenFn = () => Promise.resolve(token);
    console.log('✓ 后端连接正常\n');
  } catch (err) {
    console.error(`❌ 后端连接失败: ${err.message}`);
    console.error('   请检查 BACKEND_URL 和后端是否启动\n');
    process.exit(1);
  }

  // 确定要抓取的平台
  let platforms = config.ENABLED_PLATFORMS;
  if (forcePlatform) {
    platforms = [forcePlatform];
  }

  console.log(`📋 启用平台: ${platforms.join(', ')}\n`);

  const results = {};

  for (const platform of platforms) {
    try {
      if (platform === 'bilibili') {
        results.bilibili = await crawlBilibili(getTokenFn);
      } else if (platform === 'zhihu') {
        results.zhihu = await crawlZhihu(getTokenFn);
      } else if (platform === 'github') {
        results.github = await crawlGitHub(getTokenFn);
      } else if (platform === 'xiaohongshu') {
        results.xiaohongshu = await crawlXiaohongshu(getTokenFn);
      } else {
        console.log(`⚠️ 未知平台: ${platform}，跳过\n`);
      }
    } catch (err) {
      console.error(`❌ [${platform}] 抓取异常: ${err.message}\n`);
    }
  }

  // 汇总
  let totalSuccess = 0, totalFailed = 0;
  for (const r of Object.values(results)) {
    if (r) { totalSuccess += r.success; totalFailed += r.failed; }
  }

  console.log('═══════════════════════════════════════');
  console.log(`  总计: 成功 ${totalSuccess} / 失败 ${totalFailed}`);
  console.log('═══════════════════════════════════════\n');

  return results;
}

// ===== 轮询模式 =====
async function startPolling() {
  console.log(`🔄 轮询模式启动，间隔: ${pollInterval / 1000} 秒\n`);
  await runOnce();
  setInterval(async () => {
    console.log(`⏰ [${new Date().toISOString()}] 新一轮抓取开始\n`);
    try { await runOnce(); } catch (err) { console.error(`轮询异常: ${err.message}`); }
  }, pollInterval);
}

// ===== 入口 =====
if (isPolling) {
  startPolling().catch(err => { console.error('爬虫致命错误:', err); process.exit(1); });
} else {
  runOnce()
    .then(() => process.exit(0))
    .catch(err => { console.error('爬虫异常退出:', err); process.exit(1); });
}
