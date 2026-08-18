const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

const UPLOADS_DIR =
  path.join(PUBLIC_DIR, "uploads");

const PRIVATE_DIR =
  path.join(__dirname, "private");

const MOVIES_DIR =
  path.join(PRIVATE_DIR, "movies");

const STORE =
  path.join(__dirname, "orders.json");

const MOVIES_STORE =
  path.join(__dirname, "movies.json");

const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  "CHANGE_THIS_ADMIN_KEY";

const TG_BOT_TOKEN =
  process.env.TG_BOT_TOKEN || "";

const TG_CHAT_ID =
  process.env.TG_CHAT_ID || "";

const ADMIN_URL =
  process.env.ADMIN_URL || "";


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_SCREENSHOT_SIZE =
  5 * 1024 * 1024;

const MAX_MOVIE_SIZE =
  5 * 1024 * 1024 * 1024;

const VALID_PROMO_CODE =
  "ZEESHAN10";


/* =========================================================
   DIRECTORIES / FILES
========================================================= */

for (const dir of [
  PUBLIC_DIR,
  UPLOADS_DIR,
  PRIVATE_DIR,
  MOVIES_DIR
]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
}

if (!fs.existsSync(STORE)) {
  fs.writeFileSync(
    STORE,
    "[]",
    "utf8"
  );
}

if (!fs.existsSync(MOVIES_STORE)) {
  fs.writeFileSync(
    MOVIES_STORE,
    "[]",
    "utf8"
  );
}


/* =========================================================
   BODY PARSERS
========================================================= */

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
   STATIC PUBLIC FILES
========================================================= */

app.use(
  express.static(PUBLIC_DIR)
);


/* =========================================================
   JSON HELPERS
========================================================= */

function readOrders() {

  try {

    const data =
      fs.readFileSync(
        STORE,
        "utf8"
      );

    if (!data.trim()) {
      return [];
    }

    const orders =
      JSON.parse(data);

    return Array.isArray(orders)
      ? orders
      : [];

  } catch (error) {

    console.error(
      "Orders read error:",
      error
    );

    return [];
  }
}


function writeOrders(orders) {

  fs.writeFileSync(
    STORE,
    JSON.stringify(
      orders,
      null,
      2
    ),
    "utf8"
  );
}


function readMovies() {

  try {

    const data =
      fs.readFileSync(
        MOVIES_STORE,
        "utf8"
      );

    if (!data.trim()) {
      return [];
    }

    const movies =
      JSON.parse(data);

    return Array.isArray(movies)
      ? movies
      : [];

  } catch (error) {

    console.error(
      "Movies read error:",
      error
    );

    return [];
  }
}


function writeMovies(movies) {

  fs.writeFileSync(
    MOVIES_STORE,
    JSON.stringify(
      movies,
      null,
      2
    ),
    "utf8"
  );
}


/* =========================================================
   ID GENERATORS
========================================================= */

