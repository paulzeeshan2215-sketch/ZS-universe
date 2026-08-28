const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]", "utf8");
}

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));


// ============================================================
// USER DATABASE
// ============================================================

function readUsers() {
  try {
    return JSON.parse(
      fs.readFileSync(USERS_FILE, "utf8")
    );
  } catch (error) {
    console.error("Could not read users.json:", error);
    return [];
  }
}


function writeUsers(users) {
  const tempFile = `${USERS_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(users, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, USERS_FILE);
}


// ============================================================
// SECURITY HELPERS
// ============================================================

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}


function cleanMobile(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .slice(0, 16);
}


function isValidIndianMobile(value) {
  const mobile = cleanMobile(value)
    .replace(/^\+91/, "")
    .replace(/^91(?=\d{10}$)/, "");

  return /^[6-9]\d{9}$/.test(mobile);
}


function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex")
) {
  const passwordHash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return {
    salt,
    passwordHash
  };
}


function verifyPassword(password, user) {
  try {
    const calculated = crypto.scryptSync(
      password,
      user.passwordSalt,
      64
    );

    const stored = Buffer.from(
      user.passwordHash,
      "hex"
    );

    return (
      stored.length === calculated.length &&
      crypto.timingSafeEqual(
        calculated,
        stored
      )
    );
  } catch {
    return false;
  }
}


// ============================================================
// REAL OTP CONFIGURATION
// ============================================================
//
// Render Environment Variables:
//
// SMS_API_URL
// SMS_API_KEY
//
// The server does NOT display a fake/demo OTP.
//
// The SMS provider receives:
//
// {
//   "to": "mobile number",
//   "message": "Your SehrAn Games OTP is 123456"
// }
//
// If your SMS provider uses another API format,
// modify sendSmsOtp() below.
// ============================================================

async function sendSmsOtp(mobile, otp) {

  const smsApiUrl = process.env.SMS_API_URL;
  const smsApiKey = process.env.SMS_API_KEY;

  if (!smsApiUrl || !smsApiKey) {
    return false;
  }

  const response = await fetch(
    smsApiUrl,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${smsApiKey}`
      },

      body: JSON.stringify({
        to: mobile,
        message:
          `Your SehrAn Games OTP is ${otp}. It expires in 5 minutes.`
      })
    }
  );

  if (!response.ok) {

    const body =
      await response.text().catch(() => "");

    console.error(
      "SMS provider error:",
      response.status,
      body
    );

    return false;
  }

  return true;
}


// ============================================================
// OTP + SESSION STORAGE
// ============================================================

const otpStore = new Map();
const sessions = new Map();


// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",
  (_req, res) => {

    res.json({
      ok: true,
      service: "SehrAn Games",
      time: new Date().toISOString()
    });

  }
);


// ============================================================
// REQUEST OTP
// ============================================================

app.post(
  "/api/auth/request-otp",
  async (req, res) => {

    try {

      const name =
        String(req.body.name || "")
          .trim()
          .slice(0, 40);

      const mobile =
        cleanMobile(req.body.mobile);

      const password =
        String(req.body.password || "");


      // NAME CHECK

      if (!name) {

        return res.status(400).json({
          error: "Please enter your name."
        });

      }


      // MOBILE CHECK

      if (!isValidIndianMobile(mobile)) {

        return res.status(400).json({
          error:
            "Please enter a valid Indian mobile number."
        });

      }


      // PASSWORD CHECK

      if (
        password.length < 8 ||
        password.length > 72
      ) {

        return res.status(400).json({
          error:
            "Password must be between 8 and 72 characters."
        });

      }


      const users = readUsers();

      let user =
        users.find(
          item => item.mobile === mobile
        );


      // ======================================================
      // NEW USER
      // ======================================================

      if (!user) {

        const passwordData =
          hashPassword(password);

        user = {

          id: makeToken(),

          name,

          mobile,

          passwordSalt:
            passwordData.salt,

          passwordHash:
            passwordData.passwordHash,

          createdAt:
            new Date().toISOString()

        };

        users.push(user);

      }


      // ======================================================
      // EXISTING USER
      // ======================================================

      else {

        if (
          !verifyPassword(
            password,
            user
          )
        ) {

          return res.status(401).json({
            error:
              "Incorrect password."
          });

        }

        user.name = name;
      }


      // ======================================================
      // CREATE REAL RANDOM OTP
      // ======================================================

      const otp =
        String(
          crypto.randomInt(
            100000,
            1000000
          )
        );


      otpStore.set(
        mobile,
        {

          otp,

          expiresAt:
            Date.now() +
            5 * 60 * 1000,

          attempts: 0

        }
      );


      // ======================================================
      // SEND OTP THROUGH SMS PROVIDER
      // ======================================================

      const sent =
        await sendSmsOtp(
          mobile,
          otp
        );


      if (!sent) {

        otpStore.delete(mobile);

        return res.status(503).json({

          error:
            "Real OTP service is not configured. Add SMS_API_URL and SMS_API_KEY in Render Environment Variables."

        });

      }


      writeUsers(users);


      return res.json({

        ok: true,

        message:
          "OTP sent to your mobile number."

      });

    }

    catch (error) {

      console.error(
        "request-otp error:",
        error
      );

      return res.status(500).json({

        error:
          "Unable to request OTP right now."

      });

    }

  }
);


