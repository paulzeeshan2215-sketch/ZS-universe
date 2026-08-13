```js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

/*
  Keep the JSON limit controlled.
  The payment screenshot will be limited by the frontend
  and checked again on the server.
*/
app.use(express.json({ limit: "12mb" }));

/* Static website */
app.use(express.static(path.join(__dirname, "public")));

/* Uploaded payment screenshots */
const UPLOADS = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(UPLOADS)) {
  fs.mkdirSync(UPLOADS, { recursive: true });
}

app.use(
  "/uploads",
  express.static(UPLOADS)
);

/* Server settings */
const PORT = process.env.PORT || 3000;

const STORE = path.join(
  __dirname,
  "orders.json"
);

const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  "CHANGE_THIS_ADMIN_KEY";

const TG_BOT_TOKEN =
  process.env.TG_BOT_TOKEN || "";

const TG_CHAT_ID =
  process.env.TG_CHAT_ID ||
  "7006568699";


/* =========================
   ORDER STORAGE
========================= */

function readOrders() {
  try {
    if (!fs.existsSync(STORE)) {
      return [];
    }

    const data =
      fs.readFileSync(STORE, "utf8");

    if (!data.trim()) {
      return [];
    }

    const parsed = JSON.parse(data);

    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    console.error(
      "Unable to read orders.json:",
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
    )
  );
}


/* =========================
   ORDER ID
========================= */

function createOrderId() {

  return (
    "SM" +
    Date.now()
      .toString()
      .slice(-8)
  );
}


/* =========================
   TELEGRAM
========================= */

async function notifyTelegram(text) {

  if (!TG_BOT_TOKEN) {

    console.log(
      "Telegram bot token is not configured."
    );

    return {
      sent: false,
      reason:
        "Telegram bot token not configured"
    };
  }

  try {

    const response =
      await fetch(
        `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            chat_id: TG_CHAT_ID,
            text: text
          })
        }
      );

    return {
      sent: response.ok,
      body: await response.text()
    };

  } catch (error) {

    console.error(
      "Telegram request failed:",
      error
    );

    return {
      sent: false,
      reason: "Telegram request failed"
    };
  }
}


/* =========================
   VALIDATION HELPERS
========================= */

function cleanText(value, maxLength = 200) {

  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}


function validName(name) {

  if (
    name.length < 2 ||
    name.length > 60
  ) {
    return false;
  }

  /*
    Prevent obviously fake repeated input
    such as "aaaaaaa".
  */
  if (/(.)\1{4,}/i.test(name)) {
    return false;
  }

  return /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(
    name
  );
}


function cleanUsername(username) {

  let value =
    cleanText(username, 35);

  value =
    value.replace(/^@+/, "");

  return value;
}


function validUsername(username) {

  return (
    /^[A-Za-z0-9._]{1,30}$/.test(
      username
    ) &&
    /[A-Za-z0-9]/.test(username)
  );
}


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
        .replace(/^www\./, "");

    if (
      hostname !== "instagram.com" &&
      hostname !== "instagr.am"
    ) {
      return false;
    }

    /*
      Accept a normal Instagram profile path.
    */
    return /^\/[A-Za-z0-9._]+\/?$/.test(
      url.pathname
    );

  } catch {

    return false;
  }
}


function validUTR(utr) {

  if (
    typeof utr !== "string"
  ) {
    return false;
  }

  const value =
    utr.trim();

  return (
    value.length >= 6 &&
    value.length <= 80 &&
    /^[A-Za-z0-9._-]+$/.test(
      value
    )
  );
}


/* =========================
   SCREENSHOT VALIDATION
========================= */

function saveScreenshot(
  screenshot,
  orderId
) {

  if (
    typeof screenshot !== "string" ||
    !screenshot
  ) {
    return null;
  }

  /*
    Expected format:

    data:image/jpeg;base64,...
    data:image/png;base64,...
    data:image/webp;base64,...
  */

  const match =
    screenshot.match(
      /^data:(image\/jpeg|image\/png|image\/webp);base64,(.+)$/s
    );

  if (!match) {
    throw new Error(
      "Invalid payment screenshot format."
    );
  }

  const mimeType =
    match[1];

  const base64Data =
    match[2];

  /*
    Browser limits the screenshot to 5 MB.
    Server also protects itself.
  */
  if (
    base64Data.length >
    8 * 1024 * 1024
  ) {
    throw new Error(
      "Payment screenshot is too large."
    );
  }

  const buffer =
    Buffer.from(
      base64Data,
      "base64"
    );

  if (
    buffer.length >
    5 * 1024 * 1024
  ) {
    throw new Error(
      "Payment screenshot must be 5 MB or smaller."
    );
  }

  let extension = "jpg";

  if (mimeType === "image/png") {
    extension = "png";
  }

  if (mimeType === "image/webp") {
    extension = "webp";
  }

  const filename =
    `${orderId}.${extension}`;

  const filepath =
    path.join(
      UPLOADS,
      filename
    );

  fs.writeFileSync(
    filepath,
    buffer
  );

  return `/uploads/${filename}`;
}


