const $ = (id) => document.getElementById(id);
const result = $('result');
function show(text, error = false) { result.textContent = text; result.className = error ? 'error' : 'success'; }
async function call(message) { const response = await chrome.runtime.sendMessage(message); if (!response.ok) throw new Error(response.error); return response.result; }
async function refresh() { const status = await call({ type: 'STATUS' }); $('apiBase').value = status.apiBase; $('hint').textContent = status.loggedIn ? '已登录 InfoDigest，可同步当前页面。' : '请先登录 InfoDigest。'; }
$('login').addEventListener('click', async () => { try { const username = $('username').value.trim(), password = $('password').value; if (!username || !password) throw new Error('请填写用户名和密码'); await call({ type: 'LOGIN', apiBase: $('apiBase').value.trim(), username, password }); $('password').value = ''; await refresh(); show('登录成功'); } catch (error) { show(error.message, true); } });
$('sync').addEventListener('click', async () => { try { show('正在读取当前页面…'); const summary = await call({ type: 'SYNC' }); show(`识别 ${summary.found} 条；新增 ${summary.count || 0} 条，跳过 ${summary.skipped || 0} 条。`); } catch (error) { show(error.message, true); } });
refresh().catch((error) => show(error.message, true));
