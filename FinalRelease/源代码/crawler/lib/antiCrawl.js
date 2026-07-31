/**
 * 反爬风控模块（Task 16 核心）
 * 包含：随机休眠、Cookie 失效检测、状态码捕获、指数退避重试
 */

const config = require('../config');

/**
 * 随机休眠（毫秒）
 * @param {number} min - 最小毫秒
 * @param {number} max - 最大毫秒
 */
function randomSleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 判断是否为 Cookie 失效
 */
function isCookieInvalid(status) {
  return config.COOKIE_INVALID_CODES.includes(status);
}

/**
 * 判断是否被限流
 */
function isRateLimited(status) {
  return config.RATE_LIMIT_CODES.includes(status);
}

/**
 * 带重试和风控的请求包装器
 * 
 * @param {Function} requestFn - 返回 Promise 的请求函数
 * @param {string} label - 日志标签
 * @param {Function} onCookieInvalid - Cookie 失效回调
 * @returns {Promise<any>}
 */
async function withRetry(requestFn, label = '', onCookieInvalid = null) {
  let lastError = null;

  for (let attempt = 0; attempt <= config.MAX_RETRIES; attempt++) {
    // 每次请求前随机休眠（第 0 次也休眠，模拟人类行为）
    if (attempt > 0) {
      const backoff = config.RETRY_DELAY_BASE * attempt * (0.5 + Math.random());
      console.log(`  ⏳ [${label}] 第 ${attempt} 次重试，等待 ${Math.round(backoff)}ms...`);
      await new Promise((r) => setTimeout(r, backoff));
    } else {
      await randomSleep(config.REQUEST_DELAY_MIN, config.REQUEST_DELAY_MAX);
    }

    try {
      return await requestFn();
    } catch (err) {
      lastError = err;

      // 检查 HTTP 状态码
      if (err.response) {
        const status = err.response.status;

        // Cookie 失效
        if (isCookieInvalid(status)) {
          console.error(`  ❌ [${label}] Cookie 已失效！状态码: ${status}`);
          if (onCookieInvalid) onCookieInvalid(status);
          throw new Error(`Cookie 失效 (HTTP ${status})`);
        }

        // 被限流
        if (isRateLimited(status)) {
          console.warn(
            `  ⚠️ [${label}] 被限流 (HTTP ${status})，冷却 ${config.RATE_LIMIT_COOLDOWN / 1000}s...`
          );
          await new Promise((r) => setTimeout(r, config.RATE_LIMIT_COOLDOWN));
          continue;
        }

        console.warn(`  ⚠️ [${label}] HTTP ${status}: ${err.response.statusText}`);
      } else {
        console.warn(`  ⚠️ [${label}] 网络异常: ${err.message}`);
      }

      if (attempt >= config.MAX_RETRIES) {
        console.error(`  ❌ [${label}] 已达最大重试次数，放弃`);
      }
    }
  }

  throw lastError;
}

module.exports = {
  randomSleep,
  isCookieInvalid,
  isRateLimited,
  withRetry,
};
