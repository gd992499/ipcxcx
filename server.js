const express = require('express');
const app = express();

// Railway 必须使用这个端口
const PORT = process.env.PORT || 3000;

// 内存存储（Railway 可用）
const records = [];

// 根路径（用来判断服务是否活着）
app.get('/', (req, res) => {
  res.send('OK - service is running');
});

// 生成随机链接
app.get('/generate', (req, res) => {
  const token = Math.random().toString(36).slice(2, 10);
  const link = `${req.protocol}://${req.get('host')}/r/${token}`;
  res.json({ link });
});

// 访问链接并记录
app.get('/r/:token', (req, res) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;

  records.push({
    time: new Date().toISOString(),
    ip,
    token: req.params.token,
    ua: req.headers['user-agent']
  });

  res.send(`
    <h2>访问提示</h2>
    <p>本页面会记录访问 IP，用于技术学习与访问统计。</p>
  `);
});

// 后台查看（无密码，先保证能跑）
app.get('/admin', (req, res) => {
  const rows = records.map(r => `
    <tr>
      <td>${r.time}</td>
      <td>${r.ip}</td>
      <td>${r.token}</td>
      <td style="max-width:300px;word-break:break-all">${r.ua}</td>
    </tr>
  `).join('');

  res.send(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>后台</title>
<style>
body{font-family:Arial;padding:20px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:6px}
</style>
</head>
<body>

<h1>访问记录后台</h1>

<button onclick="gen()">生成随机链接</button>
<input id="link" style="width:100%;margin:10px 0" readonly>

<table>
<tr>
  <th>时间</th>
  <th>IP</th>
  <th>Token</th>
  <th>User-Agent</th>
</tr>
${rows}
</table>

<script>
function gen(){
  fetch('/generate')
    .then(r=>r.json())
    .then(d=>{
      link.value=d.link;
      link.select();
      document.execCommand('copy');
      alert('链接已生成并复制');
    });
}
</script>

</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
