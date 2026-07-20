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
 * 提取标题中的关键词（去除常见停用词），检查字幕中是否包含至少一个关键词
 */
function isSubtitleRelevant(title, subtitle) {
  if (!title || !subtitle) return false;

  // 从标题中提取关键词（2字以上的连续中文字符或英文单词）
  const keywords = [];
  // 中文关键词：2-4 个连续汉字
  const cnMatches = title.match(/[\u4e00-\u9fa5]{2,4}/g);
  if (cnMatches) keywords.push(...cnMatches);
  // 英文关键词：4个字母以上的单词
  const enMatches = title.match(/[a-zA-Z]{4,}/g);
  if (enMatches) keywords.push(...enMatches);

  if (keywords.length === 0) return true; // 无法提取关键词时放行

  // 停用词
  const stopWords = new Set(['什么', '怎么', '为什么', '如何', '一个', '这个', '那个', '可以', '不能', '不是', '就是', '还是', '有没有', '为什么', '怎么样']);

  // 检查字幕中是否包含至少一个关键词（排除停用词）
  const relevantKeywords = keywords.filter(k => !stopWords.has(k));
  if (relevantKeywords.length === 0) return true;

  const subtitleLower = subtitle.toLowerCase();
  for (const kw of relevantKeywords) {
    if (subtitleLower.includes(kw.toLowerCase())) return true;
  }

  return false;
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

  // CC 字幕提取（前 N 条并行），并校验字幕与标题的相关性
  const extractCount = Math.min(allItems.length, config.SUBTITLE_EXTRACT_COUNT || 3);
  console.log(`   提取 CC 字幕（前${extractCount}条，并行）...`);
  const subtitleMap = new Map();

  const subtitlePromises = [];
  for (let i = 0; i < extractCount; i++) {
    const item = allItems[i];
    const aid = item.history?.oid || item.oid;
    if (!aid) continue;
    subtitlePromises.push(
      (async () => {
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
      })()
    );
  }
  // 并行等待所有字幕提取完成
  await Promise.allSettled(subtitlePromises);

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

  // 提取全文（前 N 条并行）
  const extractCount = Math.min(allItems.length, config.SUBTITLE_EXTRACT_COUNT || 3);
  console.log(`  📝 提取全文内容（前${extractCount}条，并行）...`);
  const contentMap = new Map();

  const contentPromises = [];
  for (let i = 0; i < extractCount; i++) {
    const item = allItems[i];
    contentPromises.push(
      (async () => {
        try {
          await withRetry(async () => {
            const text = await zh.fetchContentDetail(client, item);
            if (text) contentMap.set(i, text);
          }, `知乎-全文-${item.title}`);
        } catch { /* skip */ }
      })()
    );
  }
  // 并行等待所有全文提取完成
  await Promise.allSettled(contentPromises);

  // 写入后端
  console.log('  💾 写入后端...');
  const transformed = allItems.map((item, i) => transformZhihuItem(item, contentMap.get(i) || ''));
  const result = await batchWriteItems(transformed, getToken);
  console.log(`  📊 知乎: 成功 ${result.success} / 失败 ${result.failed}\n`);
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

  // 抓取 Star 仓库
  console.log('  📥 拉取 Star 仓库...');
  let repos = [];
  try {
    repos = await withRetry(
      () => gh.fetchStarredRepos(client, { limit: config.MAX_ITEMS_PER_RUN }),
      'GitHub-Star'
    );
    console.log(`  ✓ Starred ${repos.length} 个仓库`);
  } catch (err) {
    console.error(`  ❌ 抓取失败: ${err.message}`);
    return;
  }

  // 提取 README（前 N 条并行）
  const extractCount = Math.min(repos.length, config.SUBTITLE_EXTRACT_COUNT || 3);
  console.log(`  📝 提取 README（前${extractCount}条，并行）...`);
  const readmeMap = new Map();

  const readmePromises = [];
  for (let i = 0; i < extractCount; i++) {
    const repo = repos[i];
    readmePromises.push(
      (async () => {
        try {
          await withRetry(async () => {
            const readme = await gh.fetchReadme(client, repo);
            if (readme) readmeMap.set(i, readme);
          }, `GitHub-README-${repo.title}`);
        } catch { /* skip */ }
      })()
    );
  }
  // 并行等待所有 README 提取完成
  await Promise.allSettled(readmePromises);

  // 写入后端
  console.log('  💾 写入后端...');
  const transformed = repos.map((repo, i) => transformGitHubItem(repo, readmeMap.get(i) || '', repo.topics || []));
  const result = await batchWriteItems(transformed, getToken);
  console.log(`  📊 GitHub: 成功 ${result.success} / 失败 ${result.failed}\n`);
  return result;
}

// ===== 小红书抓取（TODO） =====
async function crawlXiaohongshu(getToken) {
  const xhs = loadXiaohongshu();
  // ... 结构同其他平台
}

// ===== 主流程 =====

async function runOnce() {
  const getToken = getAuthToken;
  const platform = forcePlatform;

  if (platform) {
    // 单平台
    if (platform === 'bilibili') await crawlBilibili(getToken);
    else if (platform === 'zhihu') await crawlZhihu(getToken);
    else if (platform === 'github') await crawlGitHub(getToken);
    else if (platform === 'xiaohongshu') await crawlXiaohongshu(getToken);
    else console.error(`未知平台: ${platform}`);
  } else {
    // 所有启用平台：并行抓取各平台
    const enabled = config.ENABLED_PLATFORMS;
    console.log(`🚀 开始并行抓取 ${enabled.length} 个平台: ${enabled.join(', ')}\n`);
    
    const tasks = [];
    if (enabled.includes('bilibili')) tasks.push(crawlBilibili(getToken));
    if (enabled.includes('zhihu')) tasks.push(crawlZhihu(getToken));
    if (enabled.includes('github')) tasks.push(crawlGitHub(getToken));
    if (enabled.includes('xiaohongshu')) tasks.push(crawlXiaohongshu(getToken));

    await Promise.allSettled(tasks);
  }
}

// ===== 轮询模式 =====
async function startPolling() {
  console.log(`🔄 轮询模式启动，间隔: ${pollInterval / 1000} 秒\n`);
  await runOnce();
  setInterval(async () => {
    console.log(`⏰ [${new Date().toISOString()}] 新一轮抓取开始\n`);
    try {
      await runOnce();
    } catch (err) {
      console.error('轮询抓取出错:', err.message);
    }
  }, pollInterval);
}

// ===== 入口 =====
if (isPolling) {
  startPolling();
} else {
  runOnce().then(() => {
    console.log('✅ 所有平台抓取完成');
  }).catch(err => {
    console.error('❌ 抓取出错:', err);
    process.exit(1);
  });
}
