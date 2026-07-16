/**
 * B 站 API 封装
 * 负责：Cookie 鉴权、拉取历史记录、获取视频详情、CC 字幕提取
 */

const axios = require('axios');

/**
 * 创建携带 Cookie 的 B 站请求客户端
 */
function createBilibiliClient(cookie) {
  return axios.create({
    baseURL: 'https://api.bilibili.com',
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com',
      Cookie: cookie,
    },
  });
}

/**
 * 校验 Cookie 是否有效
 * 通过调用需要登录的接口来判断
 */
async function validateCookie(client) {
  try {
    const res = await client.get('/x/web-interface/nav');
    const data = res.data;
    return data.code === 0 && data.data && data.data.isLogin;
  } catch {
    return false;
  }
}

/**
 * 获取用户观看历史记录
 * @param {Object} client - axios 实例
 * @param {Object} options - { maxId, viewAt, ps }
 * @returns {Promise<{items: Array, hasMore: boolean, nextMaxId: number|null}>}
 */
async function fetchHistory(client, options = {}) {
  const { maxId = 0, viewAt = 0, ps = 20 } = options;

  const params = {
    max: maxId,
    view_at: viewAt,
    type: 'all',
    ps,
  };

  const res = await client.get('/x/web-interface/history/cursor', { params });
  const body = res.data;

  if (body.code !== 0) {
    throw new Error(`B 站 API 返回错误: code=${body.code}, message=${body.message}`);
  }

  const list = body.data?.list || [];
  const cursor = body.data?.cursor || {};

  return {
    items: list,
    hasMore: cursor.has_more || false,
    nextMaxId: cursor.max || null,
    nextViewAt: cursor.view_at || null,
  };
}

/**
 * 获取单个视频详细信息（含 CC 字幕列表）
 */
async function fetchVideoInfo(client, aid) {
  const res = await client.get('/x/web-interface/view', {
    params: { aid },
  });
  const body = res.data;

  if (body.code !== 0) {
    throw new Error(`获取视频详情失败: aid=${aid}, code=${body.code}`);
  }

  return body.data || {};
}

/**
 * 获取视频 CC 字幕列表
 */
async function fetchSubtitleList(client, aid, cid) {
  const res = await client.get('/x/player/v2', {
    params: { aid, cid },
  });
  const body = res.data;

  if (body.code !== 0) return [];

  const subtitles = body.data?.subtitle?.subtitles || [];
  return subtitles.map((sub) => ({
    id: sub.id,
    lan: sub.lan_doc || sub.lan,
    url: sub.subtitle_url ? 'https:' + sub.subtitle_url : null,
  }));
}

/**
 * 下载并解析 CC 字幕内容（JSON 格式）
 */
async function fetchSubtitleText(client, subtitleUrl) {
  if (!subtitleUrl) return '';

  try {
    const res = await axios.get(subtitleUrl, { timeout: 10000 });
    if (Array.isArray(res.data?.body)) {
      return res.data.body.map((item) => item.content).join('\n');
    }
    return '';
  } catch {
    return '';
  }
}

module.exports = {
  createBilibiliClient,
  validateCookie,
  fetchHistory,
  fetchVideoInfo,
  fetchSubtitleList,
  fetchSubtitleText,
};
