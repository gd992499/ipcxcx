const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== 配置 ======
const ADMIN_PASSWORD = "123456"; // ← 你可以改成自己的

// ====== 中间件 ======
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "railway-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// ====== 内存访问记录（演示用） ======
const visitLogs = [];

// ====== 主页（任何人访问） ======
app.get("/", (req, res) => {
  visitLogs.push({
    time: new Date().toLocaleString(),
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    ua: req.headers["user-agent"],
  });

  res.send(`
    <h2>网站正常运行</h2>
    <p>这是一个测试页面</p>
  `);
});

// ====== Admin 登录页 ======
app.get("/admin", (req, res) => {
  if (req.session.loggedIn) {
    return res.redirect("/admin/dashboard");
  }

  res.send(`
    <h2>Admin Login</h2>
    <form method="post" action="/admin/login">
      <input type="password" name="password" placeholder="Admin Password"/>
      <button type="submit">Login</button>
    </form>
  `);
});

// ====== 处理登录 ======
app.post("/admin/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect("/admin/dashboard");
  } else {
    res.send("密码错误");
  }
});

// ====== Admin 后台 ======
app.get("/admin/dashboard", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/admin");
  }

  const rows = visitLogs
    .map(
      (v, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${v.time}</td>
          <td>${v.ip}</td>
          <td>${v.ua}</td>
        </tr>`
    )
    .join("");

  res.send(`
    <h2>访问记录</h2>
    <table border="1" cellpadding="5">
      <tr>
        <th>#</th>
        <th>时间</th>
        <th>IP</th>
        <th>User-Agent</th>
      </tr>
      ${rows}
    </table>
    <br/>
    <a href="/admin/logout">退出登录</a>
  `);
});

// ====== 退出 ======
app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin");
  });
});

// ====== 启动服务（⚠️关键） ======
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
