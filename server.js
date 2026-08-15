const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================================================
   BASIC CONFIGURATION
========================================================= */

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

const STORE = path.join(__dirname, "orders.json");
const MOVIES_STORE = path.join(__dirname, "movies.json");
const GAMES_STORE = path.join(__dirname, "games.json");

const ADMIN_KEY =
  process.env.ADMIN_KEY || "CHANGE_THIS_ADMIN_KEY";

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

const VALID_PROMO_CODE =
  "ZEESHAN10";


/* =========================================================
   CREATE REQUIRED DIRECTORIES / FILES
========================================================= */

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, {
    recursive: true
  });
}

function createJsonStore(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      "[]",
      "utf8"
    );
  }
}

createJsonStore(STORE);
createJsonStore(MOVIES_STORE);
createJsonStore(GAMES_STORE);


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
   STATIC FILES
========================================================= */

app.use(
  express.static(PUBLIC_DIR)
);


/* =========================================================
   GENERIC JSON STORE HELPERS
========================================================= */

function readJsonStore(file) {
  try {
    const data =
      fs.readFileSync(
        file,
        "utf8"
      );

    if (!data.trim()) {
      return [];
    }

    const parsed =
      JSON.parse(data);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      "JSON store read error:",
      error
    );

    return [];
  }
}


function writeJsonStore(
  file,
  data
) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}


/* =========================================================
   ORDER HELPERS
========================================================= */

function readOrders() {
  return readJsonStore(STORE);
}


function writeOrders(orders) {
  writeJsonStore(
    STORE,
    orders
  );
}


/* =========================================================
   MOVIE / GAME HELPERS
========================================================= */

function readMovies() {
  return readJsonStore(
    MOVIES_STORE
  );
}


function writeMovies(movies) {
  writeJsonStore(
    MOVIES_STORE,
    movies
  );
}


function readGames() {
  return readJsonStore(
    GAMES_STORE
  );
}


function writeGames(games) {
  writeJsonStore(
    GAMES_STORE,
    games
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


function createContentId(prefix) {

  return (
    prefix +
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 7)
  ).toUpperCase();
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
   URL CLEANING
========================================================= */

function cleanUrl(
  value,
  maxLength = 1000
) {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  const text =
    value
      .trim()
      .slice(0, maxLength);

  if (!text) {
    return "";
  }

  try {

    const url =
      new URL(text);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return url.toString();

  } catch (error) {

    return "";
  }
}


/* =========================================================
   MOBILE NUMBER
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

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
    email
  );
}


/* =========================================================
   INSTAGRAM USERNAME
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

  return /^[A-Za-z0-9._]{1,30}$/.test(
    username
  );
}


/* =========================================================
   INSTAGRAM PROFILE
========================================================= */

function validInstagramProfile(
  profile
) {

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

    return /^\/[A-Za-z0-9._]+\/?$/.test(
      url.pathname
    );

  } catch (error) {

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

  return /^[A-Za-z0-9._-]+$/.test(
    utr
  );
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

  const match =
    text.match(
      /^\d+(?:\.\d{1,2})?$/
    );

  if (!match) {
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
   SCREENSHOT PARSER
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
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      base64Data
    )
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


/* =========================================================
   IMAGE SIGNATURE
========================================================= */

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


/* =========================================================
   SAVE SCREENSHOT
========================================================= */

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
    detectImageType(
      buffer
    );

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

  let extension;

  if (
    detectedType ===
    "image/jpeg"
  ) {
    extension = "jpg";
  } else if (
    detectedType ===
    "image/png"
  ) {
    extension = "png";
  } else {
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

    filepath:
      filepath,

    buffer:
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
      "Telegram bot token or chat ID is not configured."
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

              text:
                text,

              disable_web_page_preview:
                false

            })
        }
      );

    if (!response.ok) {

      console.error(
        "Telegram message response:",
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

    if (!response.ok) {

      console.error(
        "Telegram screenshot response:",
        await response.text()
      );

      return false;
    }

    return true;

  } catch (error) {

    console.error(
      "Telegram screenshot error:",
      error
    );

    return false;
  }
}


