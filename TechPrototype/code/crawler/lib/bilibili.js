/**
 * B 站 API 封装
 * 负责：Cookie 鉴权、拉取历史记录/点赞/收藏、获取视频详情、CC 字幕提取
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
 * 校验 Cookie 是否有效，返回 { valid, mid }
 * 通过调用需要登录的接口来判断
 */
async function validateCookie(client) {
  try {
    const res = await client.get('/x/web-interface/nav');
    const data = res.data;
    return {
      valid: data.code === 0 && data.data && data.data.isLogin,
      mid: data?.data?.mid || null,
    };
  } catch {
    return { valid: false, mid: null };
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
 * 获取用户点赞的视频列表
 * @param {Object} client - axios 实例
 * @param {number} mid - 用户 mid
 * @param {Object} options - { pn, ps }
 */
async function fetchLikedVideos(client, mid, options = {}) {
  const { pn = 1, ps = 10 } = options;

  const res = await client.get('/x/space/like/video', {
    params: { vmid: mid, pn, ps },
  });
  const body = res.data;

  if (body.code !== 0) {
    throw new Error(`B 站点赞 API 返回错误: code=${body.code}, message=${body.message}`);
  }

  const list = body.data?.list || [];
  const page = body.data?.page || {};

  return {
    items: list.map(v => ({
      title: v.title || '无标题',
      aid: v.aid,
      author: v.author || v.owner?.name || '',
      pic: v.pic || '',
    })),
    count: page.count || list.length,
  };
}

/**
 * 获取用户创建的收藏夹列表
 * @param {Object} client - axios 实例
 * @param {number} mid - 用户 mid
 */
async function fetchFavoriteFolders(client, mid) {
  const res = await client.get('/x/v3/fav/folder/created/list', {
    params: { up_mid: mid, pn: 1, ps: 10 },
  });
  const body = res.data;

  if (body.code !== 0) {
    throw new Error(`B 站收藏夹列表 API 返回错误: code=${body.code}, message=${body.message}`);
  }

  const list = body.data?.list || [];
  return list.map(f => ({
    id: f.id,
    title: f.title || '默认收藏夹',
    count: f.media_count || 0,
  }));
}

/**
 * 获取收藏夹中的视频列表
 * @param {Object} client - axios 实例
 * @param {number} mediaId - 收藏夹 ID
 * @param {Object} options - { pn, ps }
 */
async function fetchFavoriteResources(client, mediaId, options = {}) {
  const { pn = 1, ps = 20 } = options;

  const res = await client.get('/x/v3/fav/resource/list', {
    params: { media_id: mediaId, pn, ps, platform: 'web' },
  });
  const body = res.data;

  if (body.code !== 0) {
    throw new Error(`B 站收藏夹内容 API 返回错误: code=${body.code}, message=${body.message}`);
  }

  const medias = body.data?.medias || [];
  const info = body.data?.info || {};

  return {
    items: medias.map(m => ({
      title: m.title || '无标题',
      aid: m.id,
      author: m.upper?.name || '',
      intro: m.intro || '',
    })),
    hasMore: body.data?.has_more || false,
    total: info.media_count || medias.length,
  };
}

/**
 * 获取用户单个视频详细信息（含 CC 字幕列表）
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
  fetchLikedVideos,
  fetchFavoriteFolders,
  fetchFavoriteResources,
  fetchVideoInfo,
  fetchSubtitleList,
  fetchSubtitleText,
};