function createOrderId() {

  return (
    "SM" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


function createMovieId() {

  return (
    "MOV" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


/* =========================================================
   TEXT CLEANING
========================================================= */

function cleanText(
  value,
  maxLength
) {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(
      0,
      maxLength
    );
}


/* =========================================================
   MOBILE
========================================================= */

function cleanMobile(value) {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .replace(/[^\d+]/g, "")
    .slice(0, 20);
}


function validMobile(mobile) {

  if (!mobile) {
    return false;
  }

  const normalized =
    mobile
      .replace(
        /^\+91/,
        ""
      )
      .replace(
        /^91(?=\d{10}$)/,
        ""
      );

  return /^[6-9]\d{9}$/.test(
    normalized
  );
}


/* =========================================================
   EMAIL
========================================================= */

function cleanEmail(value) {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .slice(0, 150);
}


function validEmail(email) {

  if (!email) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    .test(email);
}


/* =========================================================
   INSTAGRAM
========================================================= */

function cleanUsername(username) {

  return cleanText(
    username,
    30
  ).replace(
    /^@+/,
    ""
  );
}


function validUsername(username) {

  return /^[A-Za-z0-9._]{1,30}$/
    .test(username);
}


function validInstagramProfile(profile) {

  if (
    typeof profile !== "string" ||
    !profile ||
    profile.length > 300
  ) {
    return false;
  }

  try {

    const url =
      new URL(profile);

    const hostname =
      url.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

    if (
      hostname !==
        "instagram.com" &&
      hostname !==
        "instagr.am"
    ) {
      return false;
    }

    return /^\/[A-Za-z0-9._]+\/?$/
      .test(url.pathname);

  } catch {

    return false;
  }
}


/* =========================================================
   UTR
========================================================= */

function validUTR(utr) {

  if (!utr) {
    return true;
  }

  if (
    utr.length < 6 ||
    utr.length > 80
  ) {
    return false;
  }

  return /^[A-Za-z0-9._-]+$/
    .test(utr);
}


/* =========================================================
   AMOUNT
========================================================= */

function cleanAmount(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    String(value)
      .replace(/,/g, "")
      .replace(/₹/g, "")
      .trim();

  if (
    !/^\d+(?:\.\d{1,2})?$/
      .test(text)
  ) {
    return "";
  }

  const number =
    Number(text);

  if (
    !Number.isFinite(number) ||
    number <= 0 ||
    number > 100000
  ) {
    return "";
  }

  return number.toFixed(2);
}


/* =========================================================
   SCREENSHOT
========================================================= */

function parseScreenshot(
  screenshot
) {

  if (
    typeof screenshot !== "string" ||
    !screenshot
  ) {
    throw new Error(
      "Payment screenshot is required."
    );
  }

  const match =
    screenshot.match(
      /^data:(image\/jpeg|image\/jpg|image\/png|image\/webp);base64,(.+)$/i
    );

  if (!match) {
    throw new Error(
      "Please upload a valid JPG, PNG or WEBP payment screenshot."
    );
  }

  const mimeType =
    match[1].toLowerCase();

  const base64Data =
    match[2];

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/
      .test(base64Data)
  ) {
    throw new Error(
      "The payment screenshot data is invalid."
    );
  }

  const buffer =
    Buffer.from(
      base64Data,
      "base64"
    );

  if (
    !buffer ||
    buffer.length === 0
  ) {
    throw new Error(
      "The payment screenshot could not be read."
    );
  }

  if (
    buffer.length >
    MAX_SCREENSHOT_SIZE
  ) {
    throw new Error(
      "Payment screenshot must be 5 MB or smaller."
    );
  }

  return {
    mimeType,
    buffer
  };
}


function detectImageType(buffer) {

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 12
  ) {
    return null;
  }

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.toString(
      "ascii",
      0,
      4
    ) === "RIFF" &&
    buffer.toString(
      "ascii",
      8,
      12
    ) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}


function saveScreenshot(
  screenshot,
  orderId
) {

  const {
    mimeType,
    buffer
  } =
    parseScreenshot(
      screenshot
    );

  const detectedType =
    detectImageType(buffer);

  if (!detectedType) {
    throw new Error(
      "The uploaded file is not a valid image."
    );
  }

  const compatible =
    (
      mimeType ===
        "image/jpeg" &&
      detectedType ===
        "image/jpeg"
    ) ||
    (
      mimeType ===
        "image/jpg" &&
      detectedType ===
        "image/jpeg"
    ) ||
    (
      mimeType ===
        "image/png" &&
      detectedType ===
        "image/png"
    ) ||
    (
      mimeType ===
        "image/webp" &&
      detectedType ===
        "image/webp"
    );

  if (!compatible) {
    throw new Error(
      "The screenshot file type does not match its actual image format."
    );
  }

  let extension = "jpg";

  if (
    detectedType ===
    "image/png"
  ) {
    extension = "png";
  }

  if (
    detectedType ===
    "image/webp"
  ) {
    extension = "webp";
  }

  const filename =
    orderId +
    "." +
    extension;

  const filepath =
    path.join(
      UPLOADS_DIR,
      filename
    );

  fs.writeFileSync(
    filepath,
    buffer
  );

  return {
    path:
      "/uploads/" +
      filename,

    filepath,

    buffer,

    mimeType:
      detectedType
  };
}


/* =========================================================
   TELEGRAM MESSAGE
========================================================= */

async function notifyTelegram(text) {

  if (
    !TG_BOT_TOKEN ||
    !TG_CHAT_ID
  ) {

    console.log(
      "Telegram is not configured."
    );

    return false;
  }

  try {

    const telegramUrl =
      "https://api.telegram.org/bot" +
      TG_BOT_TOKEN +
      "/sendMessage";

    const response =
      await fetch(
        telegramUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              chat_id:
                TG_CHAT_ID,

              text,

              disable_web_page_preview:
                false
            })
        }
      );

    if (!response.ok) {

      console.error(
        await response.text()
      );

      return false;
    }

    return true;

  } catch (error) {

    console.error(
      "Telegram message error:",
      error
    );

    return false;
  }
}


