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
    const data = fs.readFileSync(
      STORE,
      "utf8"
    );

    if (!data.trim()) {
      return [];
    }

    const orders = JSON.parse(data);

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
   NAME VALIDATION
========================================================= */

function validName(name) {
  if (
    name.length < 2 ||
    name.length > 60
  ) {
    return false;
  }

  if (
    /^(.)\1{4,}$/i.test(name)
  ) {
    return false;
  }

  return /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(
    name
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
   INSTAGRAM PROFILE URL
========================================================= */

function validInstagramProfile(profile) {
  if (
    typeof profile !== "string" ||
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
   UTR VALIDATION
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
   PAYMENT SCREENSHOT SAVE
========================================================= */

function saveScreenshot(
  screenshot,
  orderId
) {
  if (
    typeof screenshot !== "string" ||
    !screenshot
  ) {
    throw new Error(
      "Payment screenshot is required."
    );
  }

  let extension = "";
  let base64Data = "";

  const jpegPrefix =
    "data:image/jpeg;base64,";

  const jpgPrefix =
    "data:image/jpg;base64,";

  const pngPrefix =
    "data:image/png;base64,";

  const webpPrefix =
    "data:image/webp;base64,";


  if (
    screenshot.startsWith(
      jpegPrefix
    )
  ) {
    extension = "jpg";

    base64Data =
      screenshot.slice(
        jpegPrefix.length
      );

  } else if (
    screenshot.startsWith(
      jpgPrefix
    )
  ) {
    extension = "jpg";

    base64Data =
      screenshot.slice(
        jpgPrefix.length
      );

  } else if (
    screenshot.startsWith(
      pngPrefix
    )
  ) {
    extension = "png";

    base64Data =
      screenshot.slice(
        pngPrefix.length
      );

  } else if (
    screenshot.startsWith(
      webpPrefix
    )
  ) {
    extension = "webp";

    base64Data =
      screenshot.slice(
        webpPrefix.length
      );

  } else {
    throw new Error(
      "Please upload a valid JPG, PNG or WEBP screenshot."
    );
  }


  const buffer =
    Buffer.from(
      base64Data,
      "base64"
    );


  if (
    buffer.length === 0
  ) {
    throw new Error(
      "The payment screenshot could not be read."
    );
  }


  if (
    buffer.length >
    5 * 1024 * 1024
  ) {
    throw new Error(
      "Payment screenshot must be 5 MB or smaller."
    );
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


  return (
    "/uploads/" +
    filename
  );
}


/* =========================================================
   TELEGRAM NOTIFICATION
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
        "Telegram response:",
        await response.text()
      );

      return false;
    }


    return true;

  } catch (error) {
    console.error(
      "Telegram notification error:",
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
         SECURITY: NEVER ACCEPT PASSWORDS
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


      const name =
        cleanText(
          body.name,
          60
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
        cleanText(
          String(
            body.amount || ""
          ),
          30
        );


      const screenshot =
        body.screenshot || "";


      /* ---------------------------------------------------
         REQUIRED FIELDS
      --------------------------------------------------- */

      if (
        !pkg ||
        !name ||
        !username ||
        !profile ||
        !screenshot
      ) {
        return res.status(400).json({
          error:
            "Please complete all required fields and upload your payment screenshot."
        });
      }


      /* ---------------------------------------------------
         VALIDATE NAME
      --------------------------------------------------- */

      if (
        !validName(name)
      ) {
        return res.status(400).json({
          error:
            "Please enter a valid name."
        });
      }


      /* ---------------------------------------------------
         VALIDATE INSTAGRAM USERNAME
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
         VALIDATE INSTAGRAM PROFILE
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
         VALIDATE UTR
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
         PROMO CODE
      --------------------------------------------------- */

      if (
        promoCode &&
        promoCode !==
          "ZEESHAN10"
      ) {
        return res.status(400).json({
          error:
            "Invalid promo code. Please use ZEESHAN10."
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

      let screenshotPath;


      try {

        screenshotPath =
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

        name:
          name,

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
          screenshotPath,

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
         CREATE SCREENSHOT URL
      --------------------------------------------------- */

      let screenshotUrl =
        screenshotPath;


      if (ADMIN_URL) {

        screenshotUrl =
          ADMIN_URL.replace(
            /\/$/,
            ""
          ) +
          screenshotPath;
      }


      /* ---------------------------------------------------
         TELEGRAM MESSAGE
      --------------------------------------------------- */

      const message =
        "🔔 NEW ORDER " +
        orderId +
        "\n\n" +

        "Name: " +
        name +
        "\n" +

        "Instagram: @" +
        username +
        "\n" +

        "Profile: " +
        profile +
        "\n" +

        "Package: " +
        pkg +
        "\n" +

        "Amount: ₹" +
        (
          amount ||
          "Not specified"
        ) +
        "\n" +

        "UTR: " +
        (
          utr ||
          "Not provided"
        ) +
        "\n" +

        "Promo Code: " +
        (
          promoCode ||
          "Not used"
        ) +
        "\n\n" +

        "Payment Screenshot:\n" +
        screenshotUrl +
        "\n\n" +

        "⚠️ Verify payment before accepting.";


      /* ---------------------------------------------------
         SEND TELEGRAM
      --------------------------------------------------- */

      await notifyTelegram(
        message
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
   These help prevent "Cannot GET /order.html"
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
      fs.existsSync(orderPage)
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
      fs.existsSync(adminPage)
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
      fs.existsSync(indexPage)
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
