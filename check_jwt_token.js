// 在浏览器开发者工具的Console中运行以下代码来检查JWT token

// 1. 获取当前token
const token = sessionStorage.getItem('token');
console.log('当前Token:', token);

// 2. 解析JWT token（JWT格式是 header.payload.signature）
if (token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token Payload:', payload);
        console.log('用户名:', payload.sub || payload.username);
        console.log('Token过期时间:', new Date(payload.exp * 1000));
    } catch (e) {
        console.error('Token解析失败:', e);
    }
}

// 3. 检查当前用户名
console.log('SessionStorage中的用户名:', sessionStorage.getItem('username'));

// 4. 测试API调用
fetch('http://localhost:8080/api/dashboard/summary', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => {
    console.log('Dashboard Summary API返回:', data);
})
.catch(err => console.error('API调用失败:', err));