/* =========================================================
   TELEGRAM SCREENSHOT
========================================================= */

async function sendTelegramScreenshot(
  screenshotInfo,
  caption
) {

  if (
    !TG_BOT_TOKEN ||
    !TG_CHAT_ID
  ) {
    return false;
  }

  try {

    const form =
      new FormData();

    form.append(
      "chat_id",
      TG_CHAT_ID
    );

    form.append(
      "caption",
      caption
    );

    const blob =
      new Blob(
        [
          screenshotInfo.buffer
        ],
        {
          type:
            screenshotInfo.mimeType
        }
      );

    form.append(
      "photo",
      blob,
      "payment-screenshot"
    );

    const telegramUrl =
      "https://api.telegram.org/bot" +
      TG_BOT_TOKEN +
      "/sendPhoto";

    const response =
      await fetch(
        telegramUrl,
        {
          method: "POST",
          body: form
        }
      );

    return response.ok;

  } catch (error) {

    console.error(
      "Telegram screenshot error:",
      error
    );

    return false;
  }
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function admin(
  req,
  res,
  next
) {

  const key =
    req.headers[
      "x-admin-key"
    ];

  if (
    !key ||
    key !== ADMIN_KEY
  ) {

    return res.status(401).json({
      error:
        "Unauthorized"
    });
  }

  next();
}


/* =========================================================
   MOVIE CATALOG
========================================================= */

app.get(
  "/api/movies",
  (req, res) => {

    const movies =
      readMovies()
        .filter(
          movie =>
            movie.active !== false
        )
        .map(
          movie => ({
            movieId:
              movie.movieId,

            title:
              movie.title,

            price:
              movie.price,

            description:
              movie.description || "",

            poster:
              movie.poster || ""
          })
        );

    res.json({
      movies
    });
  }
);


/* =========================================================
   ADMIN - MOVIE UPLOAD
   Uses raw request stream.
   
   Headers required:
   x-admin-key
   x-movie-id
   x-movie-title
   x-movie-price
   x-movie-description
========================================================= */

app.post(
  "/api/admin/movies/upload",
  admin,
  async (req, res) => {

    try {

      const movieId =
        cleanText(
          req.headers[
            "x-movie-id"
          ] ||
          createMovieId(),
          50
        );

      const title =
        cleanText(
          req.headers[
            "x-movie-title"
          ],
          150
        );

      const price =
        cleanAmount(
          req.headers[
            "x-movie-price"
          ]
        );

      const description =
        cleanText(
          req.headers[
            "x-movie-description"
          ] || "",
          1000
        );

      if (!title) {

        return res.status(400).json({
          error:
            "Movie title is required."
        });
      }

      if (!price) {

        return res.status(400).json({
          error:
            "Valid movie price is required."
        });
      }

      const filename =
        movieId + ".mp4";

      const filepath =
        path.join(
          MOVIES_DIR,
          filename
        );

      let received = 0;

      const writeStream =
        fs.createWriteStream(
          filepath
        );

      req.on(
        "data",
        chunk => {

          received +=
            chunk.length;

          if (
            received >
            MAX_MOVIE_SIZE
          ) {

            req.destroy(
              new Error(
                "Movie file is too large."
              )
            );
          }
        }
      );

      req.pipe(writeStream);

      await new Promise(
        (resolve, reject) => {

          writeStream.on(
            "finish",
            resolve
          );

          writeStream.on(
            "error",
            reject
          );

          req.on(
            "error",
            reject
          );
        }
      );

      if (
        received === 0
      ) {

        fs.unlinkSync(
          filepath
        );

        return res.status(400).json({
          error:
            "Movie file is empty."
        });
      }

      const movies =
        readMovies();

      const existingIndex =
        movies.findIndex(
          movie =>
            movie.movieId ===
            movieId
        );

      const movie = {

        movieId,

        title,

        price,

        description,

        filename,

        active: true,

        createdAt:
          new Date()
            .toISOString()

      };

      if (
        existingIndex >= 0
      ) {

        movies[
          existingIndex
        ] = movie;

      } else {

        movies.unshift(
          movie
        );
      }

      writeMovies(
        movies
      );

      await notifyTelegram(
        "🎬 NEW MOVIE UPLOADED\n\n" +
        "Movie: " +
        title +
        "\n" +
        "Price: ₹" +
        price +
        "\n" +
        "Movie ID: " +
        movieId
      );

      return res.json({

        ok: true,

        movie

      });

    } catch (error) {

      console.error(
        "Movie upload error:",
        error
      );

      return res.status(500).json({
        error:
          "Movie upload failed."
      });
    }
  }
);


/* =========================================================
   ADMIN - DELETE / DISABLE MOVIE
========================================================= */

app.post(
  "/api/admin/movies/:id/disable",
  admin,
  (req, res) => {

    const movies =
      readMovies();

    const movie =
      movies.find(
        item =>
          item.movieId ===
          req.params.id
      );

    if (!movie) {

      return res.status(404).json({
        error:
          "Movie not found."
      });
    }

    movie.active = false;

    movie.updatedAt =
      new Date()
        .toISOString();

    writeMovies(
      movies
    );

    res.json({
      ok: true,
      movie
    });
  }
);


/* =========================================================
   MOVIE ORDER
========================================================= */

app.post(
  "/api/movie-orders",
  async (req, res) => {

    try {

      const body =
        req.body || {};

      if (
        /password|passcode/i.test(
          JSON.stringify(body)
        )
      ) {

        return res.status(400).json({
          error:
            "Passwords are not accepted."
        });
      }

      const movieId =
        cleanText(
          body.movieId,
          50
        );

      const mobile =
        cleanMobile(
          body.mobile
        );

      const email =
        cleanEmail(
          body.email
        );

      const utr =
        cleanText(
          body.utr,
          80
        );

      const promoCode =
        cleanText(
          body.promoCode ||
          body.coupon ||
          "",
          30
        ).toUpperCase();

      const screenshot =
        body.screenshot ||
        "";

      const movies =
        readMovies();

      const movie =
        movies.find(
          item =>
            item.movieId ===
              movieId &&
            item.active !== false
        );

      if (!movie) {

        return res.status(404).json({
          error:
            "Movie not found."
        });
      }

      if (
        !mobile &&
        !email
      ) {

        return res.status(400).json({
          error:
            "Please provide either your mobile number or email address."
        });
      }

      if (
        mobile &&
        !validMobile(mobile)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid Indian mobile number."
        });
      }

      if (
        email &&
        !validEmail(email)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid email address."
        });
      }

      if (
        !validUTR(utr)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid UTR or leave it empty."
        });
      }

      if (
        promoCode &&
        promoCode !==
          VALID_PROMO_CODE
      ) {

        return res.status(400).json({
          error:
            "Invalid promo code."
        });
      }

      if (!screenshot) {

        return res.status(400).json({
          error:
            "Payment screenshot is required."
        });
      }

      const orderId =
        createOrderId();

      let screenshotInfo;

      try {

        screenshotInfo =
          saveScreenshot(
            screenshot,
            orderId
          );

      } catch (error) {

        return res.status(400).json({
          error:
            error.message
        });
      }

      /*
        IMPORTANT:
        Server gets the real price
        from movies.json.

        Customer cannot change
        the amount from frontend.
      */

      const amount =
        cleanAmount(
          movie.price
        );

      const order = {

        orderId,

        type:
          "MOVIE",

        status:
          "PENDING",

        movieId:
          movie.movieId,

        movieTitle:
          movie.title,

        mobile,

        email,

        utr,

        promoCode,

        amount,

        screenshot:
          screenshotInfo.path,

        createdAt:
          new Date()
            .toISOString()
      };

      const orders =
        readOrders();

      orders.unshift(
        order
      );

      writeOrders(
        orders
      );

      let screenshotUrl =
        screenshotInfo.path;

      if (ADMIN_URL) {

        screenshotUrl =
          ADMIN_URL.replace(
            /\/$/,
            ""
          ) +
          screenshotInfo.path;
      }

      const contact =
        [
          mobile
            ? "Mobile: " + mobile
            : "",
          email
            ? "Email: " + email
            : ""
        ]
        .filter(Boolean)
        .join("\n");

      const message =

        "🎬 NEW MOVIE ORDER " +
        orderId +
        "\n\n" +

        "🎥 Movie: " +
        movie.title +
        "\n" +

        "🆔 Movie ID: " +
        movie.movieId +
        "\n" +

        "💰 Amount: ₹" +
        amount +
        "\n\n" +

        "📱 Contact\n" +
        contact +
        "\n\n" +

        "🧾 UTR: " +
        (
          utr ||
          "Not provided"
        ) +
        "\n" +

        "🎟 Promo Code: " +
        (
          promoCode ||
          "Not used"
        ) +
        "\n\n" +

        "🖼 Screenshot:\n" +
        screenshotUrl +
        "\n\n" +

        "⚠️ VERIFY PAYMENT BEFORE ACCEPTING.";

      await notifyTelegram(
        message
      );

      await sendTelegramScreenshot(
        screenshotInfo,
        "💳 MOVIE PAYMENT SCREENSHOT\n" +
        "Order ID: " +
        orderId +
        "\n" +
        "Movie: " +
        movie.title +
        "\n" +
        "Amount: ₹" +
        amount +
        "\n\n" +
        "⚠️ Verify payment before accepting."
      );

      res.json({

        ok: true,

        orderId,

        status:
          "PENDING",

        movieId:
          movie.movieId

      });

    } catch (error) {

      console.error(
        "Movie order error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to process movie order."
      });
    }
  }
);


