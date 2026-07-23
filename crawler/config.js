/**
 * InfoDigest 爬虫配置文件
 * 
 * 使用说明：
 * 1. 将你的各平台 Cookie 填入下方
 * 2. 确保后端已启动在 BACKEND_URL
 * 3. 填写你的前端登录账号密码（用于通过 JWT 认证写入数据）
 * 4. 在 ENABLED_PLATFORMS 中启用需要抓取的平台
 */
module.exports = {
  // ===== 启用的平台 =====
  /** 需要抓取的平台列表：bilibili, zhihu, xiaohongshu */
  ENABLED_PLATFORMS: process.env.ENABLED_PLATFORMS
    ? process.env.ENABLED_PLATFORMS.split(',')
    : ['bilibili', 'zhihu'],

  // ===== B 站配置 =====
  /** B 站完整 Cookie 字符串 */
  BILIBILI_COOKIE: process.env.BILIBILI_COOKIE || '',

  /** B 站 API 基础地址 */
  BILIBILI_BASE: 'https://api.bilibili.com',

  // ===== 知乎配置 =====
  /** 知乎完整 Cookie 字符串 */
  ZHIHU_COOKIE: process.env.ZHIHU_COOKIE || '',

  // ===== GitHub 配置 =====
  /** GitHub Personal Access Token（Settings → Developer settings → Tokens） */
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',

  /** GitHub 用户名（可选，不填则自动从 Token 获取） */
  GITHUB_USERNAME: process.env.GITHUB_USERNAME || '',

  // ===== 小红书配置 =====
  XIAOHONGSHU_COOKIE: process.env.XIAOHONGSHU_COOKIE || '',

  // ===== 后端配置 =====
  /** Spring Boot 后端地址 */
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8080',

  /** 前端登录账号（用于获取 JWT Token 写入数据） */
  AUTH_USERNAME: process.env.AUTH_USERNAME || 'testuser',
  AUTH_PASSWORD: process.env.AUTH_PASSWORD || 'REPLACE_ME',

  // ===== 爬虫调优参数 =====
  /** 每次请求之间随机休眠 [min, max] 毫秒（降低延迟以加快抓取速度） */
  REQUEST_DELAY_MIN: 500,
  REQUEST_DELAY_MAX: 1500,

  /** 最大重试次数 */
  MAX_RETRIES: 3,

  /** 重试等待基数（毫秒），实际等待 = 基数 * 重试次数 * 随机系数 */
  RETRY_DELAY_BASE: 3000,

  /** Cookie 失效的 HTTP 状态码 */
  COOKIE_INVALID_CODES: [401, 403],

  /** 被限流的 HTTP 状态码 */
  RATE_LIMIT_CODES: [412, 429, 509],

  /** 限流后冷却时间（毫秒） */
  RATE_LIMIT_COOLDOWN: 60000,

  /** 每个平台单次抓取最大条数 */
  MAX_ITEMS_PER_RUN: 20,

  /** 每次请求的分页大小 */
  PAGE_SIZE: 20,

  /** 字幕/全文提取的并行数量（前 N 条）设为 999999 表示全部提取 */
  SUBTITLE_EXTRACT_COUNT: 999999,
};
