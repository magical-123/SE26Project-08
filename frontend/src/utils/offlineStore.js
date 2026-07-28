/**
 * 全局离线状态存储 — 由 RootLayout 在刷新/页面切换时检测
 */

const OFFLINE_EVENT = 'app:offline';
const PING_URL = '/api/ping';

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
 * 检测连接状态：ping /api/ping，根据结果设置离线状态
 * 在页面刷新或切换页面时调用
 */
export function checkConnection() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  fetch(PING_URL, { method: 'GET', signal: controller.signal })
    .then(res => {
      clearTimeout(timeout);
      setGlobalOffline(!res.ok);
    })
    .catch(() => {
      clearTimeout(timeout);
      setGlobalOffline(true);
    });
}
