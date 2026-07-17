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
 *   AUTH_PASSWORD     - 登录密码（默认 REPLACE_ME）
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

/** 根据关键词判断内容分类（加权匹配，按得分最高者归类） */
function classifyByText(title, excerpt) {
  const text = (title + ' ' + (excerpt || '')).toLowerCase();

  // 定义各分类的关键词及其权重（高特异性词权重 3，一般词权重 1）
  const categories = [
    {
      name: '深度知识',
      keywords: [
        // 高特异性技术词（权重 3）
        { w: 3, ks: ['源码分析', '编译原理', '设计模式', '微服务', '云原生', 'kubernetes', 'docker',
          '机器学习', '深度学习', '神经网络', '自然语言处理', '计算机视觉', '强化学习',
          '分布式系统', '分布式', '操作系统', '数据库', '网络协议', '数据结构',
          'rust', 'typescript', 'golang', 'javascript', 'python',
          '数学', '量子', '论文', '内核', '编译器', '字节码',
          '后端', '前端框架', '源码', '原理', '算法', '编程'] },
        // 一般技术词（权重 1）
        { w: 1, ks: ['架构', '代码', '开源', 'github', 'api', '工程', '开发', '程序员', '计算机',
          '模型', '训练', '推理', 'token', 'transformer', 'llm', '模型部署',
          'leetcode', '面试', '笔试', '刷题', '八股', '校招', '春招', '秋招'] },
      ]
    },
    {
      name: '行业资讯',
      keywords: [
        { w: 3, ks: ['融资', '上市', '估值', '财报', 'GDP', '经济数据', '央行',
          '发布会', '新品发布', '裁员', '招聘报告',
          'AI', '大模型', 'GPT', 'openai', 'deepseek', '通义', '文心',
          '趋势报告', '行业报告', '市场分析', '政策解读'] },
        { w: 1, ks: ['趋势', '报告', '行业', '市场', '政策', '经济', '财经', '商业',
          '投资', '股票', '基金', '比特币', 'web3', '风口'] },
      ]
    },
    {
      name: '创意灵感',
      keywords: [
        { w: 3, ks: ['UI设计', 'UX设计', '平面设计', '工业设计', '视觉设计', '品牌设计',
          '插画', '摄影', '艺术', '画作', '展览', '色彩搭配',
          '动画制作', '字体设计', '音乐创作', '写作方法', '创意'] },
        { w: 1, ks: ['设计', 'ui', 'ux', '动画', '字体', '配色', '视觉', '排版', 'logo',
          '视频剪辑', '后期', '调色', '绘画', '手绘', '素描'] },
      ]
    },
    {
      name: '实用技巧',
      keywords: [
        { w: 3, ks: ['手把手', '从零开始', '零基础', '新手教程', '保姆级',
          '经验分享', '实用工具', '效率工具', 'chrome插件', 'vscode插件',
          'vim', 'git', 'linux命令', '命令行'] },
        { w: 1, ks: ['教程', '技巧', '工具', '经验', '方法', '指南', '实操', '入门', '进阶',
          '实用', 'workflow', '插件', '快捷键', '自动化', '脚本'] },
      ]
    },
    {
      name: '娱乐科普',
      keywords: [
        { w: 3, ks: ['科普', '冷知识', '纪录片', '科学实验',
          '宇宙', '天文', '量子物理', '相对论', '黑洞',
          '进化', '基因编辑', 'DNA', '细胞',
          '物理', '化学', '生物', '自然科学', '地质',
          '自然', '动物世界', '海洋', '植物', '生态', '环保'] },
        { w: 1, ks: ['科学', '实验', '动物', '地球', '气候',
          '历史', '考古', '文物', '博物馆',
          '心理学', '哲学', '社会学', '经济学入门'] },
      ]
    },
    {
      name: '娱乐短剧',
      keywords: [
        { w: 3, ks: ['游戏', '手游', '电竞', '主机游戏', '游戏测评', 'steam', 'switch',
          '电影', '电视剧', '综艺', '综艺节目', '票房',
          '搞笑', '鬼畜', '八卦', '明星', '娱乐圈', '饭圈',
          'vlog', '吃播', '开箱', '探店', '测评'] },
        { w: 2, ks: ['穿搭', '护肤', '美妆', '好物', '种草', '美甲',
          '美食', '食谱', '烹饪', '做饭', '甜品', '奶茶',
          '健身', '运动', '体育', '减肥', '瑜伽',
          '旅游', '旅行', '酒店', '民宿', '打卡', '拍照',
          '生活', '日常', 'vlog日常', '周末', 'plog'] },
      ]
    },
  ];

  // 计算各分类得分
  let scores = {};
  for (const cat of categories) {
    let total = 0;
    for (const group of cat.keywords) {
      for (const kw of group.ks) {
        if (text.includes(kw)) total += group.w;
      }
    }
    scores[cat.name] = total;
  }

  // 按得分降序排列
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = sorted[0];

  // 若最高分 > 0，返回最高分类；否则根据内容来源兜底
  if (best[1] > 0) return best[0];

  // 兜底：知乎/技术性标题 → 深度知识；生活/情绪类 → 娱乐短剧
  const lifeHint = ['感觉', '心态', '情绪', '焦虑', '迷茫', '累了', '无聊', '吐槽',
    '老婆', '老公', '男朋友', '女朋友', '爸妈', '父母', '孩子',
    '怀孕', '结婚', '分手', '恋爱',
    '好笑', '哈哈', '搞笑', '笑死', '离谱', '牛逼', '绝了',
    '花钱', '买', '钱', '工资', '房租', '房贷',
    '颜值', '好看', '帅', '漂亮', '丑', '可爱',
    '热', '冷', '天气', '下雨', '下雪'];
  for (const h of lifeHint) {
    if (text.includes(h)) return '娱乐短剧';
  }
  if (text.includes('知乎') || text.includes('回答') || text.includes('问题')) return '深度知识';
  if (text.includes('github') || text.includes('代码') || text.includes('开源')) return '深度知识';
  return '娱乐科普';
}

