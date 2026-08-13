const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const STORE = path.join(__dirname, "orders.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

const ADMIN_KEY =
process.env.ADMIN_KEY || "CHANGE_THIS_ADMIN_KEY";

const TG_BOT_TOKEN =
process.env.TG_BOT_TOKEN || "";

const TG_CHAT_ID =
process.env.TG_CHAT_ID || "7006568699";

if (!fs.existsSync(PUBLIC_DIR)) {
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(STORE)) {
fs.writeFileSync(STORE, "[]", "utf8");
}

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(express.static(PUBLIC_DIR));

function readOrders() {
try {
const data = fs.readFileSync(STORE, "utf8");

```
if (!data.trim()) {
  return [];
}

const orders = JSON.parse(data);

return Array.isArray(orders) ? orders : [];
```

} catch (error) {
console.error("Error reading orders.json:", error);
return [];
}
}

function writeOrders(orders) {
fs.writeFileSync(
STORE,
JSON.stringify(orders, null, 2),
"utf8"
);
}

function createOrderId() {
return "SM" + Date.now().toString().slice(-8);
}

function cleanText(value, maxLength) {
if (typeof value !== "string") {
return "";
}

return value
.trim()
.replace(/\s+/g, " ")
.slice(0, maxLength);
}

function validName(name) {
if (name.length < 2 || name.length > 60) {
return false;
}

if (/^(.)\1{4,}$/.test(name)) {
return false;
}

return /^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(name);
}

function cleanUsername(username) {
let value = cleanText(username, 30);

value = value.replace(/^@+/, "");

return value;
}

function validUsername(username) {
return /^[A-Za-z0-9._]{1,30}$/.test(username);
}

function validInstagramProfile(profile) {
if (
typeof profile !== "string" ||
profile.length > 300
) {
return false;
}

try {
const url = new URL(profile);

```
const hostname = url.hostname
  .toLowerCase()
  .replace(/^www\./, "");

if (
  hostname !== "instagram.com" &&
  hostname !== "instagr.am"
) {
  return false;
}

return /^\/[A-Za-z0-9._]+\/?$/.test(
  url.pathname
);
```

} catch (error) {
return false;
}
}

function validUTR(utr) {
if (typeof utr !== "string") {
return false;
}

const value = utr.trim();

if (value.length < 6 || value.length > 80) {
return false;
}

return /^[A-Za-z0-9._-]+$/.test(value);
}

function saveScreenshot(screenshot, orderId) {
if (
typeof screenshot !== "string" ||
screenshot.length === 0
) {
return null;
}

let extension = "";
let base64Data = "";

const jpegPrefix = "data:image/jpeg;base64,";
const pngPrefix = "data:image/png;base64,";
const webpPrefix = "data:image/webp;base64,";

if (screenshot.startsWith(jpegPrefix)) {
extension = "jpg";
base64Data = screenshot.slice(jpegPrefix.length);
} else if (screenshot.startsWith(pngPrefix)) {
extension = "png";
base64Data = screenshot.slice(pngPrefix.length);
} else if (screenshot.startsWith(webpPrefix)) {
extension = "webp";
base64Data = screenshot.slice(webpPrefix.length);
} else {
throw new Error(
"Invalid payment screenshot format."
);
}

if (base64Data.length > 8 * 1024 * 1024) {
throw new Error(
"Payment screenshot is too large."
);
}

const buffer = Buffer.from(base64Data, "base64");

if (buffer.length > 5 * 1024 * 1024) {
throw new Error(
"Payment screenshot must be 5 MB or smaller."
);
}

const filename = orderId + "." + extension;

const filepath = path.join(
UPLOADS_DIR,
filename
);

fs.writeFileSync(filepath, buffer);

return "/uploads/" + filename;
}

async function notifyTelegram(text) {
if (!TG_BOT_TOKEN) {
console.log(
"Telegram bot token is not configured."
);

```
return {
  sent: false,
  reason: "Telegram bot token not configured"
};
```

}

try {
const telegramUrl =
"https://api.telegram.org/bot" +
TG_BOT_TOKEN +
"/sendMessage";

```
const response = await fetch(
  telegramUrl,
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

const body = await response.text();

return {
  sent: response.ok,
  body: body
};
```

} catch (error) {
console.error("Telegram error:", error);

```
return {
  sent: false,
  reason: "Telegram request failed"
};
```

}
}

app.post(
"/api/orders",
async function (req, res) {
try {
const body = req.body || {};

```
  const pkg = cleanText(
    body.package,
    100
  );

  const name = cleanText(
    body.name,
    60
  );

  const username = cleanUsername(
    body.username
  );

  const profile = cleanText(
    body.profile,
    300
  );

  const utr = cleanText(
    body.utr,
    80
  );

  const promoCode = cleanText(
    body.promoCode ||
    body.coupon ||
    "",
    30
  ).toUpperCase();

  const amount = cleanText(
    String(body.amount || ""),
    30
  );

  const screenshot =
    body.screenshot || "";

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

  if (!validName(name)) {
    return res.status(400).json({
      error:
        "Please enter a valid name."
    });
  }

  if (!validUsername(username)) {
    return res.status(400).json({
      error:
        "Please enter a valid Instagram username."
    });
  }

  if (!validInstagramProfile(profile)) {
    return res.status(400).json({
      error:
        "Please enter a valid Instagram profile link."
    });
  }

  if (utr && !validUTR(utr)) {
    return res.status(400).json({
      error:
        "Please enter a valid payment UTR or leave it empty."
    });
  }

  if (promoCode !== "ZEESHAN10") {
    return res.status(400).json({
      error:
        "Invalid promo code. Please enter ZEESHAN10."
    });
  }

  const orderId = createOrderId();

  let screenshotPath = null;

  try {
    screenshotPath = saveScreenshot(
      screenshot,
      orderId
    );
  } catch (screenshotError) {
    return res.status(400).json({
      error:
        screenshotError.message
    });
  }

  const order = {
    orderId: orderId,
    status: "PENDING",
    package: pkg,
    name: name,
    username: username,
    profile: profile,
    utr: utr || "",
    promoCode: promoCode,
    amount: amount,
    screenshot: screenshotPath,
    createdAt: new Date().toISOString()
  };

  const orders = readOrders();

  orders.unshift(order);

  writeOrders(orders);

  const adminUrl =
    process.env.ADMIN_URL || "";

  const screenshotUrl =
    screenshotPath && adminUrl
      ? adminUrl + screenshotPath
      : "Saved on server";

  const message =
    "🔔 NEW ORDER " +
    order.orderId +
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
    (amount || "Not specified") +
    "\n" +
    "UTR: " +
    (utr || "Not provided") +
    "\n" +
    "Promo Code: " +
    promoCode +
    "\n\n" +
    "Payment screenshot: " +
    screenshotUrl +
    "\n\n" +
    "⚠️ Verify payment before accepting the order.";

  try {
    await notifyTelegram(message);
  } catch (telegramError) {
    console.error(
      "Telegram notification error:",
      telegramError
    );
  }

  return res.json({
    ok: true,
    orderId: order.orderId,
    status: order.status
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
```

}
);

function admin(req, res, next) {
const key =
req.headers["x-admin-key"];

if (key !== ADMIN_KEY) {
return res.status(401).json({
error: "Unauthorized"
});
}

next();
}

app.get(
"/api/admin/orders",
admin,
function (req, res) {
return res.json(readOrders());
}
);

app.post(
"/api/admin/orders/:id/status",
admin,
function (req, res) {
const allowed = [
"ACCEPTED",
"REJECTED"
];

```
const status =
  req.body &&
  req.body.status;

if (!allowed.includes(status)) {
  return res.status(400).json({
    error: "Invalid status"
  });
}

const orders = readOrders();

const order = orders.find(
  function (item) {
    return (
      item.orderId ===
      req.params.id
    );
  }
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

return res.json({
  ok: true,
  order: order
});
```

}
);

app.get(
"/api/orders/:id",
function (req, res) {
const orders = readOrders();

```
const order = orders.find(
  function (item) {
    return (
      item.orderId ===
      req.params.id
    );
  }
);

if (!order) {
  return res.status(404).json({
    error: "Order not found"
  });
}

return res.json({
  orderId: order.orderId,
  status: order.status,
  package: order.package,
  createdAt: order.createdAt
});
```

}
);

app.get(
"/",
function (req, res) {
res.sendFile(
path.join(
PUBLIC_DIR,
"index.html"
)
);
}
);

app.use(
function (req, res, next) {
if (
req.path.startsWith("/api/")
) {
return res.status(404).json({
error:
"API endpoint not found"
});
}

```
next();
```

}
);

app.listen(
PORT,
function () {
console.log(
"SehrAn Media server running on port " +
PORT
);
}
);
