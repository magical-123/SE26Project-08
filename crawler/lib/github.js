/**
 * GitHub API 封装
 * 负责：Token 鉴权、拉取 Star 仓库、个人仓库、贡献记录
 * 
 * GitHub 使用 Personal Access Token（非 Cookie），在 Settings → Developer settings 创建
 */

const axios = require('axios');

/**
 * 创建携带 GitHub Token 的请求客户端
 */
function createGitHubClient(token) {
  return axios.create({
    baseURL: 'https://api.github.com',
    timeout: 15000,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'InfoDigest-Crawler/1.0',
    },
  });
}

/**
 * 校验 Token 是否有效
 */
async function validateToken(client) {
  try {
    const res = await client.get('/user');
    return { valid: res.status === 200 && Boolean(res.data?.login), credentialInvalid: res.status === 401, reason: `GitHub API 返回 HTTP ${res.status}` };
  } catch (err) {
    const status = err.response?.status;
    return { valid: false, credentialInvalid: status === 401, reason: status ? `GitHub API 返回 HTTP ${status}` : `GitHub Token 校验失败: ${err.message}` };
  }
}

/**
 * 获取用户 Starred 仓库（反映关注的领域）
 */
async function fetchStarredRepos(client, options = {}) {
  const { page = 1, perPage = options.limit || 30 } = options;

  const res = await client.get('/user/starred', {
    params: { page, per_page: perPage, sort: 'created', direction: 'desc' },
  });

  return (res.data || []).map(formatRepo);
}

/**
 * 获取用户自己的仓库（反映项目方向）
 */
async function fetchUserRepos(client, username, options = {}) {
  const { page = 1, perPage = 30 } = options;

  const res = await client.get(`/users/${username}/repos`, {
    params: { page, per_page: perPage, sort: 'updated', direction: 'desc' },
  });

  const repos = (res.data || []).map(formatRepo);
  const hasMore = repos.length === perPage;

  return { items: repos, hasMore, nextPage: hasMore ? page + 1 : null };
}

/**
 * 获取用户近期公开活动
 * 抓取 Starred 时间线（通过事件 API）
 */
async function fetchUserEvents(client, username, options = {}) {
  const { page = 1, perPage = 30 } = options;

  const res = await client.get(`/users/${username}/events/public`, {
    params: { page, per_page: perPage },
  });

  const events = (res.data || []).map(formatEvent);
  const hasMore = events.length === perPage;

  return { items: events, hasMore, nextPage: hasMore ? page + 1 : null };
}

/**
 * 获取仓库的 README 内容（作为全文语料）
 */
async function fetchRepoReadme(client, owner, repo) {
  try {
    const res = await client.get(`/repos/${owner}/${repo}/readme`, {
      headers: { Accept: 'application/vnd.github.raw+json' },
    });
    // raw 模式返回的是 markdown 文本
    if (typeof res.data === 'string') {
      return res.data.substring(0, 4000);
    }
    // 也可能是 base64 编码的内容
    if (res.data?.content) {
      return Buffer.from(res.data.content, 'base64').toString('utf-8').substring(0, 4000);
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * 获取仓库的话题标签
 */
async function fetchRepoTopics(client, owner, repo) {
  try {
    const res = await client.get(`/repos/${owner}/${repo}/topics`, {
      headers: { Accept: 'application/vnd.github.mercy-preview+json' },
    });
    return res.data?.names || [];
  } catch {
    return [];
  }
}

// ===== 格式化 =====

function formatRepo(repo) {
  return {
    title: repo.full_name || repo.name || '未知仓库',
    url: repo.html_url || '',
    author: repo.owner?.login || '',
    owner: repo.owner?.login || '',
    description: repo.description || '',
    language: repo.language || '',
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    topics: repo.topics || [],
    pushedAt: repo.pushed_at || repo.updated_at || null,
    platform: 'GITHUB',
    contentType: 'repository',
  };
}

function formatEvent(event) {
  const repo = event.repo?.name || '';
  return {
    title: `${formatEventType(event.type)}: ${repo}`,
    url: event.repo?.url
      ? `https://github.com/${repo}`
      : '',
    repoName: repo,
    eventType: event.type,
    description: event.payload?.action
      ? `${event.type} → ${event.payload.action}`
      : event.type,
    language: '',
    stars: 0,
    forks: 0,
    topics: [],
    pushedAt: event.created_at || null,
    platform: 'GITHUB',
    contentType: 'event',
  };
}

function formatEventType(type) {
  const map = {
    WatchEvent: '⭐ Starred',
    PushEvent: '📤 提交代码',
    CreateEvent: '🆕 创建',
    ForkEvent: '🍴 Fork',
    IssuesEvent: '📝 Issue',
    PullRequestEvent: '🔀 PR',
    ReleaseEvent: '🚀 发布',
  };
  return map[type] || type;
}

module.exports = {
  createGitHubClient,
  validateToken,
  fetchStarredRepos,
  fetchUserRepos,
  fetchUserEvents,
  fetchRepoReadme,
  fetchRepoTopics,
};
