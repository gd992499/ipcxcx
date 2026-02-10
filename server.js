const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");

const app = express();

/* ========= 基础配置 ========= */

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

/* ========= PostgreSQL ========= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* 初始化表 */
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      ip TEXT,
      user_agent TEXT,
      visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

/* ========= 中间件 ========= */

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "railway-secret",
    resave: false,
    saveUninitialized: false
  })
);

/* ========= 首页（记录访问） ========= */

app.get("/", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  const ua = req.headers["user-agent"];

  await pool.query(
    "INSERT INTO visits (ip, user_agent) VALUES ($1, $2)",
    [ip, ua]
  );

  res.send(`
    <h2>网站正常运行</h2>
    <p>这是一个访问统计测试页面</p>
  `);
});

/* ========= Admin 登录 ========= */

app.get("/admin", (req, res) => {
  if (req.session.admin) {
    res.redirect("/admin/dashboard");
    return;
  }

  res.send(`
    <h2>Admin 登录</h2>
    <form method="post">
      <input type="password" name="password" placeholder="密码" />
      <button>登录</button>
    </form>
  `);
});

app.post("/admin", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.send("密码错误");
  }
});

/* ========= Admin 面板 ========= */

app.get("/admin/dashboard", async (req, res) => {
  if (!req.session.admin) {
    res.redirect("/admin");
    return;
  }

  const result = await pool.query(
    "SELECT * FROM visits ORDER BY visit_time DESC LIMIT 100"
  );

  const rows = result.rows
    .map(
      v => `
      <tr>
        <td>${v.visit_time}</td>
        <td>${v.ip}</td>
        <td>${v.user_agent}</td>
      </tr>`
    )
    .join("");

  res.send(`
    <h2>访问记录</h2>
    <table border="1" cellpadding="6">
      <tr>
        <th>时间</th>
        <th>IP</th>
        <th>User-Agent</th>
      </tr>
      ${rows}
    </table>
    <br/>
    <a href="/admin/logout">退出</a>
  `);
});

/* ========= 退出 ========= */

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

/* ========= 启动 ========= */

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