/* =========================================================
   INSTAGRAM ORDER
========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const body =
        req.body || {};

      if (
        /password|passcode/i.test(
          JSON.stringify(body)
        )
      ) {

        return res.status(400).json({
          error:
            "Passwords are not accepted."
        });
      }

      const pkg =
        cleanText(
          body.package,
          100
        );

      const mobile =
        cleanMobile(
          body.mobile
        );

      const email =
        cleanEmail(
          body.email
        );

      const username =
        cleanUsername(
          body.username
        );

      const profile =
        cleanText(
          body.profile,
          300
        );

      const utr =
        cleanText(
          body.utr,
          80
        );

      const promoCode =
        cleanText(
          body.promoCode ||
          body.coupon ||
          "",
          30
        ).toUpperCase();

      const amount =
        cleanAmount(
          body.amount
        );

      const screenshot =
        body.screenshot ||
        "";

      if (
        !pkg ||
        !username ||
        !profile ||
        !screenshot
      ) {

        return res.status(400).json({
          error:
            "Please complete the required fields and upload your payment screenshot."
        });
      }

      if (
        !mobile &&
        !email
      ) {

        return res.status(400).json({
          error:
            "Please provide either your mobile number or email address."
        });
      }

      if (
        mobile &&
        !validMobile(mobile)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid Indian mobile number."
        });
      }

      if (
        email &&
        !validEmail(email)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid email address."
        });
      }

      if (
        !validUsername(username)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid Instagram username."
        });
      }

      if (
        !validInstagramProfile(
          profile
        )
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid Instagram profile link."
        });
      }

      if (
        !validUTR(utr)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid UTR or leave it empty."
        });
      }

      if (
        promoCode &&
        promoCode !==
          VALID_PROMO_CODE
      ) {

        return res.status(400).json({
          error:
            "Invalid promo code."
        });
      }

      if (!amount) {

        return res.status(400).json({
          error:
            "Invalid payment amount."
        });
      }

      const orderId =
        createOrderId();

      let screenshotInfo;

      try {

        screenshotInfo =
          saveScreenshot(
            screenshot,
            orderId
          );

      } catch (error) {

        return res.status(400).json({
          error:
            error.message
        });
      }

      const order = {

        orderId,

        type:
          "INSTAGRAM",

        status:
          "PENDING",

        package:
          pkg,

        mobile,

        email,

        username,

        profile,

        utr,

        promoCode,

        amount,

        screenshot:
          screenshotInfo.path,

        createdAt:
          new Date()
            .toISOString()
      };

      const orders =
        readOrders();

      orders.unshift(
        order
      );

      writeOrders(
        orders
      );

      let screenshotUrl =
        screenshotInfo.path;

      if (ADMIN_URL) {

        screenshotUrl =
          ADMIN_URL.replace(
            /\/$/,
            ""
          ) +
          screenshotInfo.path;
      }

      const contact =
        [
          mobile
            ? "Mobile: " + mobile
            : "",
          email
            ? "Email: " + email
            : ""
        ]
        .filter(Boolean)
        .join("\n");

      const message =

        "🔔 NEW INSTAGRAM ORDER " +
        orderId +
        "\n\n" +

        "📦 Package: " +
        pkg +
        "\n" +

        "💰 Amount: ₹" +
        amount +
        "\n\n" +

        "📱 Contact\n" +
        contact +
        "\n\n" +

        "📸 Instagram: @" +
        username +
        "\n" +

        "🔗 Profile: " +
        profile +
        "\n\n" +

        "🧾 UTR: " +
        (
          utr ||
          "Not provided"
        ) +
        "\n" +

        "🎟 Promo Code: " +
        (
          promoCode ||
          "Not used"
        ) +
        "\n\n" +

        "🖼 Screenshot:\n" +
        screenshotUrl +
        "\n\n" +

        "⚠️ VERIFY PAYMENT BEFORE ACCEPTING.";

      await notifyTelegram(
        message
      );

      await sendTelegramScreenshot(
        screenshotInfo,
        "💳 INSTAGRAM PAYMENT SCREENSHOT\n" +
        "Order ID: " +
        orderId +
        "\n" +
        "Instagram: @" +
        username +
        "\n" +
        "Amount: ₹" +
        amount +
        "\n\n" +
        "⚠️ Verify payment before accepting."
      );

      res.json({

        ok: true,

        orderId,

        status:
          "PENDING"

      });

    } catch (error) {

      console.error(
        "Instagram order error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to process order."
      });
    }
  }
);


/* =========================================================
   ADMIN - ALL ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {

    res.json(
      readOrders()
    );
  }
);


/* =========================================================
   ADMIN - ALL MOVIES
========================================================= */