/* =========================
   CREATE ORDER
========================= */

app.post(
  "/api/orders",
  async (req, res) => {

    try {

      const body =
        req.body || {};

      /*
        Accept the names used by the
        new order.html.
      */
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
          body.coupon,
          30
        ).toUpperCase();

      /*
        Never accept Instagram passwords.
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


      /* Required fields */

      if (
        !pkg ||
        !name ||
        !username ||
        !profile ||
        !utr
      ) {

        return res.status(400).json({
          error:
            "Please complete all required fields."
        });
      }


      /* Name validation */

      if (!validName(name)) {

        return res.status(400).json({
          error:
            "Please enter a valid name."
        });
      }


      /* Username validation */

      if (!validUsername(username)) {

        return res.status(400).json({
          error:
            "Please enter a valid Instagram username."
        });
      }


      /* Profile validation */

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


      /* UTR validation */

      if (!validUTR(utr)) {

        return res.status(400).json({
          error:
            "Please enter a valid payment UTR."
        });
      }


      /*
        Promo code must be verified
        on the server as well.
      */
      if (
        promoCode !==
        "ZEESHAN10"
      ) {

        return res.status(400).json({
          error:
            "Invalid promo code."
        });
      }


      /*
        The screenshot is optional for this
        first server deployment so the site
        can remain compatible while we connect
        the final upload flow.
      */
      const screenshot =
        body.screenshot || "";

      /*
        Create order ID first because the
        screenshot filename uses it.
      */
      const orderId =
        createOrderId();

      let screenshotPath = null;

      if (screenshot) {

        screenshotPath =
          saveScreenshot(
            screenshot,
            orderId
          );
      }


      /* =========================
         ORDER OBJECT
      ========================= */

      const order = {

        orderId,

        status:
          "PENDING",

        package:
          pkg,

        name,

        username,

        profile,

        utr,

        promoCode,

        screenshot:
          screenshotPath,

        createdAt:
          new Date().toISOString()
      };


      /* Save order */

      const orders =
        readOrders();

      orders.unshift(order);

      writeOrders(orders);


      /* =========================
         TELEGRAM
      ========================= */

      const screenshotText =
        screenshotPath
          ? `Screenshot: ${process.env.ADMIN_URL || ""}${screenshotPath}`
          : "Screenshot: Not attached";


      const message =
`🔔 NEW ORDER ${order.orderId}

Name: ${name}
Instagram: @${username}
Profile: ${profile}
Package: ${pkg}
UTR: ${utr}
Promo Code: ${promoCode}

${screenshotText}

⚠️ VERIFY PAYMENT BEFORE ACCEPTING.

Admin:
${process.env.ADMIN_URL || "Set ADMIN_URL"}`;


      try {

        await notifyTelegram(
          message
        );

      } catch (
        telegramError
      ) {

        console.error(
          "Telegram notification error:",
          telegramError
        );
      }


      /* Response */

      return res.json({

        ok: true,

        orderId:
          order.orderId,

        status:
          order.status

      });


    } catch (error) {

      console.error(
        "Order processing error:",
        error
      );

      return res.status(500).json({

        error:
          error.message ||
          "Unable to process order. Please try again."

      });
    }
  }
);


/* =========================
   ADMIN AUTHENTICATION
========================= */

function admin(
  req,
  res,
  next
) {

  if (
    req.headers[
      "x-admin-key"
    ] !== ADMIN_KEY
  ) {

    return res.status(401).json({

      error:
        "Unauthorized"

    });
  }

  next();
}


/* =========================
   GET ALL ORDERS
========================= */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {

    res.json(
      readOrders()
    );
  }
);


/* =========================
   ACCEPT / REJECT
========================= */

app.post(
  "/api/admin/orders/:id/status",
  admin,
  (req, res) => {

    const allowed = [
      "ACCEPTED",
      "REJECTED"
    ];

    const status =
      req.body?.status;

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
      new Date().toISOString();

    writeOrders(
      orders
    );

    res.json({

      ok: true,

      order

    });
  }
);


/* =========================
   CUSTOMER ORDER STATUS
========================= */

app.get(
  "/api/orders/:id",
  (req, res) => {

    const order =
      readOrders().find(
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

      status:
        order.status,

      package:
        order.package,

      createdAt:
        order.createdAt

    });
  }
);


/* =========================
   HOME PAGE
========================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `SehrAn Media server running on port ${PORT}`
    );

  }
);
```
