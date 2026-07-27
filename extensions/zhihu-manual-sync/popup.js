const $ = (id) => document.getElementById(id);
const result = $('result');

function show(message, isError = false) {
  result.textContent = message;
  result.className = isError ? 'error' : 'success';
}

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '扩展通信失败');
  return response.result;
}

async function refreshStatus() {
  const status = await request({ type: 'GET_STATUS' });
  $('apiBase').value = status.apiBase;
  $('hint').textContent = status.loggedIn
    ? '已登录 InfoDigest。打开知乎详情页后将每 5 秒自动记录。'
    : '请先登录 InfoDigest，登录状态会安全保存在扩展中。';
}

$('login').addEventListener('click', async () => {
  try {
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) throw new Error('请填写用户名和密码');
    await request({ type: 'LOGIN', apiBase: $('apiBase').value.trim(), username, password });
    $('password').value = '';
    await refreshStatus();
    show('登录成功，自动记录已启用');
  } catch (error) {
    show(error.message, true);
  }
});

$('sync').addEventListener('click', async () => {
  try {
    show('正在识别当前知乎详情页…');
    const captured = await request({ type: 'CAPTURE_CURRENT' });
    show(captured.created
      ? `已新增当前内容，开始记录浏览时长（${captured.watchDurationSeconds} 秒）`
      : `已更新当前内容，累计浏览 ${captured.watchDurationSeconds} 秒`);
  } catch (error) {
    show(error.message, true);
  }
});

refreshStatus().catch((error) => show(error.message, true));