app.get(
  "/api/admin/movies",
  admin,
  (req, res) => {

    res.json(
      readMovies()
    );
  }
);


/* =========================================================
   ADMIN - ACCEPT / REJECT
========================================================= */

app.post(
  "/api/admin/orders/:id/status",
  admin,
  async (req, res) => {

    const allowed = [
      "ACCEPTED",
      "REJECTED"
    ];

    const status =
      req.body &&
      req.body.status;

    if (
      !allowed.includes(status)
    ) {

      return res.status(400).json({
        error:
          "Invalid status"
      });
    }

    const orders =
      readOrders();

    const order =
      orders.find(
        item =>
          item.orderId ===
          req.params.id
      );

    if (!order) {

      return res.status(404).json({
        error:
          "Order not found"
      });
    }

    order.status =
      status;

    order.updatedAt =
      new Date()
        .toISOString();

    writeOrders(
      orders
    );

    /*
      Telegram admin confirmation
    */

    await notifyTelegram(

      status === "ACCEPTED"

        ? (
          "✅ ORDER ACCEPTED\n\n" +
          "Order ID: " +
          order.orderId +
          "\n" +
          (
            order.type ===
            "MOVIE"

              ? "🎬 Movie: " +
                order.movieTitle

              : "📦 Instagram: @" +
                order.username
          )
        )

        : (
          "❌ ORDER REJECTED\n\n" +
          "Order ID: " +
          order.orderId +
          "\n" +
          (
            order.type ===
            "MOVIE"

              ? "🎬 Movie: " +
                order.movieTitle

              : "📦 Instagram: @" +
                order.username
          )
        )
    );

    res.json({

      ok: true,

      order

    });
  }
);