/* =========================================================
   CREATE ORDER
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
        !validInstagramProfile(profile)
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

        orderId:
          orderId,

        status:
          "PENDING",

        package:
          pkg,

        mobile:
          mobile,

        email:
          email,

        username:
          username,

        profile:
          profile,

        utr:
          utr,

        promoCode:
          promoCode,

        amount:
          amount,

        screenshot:
          screenshotInfo.path,

        createdAt:
          new Date().toISOString()

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

      let contactText =
        "";

      if (mobile) {
        contactText +=
          "Mobile: " +
          mobile +
          "\n";
      }

      if (email) {
        contactText +=
          "Email: " +
          email +
          "\n";
      }

      const message =
        "🔔 NEW ORDER " +
        orderId +
        "\n\n" +

        "📦 Package: " +
        pkg +
        "\n" +

        "💰 Amount: ₹" +
        amount +
        "\n\n" +

        "📱 Contact\n" +
        contactText +

        "\n" +

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

        "🖼 Screenshot URL:\n" +
        screenshotUrl +
        "\n\n" +

        "⚠️ VERIFY THE PAYMENT BEFORE ACCEPTING THE ORDER.";

      await notifyTelegram(
        message
      );

      const screenshotCaption =
        "💳 PAYMENT SCREENSHOT\n" +
        "Order ID: " +
        orderId +
        "\n" +
        "Amount: ₹" +
        amount +
        "\n" +
        "Instagram: @" +
        username +
        "\n\n" +
        "⚠️ Verify payment before accepting.";

      await sendTelegramScreenshot(
        screenshotInfo,
        screenshotCaption
      );

      return res.json({

        ok:
          true,

        orderId:
          orderId,

        status:
          "PENDING"

      });

    } catch (error) {

      console.error(
        "Order processing error:",
        error
      );

      return res.status(500).json({
        error:
          "Unable to process order. Please try again."
      });
    }
  }
);


/* =========================================================
   ADMIN AUTHENTICATION
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
   ADMIN - GET ALL ORDERS
========================================================= */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {

    return res.json(
      readOrders()
    );

  }
);


/* =========================================================
   ADMIN - ACCEPT / REJECT ORDER
========================================================= */