// ============================================================
// VERIFY OTP
// ============================================================

app.post(
  "/api/auth/verify-otp",
  (req, res) => {

    try {

      const mobile =
        cleanMobile(req.body.mobile);

      const otp =
        String(
          req.body.otp || ""
        ).trim();


      const record =
        otpStore.get(mobile);


      // OTP NOT FOUND

      if (!record) {

        return res.status(400).json({

          error:
            "OTP not found. Please request a new OTP."

        });

      }


      // OTP EXPIRED

      if (
        Date.now() >
        record.expiresAt
      ) {

        otpStore.delete(mobile);

        return res.status(400).json({

          error:
            "OTP expired. Please request a new OTP."

        });

      }


      // ATTEMPT COUNT

      record.attempts += 1;


      if (record.attempts > 5) {

        otpStore.delete(mobile);

        return res.status(429).json({

          error:
            "Too many OTP attempts. Please request a new OTP."

        });

      }


      // OTP WRONG

      if (record.otp !== otp) {

        return res.status(401).json({

          error:
            "Invalid OTP."

        });

      }


      // OTP CORRECT

      otpStore.delete(mobile);


      const users =
        readUsers();


      const user =
        users.find(
          item =>
            item.mobile === mobile
        );


      if (!user) {

        return res.status(404).json({

          error:
            "Account not found."

        });

      }


      // ======================================================
      // CREATE LOGIN SESSION
      // ======================================================

      const sessionToken =
        makeToken();


      sessions.set(
        sessionToken,
        {

          userId:
            user.id,

          expiresAt:
            Date.now() +
            24 * 60 * 60 * 1000

        }
      );


      return res.json({

        ok: true,

        session:
          sessionToken,

        name:
          user.name

      });

    }

    catch (error) {

      console.error(
        "verify-otp error:",
        error
      );

      return res.status(500).json({

        error:
          "Unable to verify OTP right now."

      });

    }

  }
);


// ============================================================
// CHECK LOGIN SESSION
// ============================================================

app.get(
  "/api/auth/session",
  (req, res) => {

    const sessionToken =
      String(
        req.headers[
          "x-session-token"
        ] || ""
      );


    if (!sessionToken) {

      return res.status(401).json({

        error:
          "Not logged in."

      });

    }


    const session =
      sessions.get(
        sessionToken
      );


    if (
      !session ||
      Date.now() >
        session.expiresAt
    ) {

      sessions.delete(
        sessionToken
      );

      return res.status(401).json({

        error:
          "Session expired."

      });

    }


    const user =
      readUsers().find(
        item =>
          item.id ===
          session.userId
      );


    if (!user) {

      sessions.delete(
        sessionToken
      );

      return res.status(401).json({

        error:
          "User not found."

      });

    }


    return res.json({

      ok: true,

      name:
        user.name,

      mobile:
        user.mobile

    });

  }
);


// ============================================================
// LOGOUT
// ============================================================

app.post(
  "/api/auth/logout",
  (req, res) => {

    const sessionToken =
      String(
        req.headers[
          "x-session-token"
        ] || ""
      );


    if (sessionToken) {

      sessions.delete(
        sessionToken
      );

    }


    res.json({
      ok: true
    });

  }
);


// ============================================================
// EXPRESS 5 FALLBACK
// ============================================================
//
// IMPORTANT:
//
// Old Express versions used:
//
// app.get("*", ...)
//
// Express 5 does not accept that syntax.
//
// This is the Express 5-compatible version:
//
// app.get("/{*splat}", ...)
//
// This fixes:
//
// PathError [TypeError]:
// Missing parameter name at index 1: *
// ============================================================

app.get(
  "/{*splat}",
  (_req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );

  }
);


// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {

    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({

      error:
        "Internal server error."

    });

  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `SehrAn Games server running on port ${PORT}`
    );

  }
);