/* =========================================================
   CUSTOMER - ORDER STATUS
========================================================= */

app.get(
  "/api/orders/:id",
  (req, res) => {

    const orders =
      readOrders();

    const order =
      orders.find(
        item =>
          item.orderId ===
          req.params.id
      );

    if (!order) {

      return res.status(404).json({
        error:
          "Order not found"
      });
    }

    res.json({

      orderId:
        order.orderId,

      type:
        order.type,

      status:
        order.status,

      package:
        order.package || null,

      movieId:
        order.movieId || null,

      movieTitle:
        order.movieTitle || null,

      createdAt:
        order.createdAt
    });
  }
);


/* =========================================================
   CUSTOMER - MY MOVIE ACCESS
========================================================= */

app.get(
  "/api/my-movies/:orderId",
  (req, res) => {

    const orders =
      readOrders();

    const order =
      orders.find(
        item =>
          item.orderId ===
          req.params.orderId
      );

    if (!order) {

      return res.status(404).json({
        error:
          "Order not found."
      });
    }

    if (
      order.type !==
      "MOVIE"
    ) {

      return res.status(400).json({
        error:
          "This is not a movie order."
      });
    }

    if (
      order.status !==
      "ACCEPTED"
    ) {

      return res.status(403).json({
        error:
          "Movie access has not been approved."
      });
    }

    const movies =
      readMovies();

    const movie =
      movies.find(
        item =>
          item.movieId ===
          order.movieId
      );

    if (!movie) {

      return res.status(404).json({
        error:
          "Movie is no longer available."
      });
    }

    res.json({

      ok: true,

      movie: {

        movieId:
          movie.movieId,

        title:
          movie.title,

        description:
          movie.description || "",

        poster:
          movie.poster || "",

        watchUrl:
          "/api/watch/" +
          movie.movieId +
          "?orderId=" +
          encodeURIComponent(
            order.orderId
          )
      }
    });
  }
);


