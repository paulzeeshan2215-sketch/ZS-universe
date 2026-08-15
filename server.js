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
   STATIC FILES
========================================================= */

app.use(
  express.static(PUBLIC_DIR)
);


/* =========================================================
   ORDER FILE HELPERS
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

    if (!Array.isArray(orders)) {
      return [];
    }

    return orders;

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
   MOBILE NUMBER
========================================================= */

function cleanMobile(
  value
) {

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


function validMobile(
  mobile
) {

  if (!mobile) {
    return false;
  }

  /*
    Indian mobile number:

    10 digits:
    9876543210

    Or:

    +919876543210
    919876543210
  */

  const normalized =
    mobile.replace(
      /^\+91/,
      ""
    ).replace(
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

function cleanEmail(
  value
) {

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


function validEmail(
  email
) {

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

function cleanUsername(
  username
) {

  return cleanText(
    username,
    30
  ).replace(
    /^@+/,
    ""
  );
}


function validUsername(
  username
) {

  return /^[A-Za-z0-9._]{1,30}$/.test(
    username
  );
}


/* =========================================================
   INSTAGRAM PROFILE URL
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

    /*
      Only allow a normal Instagram
      profile path.

      Example:
      /username
      /username/
    */

    return /^\/[A-Za-z0-9._]+\/?$/.test(
      url.pathname
    );

  } catch (error) {

    return false;
  }
}


/* =========================================================
   UTR VALIDATION
   OPTIONAL
========================================================= */

function validUTR(
  utr
) {

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
   AMOUNT VALIDATION
========================================================= */

function cleanAmount(
  value
) {

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
   SCREENSHOT DATA URL PARSER
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


  /*
    Base64 sanity check
  */

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
   REAL IMAGE SIGNATURE CHECK
========================================================= */

function detectImageType(
  buffer
) {

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 12
  ) {
    return null;
  }


  /*
    JPEG

    FF D8 FF
  */

  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {

    return "image/jpeg";
  }


  /*
    PNG

    89 50 4E 47 0D 0A 1A 0A
  */

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


  /*
    WEBP

    RIFF .... WEBP
  */

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
   PAYMENT SCREENSHOT SAVE
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


  /*
    Check actual binary image
    signature.

    This prevents someone from
    simply renaming a random file
    to .jpg / .png.
  */

  const detectedType =
    detectImageType(
      buffer
    );


  if (!detectedType) {

    throw new Error(
      "The uploaded file is not a valid image."
    );
  }


  /*
    Make sure MIME type matches
    actual file type.
  */

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
   TELEGRAM SEND MESSAGE
========================================================= */

async function notifyTelegram(
  text
) {

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
   TELEGRAM SEND ACTUAL SCREENSHOT
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

    /*
      Node.js 18+ provides:
      FormData + Blob
    */

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

          body:
            form
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
   CREATE NEW ORDER
========================================================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const body =
        req.body || {};


      /* ---------------------------------------------------
         NEVER ACCEPT PASSWORDS
      --------------------------------------------------- */

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
         READ FORM DATA
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         REQUIRED FIELDS
         
         Contact:
         MOBILE OR EMAIL

         Instagram:
         USERNAME + PROFILE

         Screenshot:
         REQUIRED
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         MOBILE OR EMAIL
      --------------------------------------------------- */

      if (
        !mobile &&
        !email
      ) {

        return res.status(400).json({

          error:
            "Please provide either your mobile number or email address."

        });
      }


      /* ---------------------------------------------------
         IF MOBILE IS PROVIDED
         VALIDATE IT
      --------------------------------------------------- */

      if (
        mobile &&
        !validMobile(mobile)
      ) {

        return res.status(400).json({

          error:
            "Please enter a valid Indian mobile number."

        });
      }


      /* ---------------------------------------------------
         IF EMAIL IS PROVIDED
         VALIDATE IT
      --------------------------------------------------- */

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
         INSTAGRAM USERNAME
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         INSTAGRAM PROFILE
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         UTR
         
         OPTIONAL
      --------------------------------------------------- */

      if (
        !validUTR(utr)
      ) {

        return res.status(400).json({

          error:
            "Please enter a valid UTR or leave it empty."

        });
      }


      /* ---------------------------------------------------
         PROMO
         
         OPTIONAL
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         AMOUNT
      --------------------------------------------------- */

      if (!amount) {

        return res.status(400).json({

          error:
            "Invalid payment amount."

        });
      }


      /* ---------------------------------------------------
         CREATE ORDER ID
      --------------------------------------------------- */

      const orderId =
        createOrderId();


      /* ---------------------------------------------------
         SAVE SCREENSHOT
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         CREATE ORDER OBJECT
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SAVE ORDER
      --------------------------------------------------- */

      const orders =
        readOrders();


      orders.unshift(
        order
      );


      writeOrders(
        orders
      );


      /* ---------------------------------------------------
         SCREENSHOT URL
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         CONTACT DISPLAY
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         TELEGRAM ORDER MESSAGE
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SEND TELEGRAM MESSAGE
      --------------------------------------------------- */

      await notifyTelegram(
        message
      );


      /* ---------------------------------------------------
         SEND ACTUAL SCREENSHOT TO TELEGRAM
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SUCCESS RESPONSE
      --------------------------------------------------- */

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
   EXPLICIT HTML ROUTES
========================================================= */

app.get(
  "/order.html",
  (req, res) => {

    const orderPage =
      path.join(
        PUBLIC_DIR,
        "order.html"
      );


    if (
      fs.existsSync(
        orderPage
      )
    ) {

      return res.sendFile(
        orderPage
      );

    }


    return res.status(404).send(
      "order.html was not found inside the public folder."
    );

  }
);


app.get(
  "/admin.html",
  (req, res) => {

    const adminPage =
      path.join(
        PUBLIC_DIR,
        "admin.html"
      );


    if (
      fs.existsSync(
        adminPage
      )
    ) {

      return res.sendFile(
        adminPage
      );

    }


    return res.status(404).send(
      "admin.html was not found inside the public folder."
    );

  }
);


/* =========================================================
   HOME PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {

    const indexPage =
      path.join(
        PUBLIC_DIR,
        "index.html"
      );


    if (
      fs.existsSync(
        indexPage
      )
    ) {

      return res.sendFile(
        indexPage
      );

    }


    return res.status(404).send(
      "index.html was not found inside the public folder."
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

  }
);
