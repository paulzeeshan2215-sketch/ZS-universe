SehrAn Games — safe virtual-coin prototype
This version follows the mobile-game-library look of the supplied references while avoiding real-money wagering, deposits, withdrawals, or rigged 40/60 cash-game outcomes.
Run
Install Node.js 18+.
`npm install`
`npm start`
Open `http://localhost:3000`
Real OTP
The server intentionally does not display a fake/demo OTP. Configure a real SMS provider:
`SMS_API_URL`
`SMS_API_KEY`
The provider should accept a JSON body containing `to` and `message`. Adapt `sendSmsOtp()` to the provider you choose.
Promo
`ZEESHAN10` gives 1,000 virtual coins once per browser.
Game artwork and music
The game cards currently use original emoji placeholders. Replace them with artwork you own or have permission to use.
For background/game music, add audio files you have rights to and wire them into the page; do not upload copyrighted commercial tracks without permission.
Important
The balance is virtual only. There are no payment, deposit, withdrawal, UPI, bank-account, or cash-prize endpoints in this version.
