/**
 * 数据写入模块
 * 通过 Spring Boot 后端 API 批量写入 information_items 表
 * 
 * 支持两种认证方式：
 * 1. 命令行 --auth-token=xxx（由 CrawlController 传入，推荐）
 * 2. 回退到 config.js 中的 AUTH_USERNAME/AUTH_PASSWORD
 */

const axios = require('axios');
const config = require('../config');

let cachedToken = null;
let cachedTokenUserId = null;
let cachedCredentials = null; // 缓存各平台凭证

/**
 * 从命令行参数提取值
 */
function getCliArg(key) {
  const arg = process.argv.find(a => a.startsWith(`--${key}=`));
  if (!arg) return null;
  return arg.split('=').slice(1).join('=');
}

/**
 * 登录后端获取 JWT Token
 * 优先使用命令行传入的 token，其次用 config 中的账号密码
 */
async function getAuthToken() {
  if (cachedToken) return cachedToken;

  // 1. 优先：命令行传入的 JWT Token（由 CrawlController 生成）
  const cliToken = getCliArg('auth-token');
  if (cliToken) {
    cachedToken = cliToken;
    const cliUserId = getCliArg('user-id');
    cachedTokenUserId = cliUserId ? parseInt(cliUserId, 10) : null;
    console.log(`  ✓ 使用后端传入的 JWT Token，userId=${cachedTokenUserId}`);
    return cachedToken;
  }

  // 2. 回退：config 中的账号密码（手动运行爬虫时使用）
  const res = await axios.post(`${config.BACKEND_URL}/api/auth/login`, {
    username: config.AUTH_USERNAME,
    password: config.AUTH_PASSWORD,
  });

  cachedToken = res.data.token;
  cachedTokenUserId = res.data.userId;
  console.log(`  ✓ 获取 JWT 成功（用户名密码登录），userId=${cachedTokenUserId}`);
  return cachedToken;
}

/**
 * 从后端获取各平台凭证
 * 缓存策略：整个爬虫生命周期只调用一次，避免频繁请求
 */
async function getPlatformCredentials() {
  if (cachedCredentials) return cachedCredentials;

  try {
    // 先获取 JWT
    const token = await getAuthToken();
    const res = await axios.get(`${config.BACKEND_URL}/api/settings/credentials`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    cachedCredentials = res.data || {};
    console.log('  ✓ 已加载平台凭证:', Object.keys(cachedCredentials).join(', ') || '无');
    return cachedCredentials;
  } catch (err) {
    console.warn(`  ⚠ 获取平台凭证失败: ${err.message}，将回退到环境变量`);
    cachedCredentials = {};
    return cachedCredentials;
  }
}

/**
 * 获取指定平台的凭证（优先级：后端 > 环境变量）
 */
async function getCredential(platform, envKey) {
  const allCreds = await getPlatformCredentials();
  const key = platform.toLowerCase();
  const backendCred = allCreds[key]?.credential;
  if (backendCred) return backendCred;
  return process.env[envKey] || '';
}

/**
 * 将源平台明确返回的凭证失效状态回报给后端。
 * 后端只标记授权过期，不删除用户已经捕获的 Inbox 数据。
 */
async function markCredentialInvalid(platform, reason = '') {
  try {
    const token = await getAuthToken();
    const res = await axios.post(
      `${config.BACKEND_URL}/api/settings/platforms/${platform}/credential-invalid`,
      { reason },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    cachedCredentials = null;
    console.error(`  ❗ ${res.data?.message || `${platform} 授权已标记为失效`}`);
    return true;
  } catch (error) {
    console.error(`  ⚠ 回报 ${platform} 授权失效状态失败: ${error.message}`);
    return false;
  }
}

/**
 * 写入单条数据到后端
 */
async function writeSingleItem(token, item, index, total) {
  try {
    await axios.post(`${config.BACKEND_URL}/api/inbox/items`, item, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return { success: true, index, title: item.title };
  } catch (err) {
    // 如果是 401/403，Token 可能过期，重新登录
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      console.log('  🔄 Token 过期，重新登录...');
      cachedToken = null;
      const newToken = await getAuthToken();
      try {
        await axios.post(`${config.BACKEND_URL}/api/inbox/items`, item, {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return { success: true, index, title: item.title };
      } catch {
        return { success: false, index, title: item.title, error: '重试仍失败' };
      }
    }
    return { success: false, index, title: item.title, error: err.message };
  }
}

/**
 * 批量写入信息项到后端（分批并行，每批 10 条）
 * @param {Array} items - 清洗后的数据项
 * @param {Function} getToken - 获取 JWT Token 的函数
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
async function batchWriteItems(items, getToken) {
  if (!items || items.length === 0) {
    console.log('  ⏭ 无数据需要写入');
    return { success: 0, failed: 0, errors: [] };
  }

  const token = await getToken();
  const BATCH_SIZE = 10;
  const errors = [];
  let totalSuccess = 0;
  let totalFailed = 0;

  // 分批并行写入
  for (let batchStart = 0; batchStart < items.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, items.length);
    const batch = items.slice(batchStart, batchEnd);
    
    const promises = batch.map((item, i) => 
      writeSingleItem(token, item, batchStart + i, items.length)
    );
    
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        totalSuccess++;
        console.log(`  [${result.value.index + 1}/${items.length}] ✓ ${result.value.title}`);
      } else {
        totalFailed++;
        const err = result.status === 'fulfilled' ? result.value : result.reason;
        const title = err?.title || '未知';
        const error = err?.error || err?.message || '未知错误';
        const index = err?.index ?? '?';
        errors.push({ index, title, error });
        console.error(`  [${index + 1}/${items.length}] ✗ ${title}: ${error}`);
      }
    }
  }

  return { success: totalSuccess, failed: totalFailed, errors };
}

module.exports = {
  getAuthToken,
  getPlatformCredentials,
  getCredential,
  markCredentialInvalid,
  batchWriteItems,
};
