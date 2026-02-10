const express = require('express');
const { v4: uuidv4 } = require('uuid');
const basicAuth = require('basic-auth');

const app = express();
app.set('trust proxy', true);

// Railway 必须用这个端口
const PORT = process.env.PORT || 3000;

// ===== 内存存储（Railway 可用）=====
const records = [];

// 后台账号密码
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

// 基础认证
function auth(req, res, next) {
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Auth required');
  }
  next();
}

// 生成随机链接
app.get('/generate', (req, res) => {
  const token = uuidv4().replace(/-/g, '').slice(0, 8);
  const link = `${req.protocol}://${req.get('host')}/r/${token}`;
  res.json({ link });
});

// 访问链接
app.get('/r/:token', (req, res) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;

  records.push({
    time: new Date().toLocaleString(),
    ip,
    token: req.params.token,
    ua: req.headers['user-agent']
  });

  res.send(`
    <h2>访问提示</h2>
    <p>本页面会记录访问 IP，用于技术学习与访问统计。</p>
  `);
});

// 后台
app.get('/admin', auth, (req, res) => {
  const ipCount = {};
  records.forEach(r => {
    ipCount[r.ip] = (ipCount[r.ip] || 0) + 1;
  });

  const rows = records.map(r => `
    <tr>
      <td>${r.time}</td>
      <td>${r.ip}</td>
      <td>${r.token}</td>
      <td style="max-width:300px;word-break:break-all">${r.ua}</td>
    </tr>
  `).join('');

  const stats = Object.entries(ipCount)
    .map(([ip, c]) => `<li>${ip}：${c} 次</li>`)
    .join('');

  res.send(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>后台</title>
<style>
body{font-family:Arial;padding:20px;background:#f5f5f5}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #ccc;padding:6px}
.box{background:#fff;padding:15px;margin-bottom:20px}
</style>
</head>
<body>

<h1>访问记录后台</h1>

<div class="box">
  <button onclick="gen()">生成随机链接</button>
  <input id="link" style="width:100%;margin-top:6px" readonly>
</div>

<div class="box">
  <h3>IP 统计</h3>
  <ul>${stats || '<li>暂无数据</li>'}</ul>
</div>

<div class="box">
<table>
<tr><th>时间</th><th>IP</th><th>Token</th><th>UA</th></tr>
${rows}
</table>
</div>

<script>
function gen(){
  fetch('/generate').then(r=>r.json()).then(d=>{
    link.value=d.link;
    link.select();
    document.execCommand('copy');
    alert('链接已复制');
  })
}
</script>

</body>
</html>
`);
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
