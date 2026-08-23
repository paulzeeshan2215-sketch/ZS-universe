const express = require("express");
const path = require("path");

const app = express();

/* =========================================================
   BASIC CONFIGURATION
========================================================= */

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

/* =========================================================
   SECURITY / BASIC SETTINGS
========================================================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "12mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "12mb"
  })
);

/* =========================================================
   DISABLE OLD PAGE CACHING
========================================================= */

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.setHeader(
    "Pragma",
    "no-cache"
  );

  res.setHeader(
    "Expires",
    "0"
  );

  next();
});

/* =========================================================
   SERVE PUBLIC FILES

   Your maintenance index.html must be inside:

   public/index.html
========================================================= */

app.use(
  express.static(
    PUBLIC_DIR,
    {
      index: false,
      etag: false,
      maxAge: 0
    }
  )
);

/* =========================================================
   WEBSITE UNDER MAINTENANCE

   Homepage:
   https://your-website.onrender.com/
========================================================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "index.html"
    )
  );
});

/* =========================================================
   OPTIONAL MAINTENANCE ALIAS
========================================================= */

app.get("/maintenance", (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "index.html"
    )
  );
});

/* =========================================================
   HEALTH CHECK

   Render can use this endpoint.
========================================================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    status: "maintenance",
    message:
      "SehrAn Media is currently under maintenance."
  });
});

/* =========================================================
   BLOCK OLD HOMEPAGE-STYLE ROUTES

   Remove these routes later when the website
   returns from maintenance.
========================================================= */

app.get("/home", (req, res) => {
  res.redirect("/");
});

app.get("/index", (req, res) => {
  res.redirect("/");
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>

    <html lang="en">

    <head>

      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>Page Not Found — SehrAn Media</title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-height: 100vh;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 20px;

          font-family:
            Arial,
            sans-serif;

          color: white;

          background:
            radial-gradient(
              circle at 20% 20%,
              rgba(124,92,255,.25),
              transparent 35%
            ),
            radial-gradient(
              circle at 80% 80%,
              rgba(0,212,255,.18),
              transparent 35%
            ),
            #07090f;
        }

        .box {
          width: min(
            600px,
            100%
          );

          text-align: center;

          padding: 45px 25px;

          border:
            1px solid
            rgba(255,255,255,.12);

          border-radius: 24px;

          background:
            rgba(15,18,28,.82);

          box-shadow:
            0 25px 80px
            rgba(0,0,0,.45);
        }

        h1 {
          margin: 0 0 15px;

          font-size:
            clamp(
              32px,
              7vw,
              60px
            );
        }

        p {
          color: #aab1c4;

          line-height: 1.7;
        }

        a {
          display: inline-block;

          margin-top: 20px;

          padding:
            12px 22px;

          border-radius: 12px;

          color: white;

          text-decoration: none;

          font-weight: 700;

          background:
            linear-gradient(
              90deg,
              #7c5cff,
              #00d4ff
            );
        }

      </style>

    </head>

    <body>

      <div class="box">

        <h1>404</h1>

        <p>
          This page is currently unavailable.
          SehrAn Media is undergoing maintenance.
        </p>

        <a href="/">
          Return to Website
        </a>

      </div>

    </body>

    </html>
  `);
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log(
    "=========================================="
  );

  console.log(
    "SehrAn Media server is running."
  );

  console.log(
    "Port:",
    PORT
  );

  console.log(
    "Website status: UNDER MAINTENANCE"
  );

  console.log(
    "=========================================="
  );
});