app.post(
  "/api/admin/orders/:id/status",
  admin,
  (req, res) => {

    const allowed = [
      "ACCEPTED",
      "REJECTED"
    ];

    const status =
      req.body &&
      req.body.status;

    if (
      !allowed.includes(
        status
      )
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
      new Date().toISOString();

    writeOrders(
      orders
    );

    return res.json({
      ok:
        true,

      order:
        order
    });
  }
);


/* =========================================================
   CUSTOMER - CHECK ORDER STATUS
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

    return res.json({

      orderId:
        order.orderId,

      status:
        order.status,

      package:
        order.package,

      createdAt:
        order.createdAt

    });
  }
);


/* =========================================================
   CONTENT VALIDATION
========================================================= */

function prepareContent(body) {

  const title =
    cleanText(
      body.title,
      150
    );

  const description =
    cleanText(
      body.description,
      3000
    );

  const category =
    cleanText(
      body.category,
      80
    );

  const year =
    cleanText(
      body.year,
      10
    );

  const posterUrl =
    cleanUrl(
      body.posterUrl,
      1000
    );

  const streamUrl =
    cleanUrl(
      body.streamUrl,
      1000
    );

  const downloadUrl =
    cleanUrl(
      body.downloadUrl,
      1000
    );

  const trailerUrl =
    cleanUrl(
      body.trailerUrl,
      1000
    );

  const featured =
    body.featured === true ||
    body.featured === "true";

  const published =
    body.published !== false &&
    body.published !== "false";

  if (!title) {
    return {
      error:
        "Title is required."
    };
  }

  if (!description) {
    return {
      error:
        "Description is required."
    };
  }

  if (!posterUrl) {
    return {
      error:
        "A valid poster URL is required."
    };
  }

  /*
    At least one authorized destination
    is required.
  */

  if (
    !streamUrl &&
    !downloadUrl
  ) {

    return {
      error:
        "Provide a valid streaming URL or download URL."
    };
  }

  return {

    title:
      title,

    description:
      description,

    category:
      category || "General",

    year:
      year,

    posterUrl:
      posterUrl,

    streamUrl:
      streamUrl,

    downloadUrl:
      downloadUrl,

    trailerUrl:
      trailerUrl,

    featured:
      featured,

    published:
      published
  };
}


/* =========================================================
   PUBLIC - GET PUBLISHED MOVIES
========================================================= */

app.get(
  "/api/movies",
  (req, res) => {

    const movies =
      readMovies()
        .filter(
          movie =>
            movie.published === true
        );

    return res.json(
      movies
    );
  }
);


/* =========================================================
   PUBLIC - GET SINGLE MOVIE
========================================================= */

app.get(
  "/api/movies/:id",
  (req, res) => {

    const movie =
      readMovies().find(
        item =>
          item.id ===
          req.params.id &&
          item.published === true
      );

    if (!movie) {

      return res.status(404).json({
        error:
          "Movie not found."
      });
    }

    return res.json(
      movie
    );
  }
);


/* =========================================================
   ADMIN - GET ALL MOVIES
========================================================= */

app.get(
  "/api/admin/movies",
  admin,
  (req, res) => {

    return res.json(
      readMovies()
    );
  }
);


/* =========================================================
   ADMIN - ADD MOVIE
========================================================= */

app.post(
  "/api/admin/movies",
  admin,
  (req, res) => {

    const result =
      prepareContent(
        req.body || {}
      );

    if (result.error) {

      return res.status(400).json({
        error:
          result.error
      });
    }

    const movies =
      readMovies();

    const movie = {

      id:
        createContentId(
          "MOV"
        ),

      type:
        "movie",

      ...result,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    movies.unshift(
      movie
    );

    writeMovies(
      movies
    );

    return res.json({

      ok:
        true,

      movie:
        movie

    });
  }
);


/* =========================================================
   ADMIN - UPDATE MOVIE
========================================================= */

app.put(
  "/api/admin/movies/:id",
  admin,
  (req, res) => {

    const movies =
      readMovies();

    const movie =
      movies.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!movie) {

      return res.status(404).json({
        error:
          "Movie not found."
      });
    }

    const result =
      prepareContent(
        req.body || {}
      );

    if (result.error) {

      return res.status(400).json({
        error:
          result.error
      });
    }

    Object.assign(
      movie,
      result
    );

    movie.updatedAt =
      new Date().toISOString();

    writeMovies(
      movies
    );

    return res.json({

      ok:
        true,

      movie:
        movie

    });
  }
);


/* =========================================================
   ADMIN - DELETE MOVIE
========================================================= */

app.delete(
  "/api/admin/movies/:id",
  admin,
  (req, res) => {

    const movies =
      readMovies();

    const index =
      movies.findIndex(
        item =>
          item.id ===
          req.params.id
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Movie not found."
      });
    }

    const deleted =
      movies.splice(
        index,
        1
      )[0];

    writeMovies(
      movies
    );

    return res.json({

      ok:
        true,

      deleted:
        deleted

    });
  }
);


/* =========================================================
   PUBLIC - GET PUBLISHED GAMES
========================================================= */

app.get(
  "/api/games",
  (req, res) => {

    const games =
      readGames()
        .filter(
          game =>
            game.published === true
        );

    return res.json(
      games
    );
  }
);


/* =========================================================
   PUBLIC - GET SINGLE GAME
========================================================= */

app.get(
  "/api/games/:id",
  (req, res) => {

    const game =
      readGames().find(
        item =>
          item.id ===
          req.params.id &&
          item.published === true
      );

    if (!game) {

      return res.status(404).json({
        error:
          "Game not found."
      });
    }

    return res.json(
      game
    );
  }
);