/* =========================================================
   PROTECTED MOVIE STREAM
========================================================= */

app.get(
  "/api/watch/:movieId",
  (req, res) => {

    const orderId =
      cleanText(
        req.query.orderId,
        50
      );

    if (!orderId) {

      return res.status(401).send(
        "Movie access requires an approved order."
      );
    }

    const orders =
      readOrders();

    const order =
      orders.find(
        item =>
          item.orderId ===
          orderId
      );

    if (!order) {

      return res.status(404).send(
        "Order not found."
      );
    }

    if (
      order.type !==
      "MOVIE"
    ) {

      return res.status(403).send(
        "Invalid movie order."
      );
    }

    if (
      order.status !==
      "ACCEPTED"
    ) {

      return res.status(403).send(
        "Movie access has not been approved."
      );
    }

    if (
      order.movieId !==
      req.params.movieId
    ) {

      return res.status(403).send(
        "This order does not have access to this movie."
      );
    }

    const movies =
      readMovies();

    const movie =
      movies.find(
        item =>
          item.movieId ===
          req.params.movieId
      );

    if (!movie) {

      return res.status(404).send(
        "Movie not found."
      );
    }

    const filepath =
      path.join(
        MOVIES_DIR,
        movie.filename
      );

    /*
      Prevent path traversal.
    */

    const resolvedMovie =
      path.resolve(filepath);

    const resolvedMoviesDir =
      path.resolve(
        MOVIES_DIR
      );

    if (
      !resolvedMovie.startsWith(
        resolvedMoviesDir +
        path.sep
      )
    ) {

      return res.status(403).send(
        "Invalid movie path."
      );
    }

    if (
      !fs.existsSync(filepath)
    ) {

      return res.status(404).send(
        "Movie file is not available."
      );
    }

    const stat =
      fs.statSync(filepath);

    const fileSize =
      stat.size;

    const range =
      req.headers.range;

    res.setHeader(
      "Content-Type",
      "video/mp4"
    );

    res.setHeader(
      "Accept-Ranges",
      "bytes"
    );

    res.setHeader(
      "Cache-Control",
      "private, no-store"
    );

    if (!range) {

      res.setHeader(
        "Content-Length",
        fileSize
      );

      fs.createReadStream(
        filepath
      ).pipe(res);

      return;
    }

    const match =
      range.match(
        /bytes=(\d*)-(\d*)/
      );

    if (!match) {

      return res.status(416).send(
        "Invalid range."
      );
    }

    let start =
      match[1]
        ? parseInt(
            match[1],
            10
          )
        : 0;

    let end =
      match[2]
        ? parseInt(
            match[2],
            10
          )
        : fileSize - 1;

    if (
      start >= fileSize ||
      end >= fileSize ||
      start > end
    ) {

      res.status(416);

      res.setHeader(
        "Content-Range",
        "bytes */" +
        fileSize
      );

      return res.end();
    }

    const chunkSize =
      end - start + 1;

    res.status(206);

    res.setHeader(
      "Content-Range",
      "bytes " +
      start +
      "-" +
      end +
      "/" +
      fileSize
    );

    res.setHeader(
      "Content-Length",
      chunkSize
    );

    fs.createReadStream(
      filepath,
      {
        start,
        end
      }
    ).pipe(res);
  }
);


