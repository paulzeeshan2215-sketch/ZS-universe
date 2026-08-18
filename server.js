const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

/*
  IMPORTANT:
  Movies are NOT inside public/.
  This prevents anyone from directly opening the movie file.
*/
const MOVIES_DIR = path.join(__dirname, "movies");

const STORE = path.join(__dirname, "orders.json");

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
   MOVIE CATALOG
=========================================================

   Add movies here.

   IMPORTANT:
   movieId must match the file name inside /movies/

   Example:

   movies/
      shawshank-redemption.mp4

========================================================= */

const MOVIES = {

  "shawshank-redemption": {
    id: "shawshank-redemption",
    title: "The Shawshank Redemption",
    price: 15,
    file: "shawshank-redemption.mp4",
    description: "The Shawshank Redemption"
  },

  /*
  Add more movies like this:

  "movie-2": {
    id: "movie-2",
    title: "Movie Name",
    price: 20,
    file: "movie-2.mp4",
    description: "Movie description"
  }
  */

};


/* =========================================================
   CREATE DIRECTORIES / STORE
========================================================= */

for (const dir of [
  PUBLIC_DIR,
  UPLOADS_DIR,
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
   ORDER HELPERS
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


/* =========================================================
   ORDER ID
========================================================= */

function createOrderId() {

  return (
    "SM" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


/* =========================================================
   CLEAN TEXT
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
      .replace(/^\+91/, "")
      .replace(/^91(?=\d{10}$)/, "");

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

  return (
    !!email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
      email
    )
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
      hostname !== "instagram.com" &&
      hostname !== "instagr.am"
    ) {
      return false;
    }

    return /^\/[A-Za-z0-9._]+\/?$/.test(
      url.pathname
    );

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

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(text)
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
      "Invalid screenshot data."
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
      "Screenshot could not be read."
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
   IMAGE TYPE
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
    buffer[3] === 0x47
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
      mimeType === "image/jpeg" &&
      detectedType === "image/jpeg"
    ) ||
    (
      mimeType === "image/jpg" &&
      detectedType === "image/jpeg"
    ) ||
    (
      mimeType === "image/png" &&
      detectedType === "image/png"
    ) ||
    (
      mimeType === "image/webp" &&
      detectedType === "image/webp"
    );

  if (!compatible) {
    throw new Error(
      "Screenshot file type does not match its actual format."
    );
  }

  let extension = "jpg";

  if (
    detectedType === "image/png"
  ) {
    extension = "png";
  }

  if (
    detectedType === "image/webp"
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

    return response.ok;

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
   GET MOVIE CATALOG
========================================================= */

app.get(
  "/api/movies",
  (req, res) => {

    const movies =
      Object.values(MOVIES)
        .map(movie => ({
          id: movie.id,
          title: movie.title,
          price: movie.price,
          description: movie.description
        }));

    res.json({
      ok: true,
      movies
    });
  }
);


/* =========================================================
   CREATE ORDER
========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const body =
        req.body || {};

      /*
        Never accept passwords.
      */

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


      /* ---------------------------------------------------
         ORDER TYPE
      --------------------------------------------------- */

      const type =
        cleanText(
          body.type ||
          body.orderType ||
          "",
          30
        ).toLowerCase();


      if (
        type !== "movie" &&
        type !== "instagram"
      ) {

        return res.status(400).json({
          error:
            "Invalid order type."
        });
      }


      /* ---------------------------------------------------
         CONTACT
      --------------------------------------------------- */

      const mobile =
        cleanMobile(
          body.mobile
        );

      const email =
        cleanEmail(
          body.email
        );

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


      /* ---------------------------------------------------
         PAYMENT DATA
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         MOVIE ORDER
      --------------------------------------------------- */

      if (type === "movie") {

        const movieId =
          cleanText(
            body.movieId,
            100
          );

        const movie =
          MOVIES[movieId];

        if (!movie) {

          return res.status(400).json({
            error:
              "Movie not found."
          });
        }

        /*
          SECURITY:
          Price comes from SERVER,
          not from the browser.
        */

        const amount =
          Number(movie.price)
            .toFixed(2);

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
            "movie",

          status:
            "PENDING",

          accessGranted:
            false,

          movieId:
            movie.id,

          movieTitle:
            movie.title,

          amount,

          mobile,

          email,

          utr,

          promoCode,

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


        const message =
          "🎬 NEW MOVIE ORDER\n\n" +

          "🆔 Order ID: " +
          orderId +
          "\n\n" +

          "🎥 Movie: " +
          movie.title +
          "\n" +

          "💰 Amount: ₹" +
          amount +
          "\n\n" +

          "📱 Mobile: " +
          (mobile || "Not provided") +
          "\n" +

          "📧 Email: " +
          (email || "Not provided") +
          "\n\n" +

          "🧾 UTR: " +
          (utr || "Not provided") +
          "\n" +

          "🎟 Promo: " +
          (promoCode || "Not used") +
          "\n\n" +

          "🖼 Screenshot:\n" +
          screenshotUrl +
          "\n\n" +

          "⏳ STATUS: PENDING\n\n" +

          "⚠️ Verify payment before accepting.\n" +

          "✅ ACCEPT = Give movie access\n" +

          "❌ REJECT = No movie access";


        await notifyTelegram(
          message
        );


        await sendTelegramScreenshot(
          screenshotInfo,
          "🎬 MOVIE PAYMENT\n" +
          "Order: " +
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


        return res.json({

          ok:
            true,

          orderId,

          type:
            "movie",

          status:
            "PENDING",

          movieId:
            movie.id,

          movieTitle:
            movie.title

        });
      }


      /* ---------------------------------------------------
         INSTAGRAM ORDER
      --------------------------------------------------- */

      const pkg =
        cleanText(
          body.package,
          100
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

      const amount =
        cleanAmount(
          body.amount
        );


      if (
        !pkg ||
        !username ||
        !profile
      ) {

        return res.status(400).json({
          error:
            "Please complete all Instagram fields."
        });
      }


      if (
        !validUsername(
          username
        )
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
          "instagram",

        status:
          "PENDING",

        accessGranted:
          false,

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


      const message =
        "📱 NEW INSTAGRAM ORDER\n\n" +

        "🆔 Order ID: " +
        orderId +
        "\n\n" +

        "📦 Package: " +
        pkg +
        "\n" +

        "💰 Amount: ₹" +
        amount +
        "\n\n" +

        "📱 Mobile: " +
        (mobile || "Not provided") +
        "\n" +

        "📧 Email: " +
        (email || "Not provided") +
        "\n\n" +

        "👤 Instagram: @" +
        username +
        "\n" +

        "🔗 Profile: " +
        profile +
        "\n\n" +

        "🧾 UTR: " +
        (utr || "Not provided") +
        "\n" +

        "🎟 Promo: " +
        (promoCode || "Not used") +
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
        "📱 INSTAGRAM PAYMENT\n" +
        "Order: " +
        orderId +
        "\n" +
        "Package: " +
        pkg +
        "\n" +
        "Amount: ₹" +
        amount
      );


      return res.json({

        ok:
          true,

        orderId,

        type:
          "instagram",

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
   ADMIN - GET ORDERS
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
   ADMIN - ACCEPT / REJECT
========================================================= */

app.post(
  "/api/admin/orders/:id/status",
  admin,
  async (req, res) => {

    const status =
      req.body &&
      req.body.status;

    if (
      status !== "ACCEPTED" &&
      status !== "REJECTED"
    ) {

      return res.status(400).json({
        error:
          "Invalid status."
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
          "Order not found."
      });
    }


    /* ---------------------------------------------------
       ACCEPT
    --------------------------------------------------- */

    if (
      status === "ACCEPTED"
    ) {

      order.status =
        "ACCEPTED";

      /*
        MOVIE:
        Give access.

        INSTAGRAM:
        Just mark accepted.
      */

      if (
        order.type === "movie"
      ) {

        order.accessGranted =
          true;
      }

    }


    /* ---------------------------------------------------
       REJECT
    --------------------------------------------------- */

    if (
      status === "REJECTED"
    ) {

      order.status =
        "REJECTED";

      order.accessGranted =
        false;
    }


    order.updatedAt =
      new Date().toISOString();


    writeOrders(
      orders
    );


    /* ---------------------------------------------------
       TELEGRAM ADMIN UPDATE
    --------------------------------------------------- */

    let adminMessage =
      "";

    if (
      order.type === "movie"
    ) {

      adminMessage =
        status === "ACCEPTED"

          ? "✅ MOVIE ORDER ACCEPTED\n\n" +
            "Order: " +
            order.orderId +
            "\n" +
            "Movie: " +
            order.movieTitle +
            "\n\n" +
            "🎬 Movie access has been GRANTED."

          : "❌ MOVIE ORDER REJECTED\n\n" +
            "Order: " +
            order.orderId +
            "\n" +
            "Movie: " +
            order.movieTitle +
            "\n\n" +
            "🚫 Movie access has been BLOCKED.";

    } else {

      adminMessage =
        status === "ACCEPTED"

          ? "✅ INSTAGRAM ORDER ACCEPTED\n\n" +
            "Order: " +
            order.orderId

          : "❌ INSTAGRAM ORDER REJECTED\n\n" +
            "Order: " +
            order.orderId;
    }


    await notifyTelegram(
      adminMessage
    );


    res.json({

      ok:
        true,

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
          "Order not found."
      });
    }


    /*
      Do NOT expose screenshot
      or sensitive admin information.
    */

    res.json({

      orderId:
        order.orderId,

      type:
        order.type,

      status:
        order.status,

      accessGranted:
        order.type === "movie"
          ? order.accessGranted === true
          : false,

      movieId:
        order.type === "movie"
          ? order.movieId
          : null,

      movieTitle:
        order.type === "movie"
          ? order.movieTitle
          : null,

      package:
        order.type === "instagram"
          ? order.package
          : null,

      createdAt:
        order.createdAt
    });
  }
);


/* =========================================================
   MOVIE ACCESS
=========================================================

   IMPORTANT:

   Movie is streamed ONLY when:

   1. Order exists
   2. Order is a movie order
   3. Correct movie belongs to order
   4. Payment/order is ACCEPTED
   5. accessGranted === true

========================================================= */

app.get(
  "/api/movies/:movieId/access/:orderId",
  (req, res) => {

    const {
      movieId,
      orderId
    } = req.params;


    const movie =
      MOVIES[movieId];

    if (!movie) {

      return res.status(404).send(
        "Movie not found."
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


    /*
      ACCESS CONTROL
    */

    if (
      order.type !== "movie" ||
      order.movieId !== movieId ||
      order.status !== "ACCEPTED" ||
      order.accessGranted !== true
    ) {

      return res.status(403).send(
        "Movie access has not been granted."
      );
    }


    const moviePath =
      path.join(
        MOVIES_DIR,
        movie.file
      );


    if (
      !fs.existsSync(
        moviePath
      )
    ) {

      return res.status(404).send(
        "Movie file is not available."
      );
    }


    /*
      Basic path safety.
    */

    const resolved =
      path.resolve(
        moviePath
      );

    const moviesRoot =
      path.resolve(
        MOVIES_DIR
      );


    if (
      !resolved.startsWith(
        moviesRoot + path.sep
      )
    ) {

      return res.status(403).send(
        "Invalid movie file."
      );
    }


    /*
      Stream the movie.

      Browser video players support
      Range requests, so we handle them.
    */

    const stat =
      fs.statSync(
        resolved
      );

    const fileSize =
      stat.size;

    const range =
      req.headers.range;


    if (!range) {

      res.writeHead(
        200,
        {
          "Content-Length":
            fileSize,

          "Content-Type":
            "video/mp4",

          "Accept-Ranges":
            "bytes",

          "Cache-Control":
            "private, no-store"
        }
      );

      fs.createReadStream(
        resolved
      ).pipe(res);

      return;
    }


    const parts =
      range
        .replace(
          /bytes=/,
          ""
        )
        .split("-");


    const start =
      parseInt(
        parts[0],
        10
      );

    const end =
      parts[1]
        ? parseInt(
            parts[1],
            10
          )
        : fileSize - 1;


    if (
      Number.isNaN(start) ||
      start >= fileSize ||
      end >= fileSize
    ) {

      res.status(416).end();
      return;
    }


    const chunkSize =
      end - start + 1;


    res.writeHead(
      206,
      {
        "Content-Range":
          `bytes ${start}-${end}/${fileSize}`,

        "Accept-Ranges":
          "bytes",

        "Content-Length":
          chunkSize,

        "Content-Type":
          "video/mp4",

        "Cache-Control":
          "private, no-store"
      }
    );


    fs.createReadStream(
      resolved,
      {
        start,
        end
      }
    ).pipe(res);
  }
);


/* =========================================================
   EXPLICIT HTML ROUTES
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
          "API endpoint not found."
      });
    }

    res.status(404).send(
      "Page not found."
    );
  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "SehrAn Media server running on port " +
      PORT
    );

    console.log(
      "Movie catalog:",
      Object.keys(MOVIES)
    );
  }
);
