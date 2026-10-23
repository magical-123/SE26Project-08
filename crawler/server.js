const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// 响应健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Crawler microservice is running' });
});

// 触发爬虫任务
app.post('/crawl', (req, res) => {
  const { platform, authToken, userId, limit } = req.body;

  const args = ['index.js'];
  
  if (platform && platform !== 'all') {
    args.push(`--platform=${platform}`);
  }
  
  if (authToken) {
    args.push(`--auth-token=${authToken}`);
  }
  
  if (userId) {
    args.push(`--user-id=${userId}`);
  }
  
  if (limit) {
    args.push(`--limit=${limit}`);
  }

  console.log(`[${new Date().toISOString()}] Triggering crawler task`);

  // 异步生成子进程执行爬虫
  const child = spawn('node', args, {
    cwd: __dirname,
    stdio: 'inherit' // 直接将日志输出到微服务的 stdout，方便 docker-compose logs 查看
  });

  child.on('error', (err) => {
    console.error(`[Crawler Error] Failed to start crawler: ${err.message}`);
  });

  child.on('close', (code) => {
    console.log(`[Crawler Exited] Process exited with code ${code}`);
  });

  // 不阻塞，立刻返回成功
  res.json({ 
    status: 'started', 
    message: 'Crawler process spawned successfully'
  });
});

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Crawler microservice listening on port ${port}`);
  });
}

module.exports = app;