/**
 * 校验字幕与标题是否相关
 * bigram 分词：标题切成 2 字滑动窗口 + 英文单词(>=3字母)，
 * 字幕中命中任意一个非停用 gram 即视为相关
 */
function isSubtitleRelevant(title, subtitle) {
  if (!title || !subtitle) return false;

  // 通用词（bigram 级停用词），不具区分度
  const stopGrams = new Set([
    '视频', '内容', '文章', '介绍', '分享', '讲解', '分析', '什么', '怎么', '为什', '么样', '如何',
    '一个', '这个', '那个', '可以', '不能', '不是', '就是', '还是', '没有', '有没', '其实', '真的',
    '到底', '是不', '大家', '我们', '你们', '他们', '自己', '觉得', '知道', '应该', '时候', '现在',
    '问题', '东西', '事情', '感觉', '看到', '出现', '进行', '使用', '需要', '带你', '教程',
  ]);

  const grams = [];
  // 中文：连续汉字段切 2 字滑动窗口
  const cnSegs = title.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of cnSegs) {
    for (let i = 0; i + 2 <= seg.length; i++) {
      const g = seg.substring(i, i + 2);
      if (!stopGrams.has(g)) grams.push(g);
    }
  }
  // 英文：3 字母以上的单词（覆盖 LLM、Git 等短词）
  const enWords = title.match(/[a-zA-Z]{3,}/g) || [];
  for (const w of enWords) grams.push(w.toLowerCase());

  if (grams.length === 0) return true; // 无法提取关键词时放行

  const subtitleLower = subtitle.toLowerCase();
  return grams.some(g => subtitleLower.includes(g));
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

  // CC 字幕提取（前 5 条），并校验字幕与标题的相关性
  console.log('   提取 CC 字幕（前5条）...');
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
          // 校验字幕与标题的相关性：字幕中应包含标题中的关键词
          const title = (item.title || '').trim();
          if (title && text && isSubtitleRelevant(title, text)) {
            subtitleMap.set(aid, text);
            console.log(`    ✓ ${title.substring(0, 30)}... 字幕匹配`);
          } else {
            console.log(`    ⚠ ${title.substring(0, 30)}... 字幕不匹配，丢弃`);
          }
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
