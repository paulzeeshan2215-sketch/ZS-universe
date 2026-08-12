const app = express();
const fs = require("fs");
const path = require("path");


app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, 'public')));


// 2. Your route code works perfectly here
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(3000, () => console.log("Server running on port 3000"));

const PORT = process.env.PORT || 3000;
const STORE = path.join(__dirname, "orders.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "CHANGE_THIS_ADMIN_KEY";
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "7006568699";

function readOrders(){ try{return JSON.parse(fs.readFileSync(STORE,"utf8"));}catch{return [];} }
function writeOrders(x){fs.writeFileSync(STORE,JSON.stringify(x,null,2));}
function id(){return "SM"+Date.now().toString().slice(-8);}

async function notifyTelegram(text){
  if(!TG_BOT_TOKEN) return {sent:false,reason:"Telegram bot token not configured"};
  const r=await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:TG_CHAT_ID,text})
  });
  return {sent:r.ok,body:await r.text()};
}

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

    if (!pkg || !name || !username || !profile || !screenshot) {
      return res.status(400).json({
        error: "Please complete all fields and upload your payment screenshot."
      });
    }

    if (/password|passcode/i.test(JSON.stringify(req.body))) {
      return res.status(400).json({
        error: "Passwords are not accepted."
      });
    }

    const order = {
      orderId: id(),
      status: "PENDING",
      package: pkg,
      name,
      username,
      profile,
      coupon: coupon || "",
      amount: amount || "",
      screenshot,
      createdAt: new Date().toISOString()
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    const msg =
`🔔 NEW ORDER ${order.orderId}

Name: ${name}
Instagram: ${username}
Profile: ${profile}
Package: ${pkg}
Amount: ₹${amount || "Not specified"}
Coupon: ${coupon || "None"}

Payment screenshot has been submitted.
Please verify the payment before accepting the order.

Admin: ${process.env.ADMIN_URL || "Set ADMIN_URL"}`;

    try {
      await notifyTelegram(msg);
    } catch (e) {
      console.error("Telegram notification error:", e);
    }

    res.json({
      ok: true,
      orderId: order.orderId,
      status: order.status
    });

  } catch (error) {
    console.error("Order error:", error);

    res.status(500).json({
      error: "Unable to process order. Please try again."
    });
  }
});
  const msg=`🔔 NEW ORDER ${order.orderId}\n\nName: ${name}\nInstagram: ${username}\nProfile: ${profile}\nPackage: ${pkg}\nUTR: ${utr}\n\nAdmin: ${process.env.ADMIN_URL||"Set ADMIN_URL"}\nAccept/Reject from your admin dashboard.`;
  try{await notifyTelegram(msg);}catch(e){console.error(e);}
  res.json({ok:true,orderId:order.orderId,status:order.status});
});

function admin(req,res,next){if(req.headers["x-admin-key"]!==ADMIN_KEY)return res.status(401).json({error:"Unauthorized"});next();}
app.get("/api/admin/orders",admin,(req,res)=>res.json(readOrders()));
app.post("/api/admin/orders/:id/status",admin,(req,res)=>{
 const allowed=["ACCEPTED","REJECTED"]; const status=req.body?.status;
 if(!allowed.includes(status)) return res.status(400).json({error:"Invalid status"});
 const orders=readOrders(); const o=orders.find(x=>x.orderId===req.params.id);
 if(!o)return res.status(404).json({error:"Order not found"});
 o.status=status;o.updatedAt=new Date().toISOString();writeOrders(orders);res.json({ok:true,order:o});
});
app.get("/api/orders/:id",(req,res)=>{
 const o=readOrders().find(x=>x.orderId===req.params.id);
 if(!o)return res.status(404).json({error:"Order not found"});
 res.json({orderId:o.orderId,status:o.status,package:o.package,createdAt:o.createdAt});
});
app.listen(PORT,()=>console.log(`SehrAn Media server running on port ${PORT}`));
