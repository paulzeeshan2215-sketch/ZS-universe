const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const STORE = path.join(__dirname, "orders.json");

const ADMIN_KEY =
  process.env.ADMIN_KEY || "CHANGE_THIS_ADMIN_KEY";

const TG_BOT_TOKEN =
  process.env.TG_BOT_TOKEN || "";

const TG_CHAT_ID =
  process.env.TG_CHAT_ID || "7006568699";

function readOrders() {
  try {
    return JSON.parse(
      fs.readFileSync(STORE, "utf8")
    );
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(
    STORE,
    JSON.stringify(orders, null, 2)
  );
}

function createOrderId() {
  return "SM" + Date.now().toString().slice(-8);
}


/* TELEGRAM NOTIFICATION */

async function notifyTelegram(text) {
  if (!TG_BOT_TOKEN) {
    return {
      sent: false,
      reason: "Telegram bot token not configured"
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
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
}


/* CREATE ORDER */

app.post("/api/orders", async (req, res) => {
  try {
    const {
      package: pkg,
      name,
      username,
      profile,
      coupon,
      amount,
      screenshot
    } = req.body || {};

    if (
      !pkg ||
      !name ||
      !username ||
      !profile ||
      !screenshot
    ) {
      return res.status(400).json({
        error:
          "Please complete all fields and upload your payment screenshot."
      });
    }

    if (
      /password|passcode/i.test(
        JSON.stringify(req.body)
      )
    ) {
      return res.status(400).json({
        error: "Passwords are not accepted."
      });
    }

    const order = {
      orderId: createOrderId(),
      status: "PENDING",
      package: pkg,
      name: name,
      username: username,
      profile: profile,
      coupon: coupon || "",
      amount: amount || "",
      screenshot: screenshot,
      createdAt: new Date().toISOString()
    };

    const orders = readOrders();

    orders.unshift(order);

    writeOrders(orders);


    /* TELEGRAM MESSAGE */

    const message =
`🔔 NEW ORDER ${order.orderId}

Name: ${name}
Instagram: ${username}
Profile: ${profile}
Package: ${pkg}
Amount: ₹${amount || "Not specified"}
Coupon: ${coupon || "None"}

Payment screenshot submitted.

⚠️ Verify the payment before accepting the order.

Admin:
${process.env.ADMIN_URL || "Set ADMIN_URL"}`;

    try {
      await notifyTelegram(message);
    } catch (telegramError) {
      console.error(
        "Telegram notification error:",
        telegramError
      );
    }


    res.json({
      ok: true,
      orderId: order.orderId,
      status: order.status
    });

  } catch (error) {
    console.error(
      "Order processing error:",
      error
    );

    res.status(500).json({
      error:
        "Unable to process order. Please try again."
    });
  }
});


/* ADMIN AUTHENTICATION */

function admin(req, res, next) {

  if (
    req.headers["x-admin-key"] !== ADMIN_KEY
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}


/* GET ALL ORDERS */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {
    res.json(readOrders());
  }
);


/* ACCEPT / REJECT ORDER */

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

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    const orders = readOrders();

    const order =
      orders.find(
        item =>
          item.orderId === req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    order.status = status;

    order.updatedAt =
      new Date().toISOString();

    writeOrders(orders);

    res.json({
      ok: true,
      order: order
    });
  }
);


/* CUSTOMER ORDER STATUS */

app.get(
  "/api/orders/:id",
  (req, res) => {

    const order =
      readOrders().find(
        item =>
          item.orderId === req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    res.json({
      orderId: order.orderId,
      status: order.status,
      package: order.package,
      createdAt: order.createdAt
    });
  }
);


/* HOME */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});


/* START SERVER */

app.listen(
  PORT,
  () => {
    console.log(
      `SehrAn Media server running on port ${PORT}`
    );
  }
);