/* =========================================================
   ADMIN - GET ALL GAMES
========================================================= */

app.get(
  "/api/admin/games",
  admin,
  (req, res) => {

    return res.json(
      readGames()
    );
  }
);


/* =========================================================
   ADMIN - ADD GAME
========================================================= */

app.post(
  "/api/admin/games",
  admin,
  (req, res) => {

    const result =
      prepareContent(
        req.body || {}
      );

    if (result.error) {

      return res.status(400).json({
        error:
          result.error
      });
    }

    const games =
      readGames();

    const game = {

      id:
        createContentId(
          "GAM"
        ),

      type:
        "game",

      ...result,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    };

    games.unshift(
      game
    );

    writeGames(
      games
    );

    return res.json({

      ok:
        true,

      game:
        game

    });
  }
);


/* =========================================================
   ADMIN - UPDATE GAME
========================================================= */

app.put(
  "/api/admin/games/:id",
  admin,
  (req, res) => {

    const games =
      readGames();

    const game =
      games.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!game) {

      return res.status(404).json({
        error:
          "Game not found."
      });
    }

    const result =
      prepareContent(
        req.body || {}
      );

    if (result.error) {

      return res.status(400).json({
        error:
          result.error
      });
    }

    Object.assign(
      game,
      result
    );

    game.updatedAt =
      new Date().toISOString();

    writeGames(
      games
    );

    return res.json({

      ok:
        true,

      game:
        game

    });
  }
);


/* =========================================================
   ADMIN - DELETE GAME
========================================================= */

app.delete(
  "/api/admin/games/:id",
  admin,
  (req, res) => {

    const games =
      readGames();

    const index =
      games.findIndex(
        item =>
          item.id ===
          req.params.id
      );

    if (index === -1) {

      return res.status(404).json({
        error:
          "Game not found."
      });
    }

    const deleted =
      games.splice(
        index,
        1
      )[0];

    writeGames(
      games
    );

    return res.json({

      ok:
        true,

      deleted:
        deleted

    });
  }
);


/* =========================================================
   CONTENT STATISTICS
========================================================= */

app.get(
  "/api/admin/content-stats",
  admin,
  (req, res) => {

    const movies =
      readMovies();

    const games =
      readGames();

    return res.json({

      movies:
        movies.length,

      publishedMovies:
        movies.filter(
          item =>
            item.published === true
        ).length,

      games:
        games.length,

      publishedGames:
        games.filter(
          item =>
            item.published === true
        ).length

    });
  }
);


/* =========================================================
   EXPLICIT HTML ROUTES
========================================================= */

function sendPublicPage(
  filename,
  res
) {

  const page =
    path.join(
      PUBLIC_DIR,
      filename
    );

  if (
    fs.existsSync(page)
  ) {

    return res.sendFile(
      page
    );
  }

  return res.status(404).send(
    filename +
    " was not found inside the public folder."
  );
}


app.get(
  "/order.html",
  (req, res) => {

    return sendPublicPage(
      "order.html",
      res
    );

  }
);


app.get(
  "/admin.html",
  (req, res) => {

    return sendPublicPage(
      "admin.html",
      res
    );

  }
);


app.get(
  "/movies.html",
  (req, res) => {

    return sendPublicPage(
      "movies.html",
      res
    );

  }
);


app.get(
  "/games.html",
  (req, res) => {

    return sendPublicPage(
      "games.html",
      res
    );

  }
);


app.get(
  "/movie-player.html",
  (req, res) => {

    return sendPublicPage(
      "movie-player.html",
      res
    );

  }
);


app.get(
  "/game-details.html",
  (req, res) => {

    return sendPublicPage(
      "game-details.html",
      res
    );

  }
);


/* =========================================================
   HOME PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {

    return sendPublicPage(
      "index.html",
      res
    );

  }
);


/* =========================================================
   404 HANDLER
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

    return res.status(404).send(
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

    console.log(
      "Movies API: /api/movies"
    );

    console.log(
      "Games API: /api/games"
    );

  }
);
