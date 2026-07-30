/**
 * 前端缓存工具 — 7 天本地缓存，用于后端不可用时的降级兜底
 *
 * 用法:
 *   import { cacheData, getCachedData } from '../../utils/cache';
 *   cacheData('dashboard', { nutrition: [...], ... });
 *   const data = getCachedData('dashboard');
 */

const CACHE_PREFIX = 'infodigest_cache_';
const DEFAULT_TTL_DAYS = 7;

/**
 * 写入缓存
 * @param {string} key 缓存键名
 * @param {*} data 任意可序列化的数据
 * @param {number} ttlDays 过期天数，默认 7 天
 */
export function cacheData(key, data, ttlDays = DEFAULT_TTL_DAYS) {
  try {
    const payload = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch (e) {
    // localStorage 存满或不可用时静默忽略
    console.warn('[Cache] 写入失败:', key, e?.message);
  }
}

/**
 * 读取缓存，过期返回 null
 * @param {string} key 缓存键名
 * @returns {*|null} 缓存数据或 null
 */
export function getCachedData(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (Date.now() > payload.expiresAt) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return payload.data;
  } catch (e) {
    return null;
  }
}

/**
 * 清除指定缓存
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {}
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}