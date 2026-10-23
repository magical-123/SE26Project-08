const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const childProcess = require('node:child_process');

test('crawler forwards the token but keeps it out of logs and responses', async () => {
  const token = randomUUID();
  const calls = [];
  const logs = [];
  const spawnMock = mock.method(childProcess, 'spawn', (...args) => {
    calls.push(args);
    return new EventEmitter();
  });
  const logMock = mock.method(console, 'log', (...args) => logs.push(args.join(' ')));
  const app = require('../server.js');
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${url}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'bilibili', authToken: token, userId: 1 }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'started');
    assert.ok(calls[0][1].includes(`--auth-token=${token}`));
    assert.ok(!JSON.stringify(body).includes(token));
    assert.ok(!logs.join('\n').includes(token));
    assert.equal((await fetch(`${url}/health`)).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    spawnMock.mock.restore();
    logMock.mock.restore();
  }
});
