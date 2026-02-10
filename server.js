import express from 'express';
import session from 'express-session';
import pkg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pkg;
const app = express();

/* ======================
   基础配置
====================== */

const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD not set');
  process.exit(1);
}

/* ======================
   数据库（Railway 官方方式）
====================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* 不在启动时强连数据库，避免直接崩 */

/* ======================
   中间件
====================== */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: 'railway-secret',
    resave: false,
    saveUninitialized: false
  })
);

/* ======================
   初始化表（安全写法）
====================== */

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id UUID PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      link_id UUID,
      ip TEXT,
      ua TEXT,
      visited_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

initDB().catch(err => {
  console.error('DB init error:', err.message);
});

/* ======================
   生成随机链接
====================== */

app.get('/generate', async (req, res) => {
  const id = uuidv4();
  await pool.query('INSERT INTO links (id) VALUES ($1)', [id]);
  res.send(`生成成功：${req.protocol}://${req.get('host')}/r/${id}`);
});

/* ======================
   访问记录（IP / UA）
====================== */

app.get('/r/:id', async (req, res) => {
  const linkId = req.params.id;
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';

  await pool.query(
    'INSERT INTO visits (link_id, ip, ua) VALUES ($1, $2, $3)',
    [linkId, ip, ua]
  );

  res.send('OK');
});

/* ======================
   Admin 登录
====================== */

app.get('/admin/login', (req, res) => {
  res.send(`
    <form method="post">
      <input type="password" name="password" placeholder="Admin Password"/>
      <button>Login</button>
    </form>
  `);
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin');
  } else {
    res.send('密码错误');
  }
});

/* ======================
   Admin 后台
====================== */

app.get('/admin', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin/login');

  const { rows } = await pool.query(`
    SELECT visited_at, ip, ua, link_id
    FROM visits
    ORDER BY visited_at DESC
    LIMIT 100
  `);

  const html = rows
    .map(
      r =>
        `<tr>
          <td>${r.visited_at}</td>
          <td>${r.ip}</td>
          <td>${r.ua}</td>
          <td>${r.link_id}</td>
        </tr>`
    )
    .join('');

  res.send(`
    <h2>访问记录</h2>
    <table border="1">
      <tr><th>时间</th><th>IP</th><th>UA</th><th>Link</th></tr>
      ${html}
    </table>
  `);
});

/* ======================
   健康检查（防止 Railway 杀进程）
====================== */

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('ok');
  } catch {
    res.status(500).send('db error');
  }
});

/* ======================
   启动
====================== */

app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});
