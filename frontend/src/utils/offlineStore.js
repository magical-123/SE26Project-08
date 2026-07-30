/**
 * 全局离线状态存储 — 由 RootLayout 在刷新/页面切换时检测
 */

const OFFLINE_EVENT = 'app:offline';
const PING_URL = '/api/health/db';

let _offline = false;

/**
 * 设置/清除全局离线状态
 */
export function setGlobalOffline(offline) {
  if (_offline === offline) return;
  _offline = offline;
  window.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail: { offline } }));
}

/**
 * 获取当前全局离线状态
 */
export function getGlobalOffline() {
  return _offline;
}

/**
 * 监听全局离线状态变化
 * @returns {() => void} unsubscribe
 */
export function onGlobalOfflineChange(handler) {
  const listener = (e) => handler(e.detail.offline);
  window.addEventListener(OFFLINE_EVENT, listener);
  return () => window.removeEventListener(OFFLINE_EVENT, listener);
}

/**
 * 检测连接状态。
 * @param {Object} [options]
 * @param {boolean} [options.optimistic=true] - 是否先乐观标记离线（刷新用 true，页面切换用 false）
 *
 * - 刷新时乐观标记 → banner 秒出，ping 成功再清除
 * - 页面切换时不乐观标记 → 不闪，ping 失败才显示
 */
export function checkConnection(options = {}) {
  const { optimistic = true } = options;

  // 浏览器明确离线 → 立即标记（无论是否 optimistic）
  if (!navigator.onLine) {
    setGlobalOffline(true);
    return;
  }

  // 刷新场景：先乐观标记，等 ping 确认
  if (optimistic) {
    setGlobalOffline(true);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  fetch(PING_URL, { method: 'GET', signal: controller.signal })
    .then(res => {
      clearTimeout(timeout);
      setGlobalOffline(!res.ok);
    })
    .catch(() => {
      clearTimeout(timeout);
      // optimistic 模式下已标记离线，非 optimistic 模式下在此标记
      if (!optimistic) setGlobalOffline(true);
    });
}
