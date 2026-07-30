import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import {
  cacheData,
  getCachedData,
  clearCache,
  clearAllCache,
} from '../utils/cache.js';
import {
  setGlobalOffline,
  getGlobalOffline,
  onGlobalOfflineChange,
  checkConnection,
} from '../utils/offlineStore.js';

// =====================================================
// cache.js — 缓存工具
// =====================================================
describe('cache.js — 缓存工具', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('cacheData stores data in localStorage with correct prefix', () => {
    cacheData('testKey', { foo: 'bar' });

    const raw = localStorage.getItem('infodigest_cache_testKey');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw);
    expect(parsed.data).toEqual({ foo: 'bar' });
    expect(parsed.cachedAt).toBeTypeOf('number');
    expect(parsed.expiresAt).toBeTypeOf('number');
  });

  test('getCachedData retrieves stored data', () => {
    cacheData('myKey', { hello: 'world' });

    const result = getCachedData('myKey');
    expect(result).toEqual({ hello: 'world' });
  });

  test('getCachedData returns null for expired data', () => {
    const payload = {
      data: 'old data',
      cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() - 24 * 60 * 60 * 1000, // 已过期
    };
    localStorage.setItem('infodigest_cache_expired', JSON.stringify(payload));

    const result = getCachedData('expired');
    expect(result).toBeNull();

    // 过期的条目应从 localStorage 中移除
    expect(localStorage.getItem('infodigest_cache_expired')).toBeNull();
  });

  test('getCachedData returns null for non-existent key', () => {
    const result = getCachedData('nonexistent');
    expect(result).toBeNull();
  });

  test('clearCache removes specific key', () => {
    cacheData('key1', 'value1');
    cacheData('key2', 'value2');

    clearCache('key1');

    expect(getCachedData('key1')).toBeNull();
    expect(getCachedData('key2')).toEqual('value2');
  });

  test('clearAllCache removes all prefixed keys but not others', () => {
    cacheData('a', 1);
    cacheData('b', 2);
    localStorage.setItem('other_key', 'keep me');

    clearAllCache();

    expect(getCachedData('a')).toBeNull();
    expect(getCachedData('b')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('keep me');
  });

  test('cacheData handles localStorage full gracefully (console.warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 通过 Storage.prototype 拦截 setItem（jsdom 中 localStorage.setItem 位于原型上）
    const origProtoSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });

    cacheData('big', 'too much data');

    expect(warnSpy).toHaveBeenCalledWith(
      '[Cache] 写入失败:',
      'big',
      'QuotaExceededError',
    );

    Storage.prototype.setItem = origProtoSetItem;
    warnSpy.mockRestore();
  });

  test('cacheData with custom TTL', () => {
    cacheData('short', 'data', 1); // 1 天 TTL

    const raw = localStorage.getItem('infodigest_cache_short');
    const parsed = JSON.parse(raw);

    const expectedExpiry = parsed.cachedAt + 1 * 24 * 60 * 60 * 1000;
    expect(parsed.expiresAt).toBe(expectedExpiry);
  });
});

// =====================================================
// offlineStore.js — 全局离线状态
// =====================================================
describe('offlineStore.js — 全局离线状态', () => {
  beforeEach(() => {
    // 将离线状态重置为 false
    setGlobalOffline(false);
    // 默认 navigator.onLine 为 true
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test('setGlobalOffline(true) dispatches event with detail.offline=true', () => {
    const handler = vi.fn();
    window.addEventListener('app:offline', handler);

    setGlobalOffline(true);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { offline: true },
      }),
    );
  });

  test('setGlobalOffline(false) dispatches event with detail.offline=false', () => {
    // 先将状态设为 true，再测 false 的派发
    setGlobalOffline(true);

    const handler = vi.fn();
    window.addEventListener('app:offline', handler);

    setGlobalOffline(false);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { offline: false },
      }),
    );
  });

  test('setGlobalOffline same value does not dispatch again', () => {
    // 当前为 false（已在 beforeEach 重置）
    const handler = vi.fn();
    window.addEventListener('app:offline', handler);

    setGlobalOffline(false); // 相同值，不应派发

    expect(handler).not.toHaveBeenCalled();
  });

  test('getGlobalOffline returns current state', () => {
    expect(getGlobalOffline()).toBe(false);

    setGlobalOffline(true);
    expect(getGlobalOffline()).toBe(true);

    setGlobalOffline(false);
    expect(getGlobalOffline()).toBe(false);
  });

  test('onGlobalOfflineChange registers listener and unsubscribe works', () => {
    const handler = vi.fn();
    const unsubscribe = onGlobalOfflineChange(handler);

    // 注册后，setGlobalOffline 应触发 handler
    setGlobalOffline(true);
    expect(handler).toHaveBeenCalledWith(true);

    // 取消订阅
    unsubscribe();

    // 继续设定变化，handler 不应再被调用
    setGlobalOffline(false);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(true);
  });

  test('checkConnection with navigator.onLine=false sets offline immediately', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const handler = vi.fn();
    window.addEventListener('app:offline', handler);

    checkConnection();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { offline: true } }),
    );
    expect(getGlobalOffline()).toBe(true);
  });

  test('checkConnection with optimistic=true sets offline then pings', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    checkConnection({ optimistic: true });

    // 乐观标记：立即设为离线
    expect(getGlobalOffline()).toBe(true);

    // 等待 fetch .then 微任务执行
    await vi.runAllTimersAsync();

    // ping 成功，恢复在线
    expect(getGlobalOffline()).toBe(false);
    vi.useRealTimers();
  });

  test('checkConnection with optimistic=false only sets offline on ping failure', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    checkConnection({ optimistic: false });

    // 非乐观模式，尚未标记离线
    expect(getGlobalOffline()).toBe(false);

    // 等待 fetch .catch 微任务执行
    await vi.runAllTimersAsync();

    // ping 失败后设为离线
    expect(getGlobalOffline()).toBe(true);
    vi.useRealTimers();
  });
});
