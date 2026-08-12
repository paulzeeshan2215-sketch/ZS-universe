# SehrAn Media — Live Order System

This is a deploy-ready starter for a real order workflow:
Customer -> order saved -> Telegram notification -> admin Accept/Reject -> status endpoint.

## Important
Never collect an Instagram password. This project intentionally does not have a password field.

## Required environment variables
- ADMIN_KEY: strong secret for admin dashboard/API
- TG_BOT_TOKEN: Telegram Bot API token from @BotFather
- TG_CHAT_ID: your Telegram chat ID (configured as 7006568699)
- ADMIN_URL: public URL of the admin dashboard

## Run
npm install
ADMIN_KEY=change-me TG_BOT_TOKEN=YOUR_BOT_TOKEN TG_CHAT_ID=7006568699 ADMIN_URL=https://your-domain.com/admin.html npm start

Then open /public/order.html through the server (the server serves public/ at root), and /admin.html for the admin dashboard.
