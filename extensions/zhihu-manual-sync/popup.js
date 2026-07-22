const $ = (id) => document.getElementById(id);
const hint = $('hint');
const result = $('result');

function show(message, isError = false) {
  result.textContent = message;
  result.className = isError ? 'error' : 'success';
}

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

async function refreshStatus() {
  const status = await request({ type: 'GET_STATUS' });
  $('apiBase').value = status.apiBase;
  hint.textContent = status.loggedIn ? '已登录 InfoDigest，可同步当前页面。' : '请先登录 InfoDigest。';
}

$('login').addEventListener('click', async () => {
  try {
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) throw new Error('请填写用户名和密码');
    await request({ type: 'LOGIN', apiBase: $('apiBase').value.trim(), username, password });
    $('password').value = '';
    await refreshStatus();
    show('登录成功');
  } catch (error) { show(error.message, true); }
});

$('sync').addEventListener('click', async () => {
  try {
    show('正在读取当前页面…');
    const summary = await request({ type: 'SYNC_CURRENT_ZHIHU' });
    show(`识别 ${summary.found} 条；新增 ${summary.count || 0} 条，跳过 ${summary.skipped || 0} 条。`);
  } catch (error) { show(error.message, true); }
});

refreshStatus().catch((error) => show(error.message, true));
