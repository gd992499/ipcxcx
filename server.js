 const express = require('express');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const basicAuth = require('basic-auth');

const app = express();
const PORT = 3000;

app.set('trust proxy', true);

const DATA_FILE = './data.json';

// 后台账号密码
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

// 初始化数据文件
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// ========== 基础认证中间件 ==========
function auth(req, res, next) {
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentication required');
  }
  next();
}

// ========== 生成随机链接 ==========
app.get('/generate', (req, res) => {
  const token = uuidv4().replace(/-/g, '').slice(0, 8);
  const link = `http://localhost:${PORT}/r/${token}`;
  res.json({ link });
});

// ========== 访问记录 ==========
app.get('/r/:token', (req, res) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;

  const record = {
    token: req.params.token,
    ip,
    ua: req.headers['user-agent'],
    time: new Date().toLocaleString()
  };

  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  data.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  res.send(`
    <h2>访问提示</h2>
    <p>本页面会记录访问 IP，用于技术学习与访问统计。</p>
    <p>谢谢你的访问。</p>
 `);
});

// ========== 后台可视化 ==========
app.get('/admin', auth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));

  // IP 统计
  const ipCount = {};
  data.forEach(r => {
    ipCount[r.ip] = (ipCount[r.ip] || 0) + 1;
  });

  const rows = data.map(r => `
    <tr>
      <td>${r.time}</td>
      <td>${r.ip}</td>
      <td>${r.token}</td>
      <td style="max-width:300px;word-break:break-all">${r.ua}</td>
    </tr>
  `).join('');

  const ipStats = Object.entries(ipCount)
    .map(([ip, count]) => `<li>${ip}：${count} 次</li>`)
    .join('');

  res.send(`
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>访问记录后台</title>
<style>
body { font-family: Arial; padding: 20px; background: #f5f5f5; }
table { border-collapse: collapse; width: 100%; background: #fff; }
th, td { border: 1px solid #ccc; padding: 8px; }
th { background: #eee; }
button { padding: 8px 14px; cursor: pointer; }
input { width: 100%; padding: 6px; margin-top: 6px; }
.box { background:#fff; padding:15px; margin-bottom:20px; }
</style>
</head>
<body>

<h1>访问记录后台</h1>

<div class="box">
  <h2>生成随机访问链接</h2>
  <button onclick="gen()">生成链接</button>
  <input id="link" readonly placeholder="点击按钮生成链接">
</div>

<div class="box">
  <h2>IP 访问统计</h2>
  <ul>${ipStats || '<li>暂无数据</li>'}</ul>
</div>

<div class="box">
  <h2>详细访问记录</h2>
  <table>
    <tr>
      <th>时间</th>
      <th>IP</th>
      <th>Token</th>
      <th>User-Agent</th>
    </tr>
    ${rows}
  </table>
</div>

<script>
function gen() {
  fetch('/generate')
    .then(r => r.json())
    .then(d => {
      const input = document.getElementById('link');
      input.value = d.link;
      input.select();
      document.execCommand('copy');
      alert('链接已生成并复制');
    });
}
</script>

</body>
</html>
  `);
});