/* =========================================================
   HTML ROUTES
========================================================= */

app.get(
  "/order.html",
  (req, res) => {

    const file =
      path.join(
        PUBLIC_DIR,
        "order.html"
      );

    if (
      fs.existsSync(file)
    ) {

      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "order.html was not found."
    );
  }
);


app.get(
  "/admin.html",
  (req, res) => {

    const file =
      path.join(
        PUBLIC_DIR,
        "admin.html"
      );

    if (
      fs.existsSync(file)
    ) {

      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "admin.html was not found."
    );
  }
);


app.get(
  "/watch.html",
  (req, res) => {

    const file =
      path.join(
        PUBLIC_DIR,
        "watch.html"
      );

    if (
      fs.existsSync(file)
    ) {

      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "watch.html was not found."
    );
  }
);


app.get(
  "/",
  (req, res) => {

    const file =
      path.join(
        PUBLIC_DIR,
        "index.html"
      );

    if (
      fs.existsSync(file)
    ) {

      return res.sendFile(
        file
      );
    }

    res.status(404).send(
      "index.html was not found."
    );
  }
);


/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {

    if (
      req.path.startsWith(
        "/api/"
      )
    ) {

      return res.status(404).json({
        error:
          "API endpoint not found"
      });
    }

    res.status(404).send(
      "Page not found."
    );
  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "SehrAn Media server running on port " +
      PORT
    );

  }
);
