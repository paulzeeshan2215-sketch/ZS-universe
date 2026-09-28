const express=require("express");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express();

const PORT=Number(process.env.PORT)||3000;
const PUBLIC_DIR=path.join(__dirname,"public");
const PRIVATE_DIR=path.join(__dirname,"private");
const MOVIES_DIR=path.join(PRIVATE_DIR,"movies");
const SCREENSHOTS_DIR=path.join(PRIVATE_DIR,"screenshots");
const STORE=path.join(__dirname,"orders.json");
const MOVIES_STORE=path.join(__dirname,"movies.json");

const ADMIN_KEY=process.env.ADMIN_KEY||"CHANGE_THIS_ADMIN_KEY";
const TG_BOT_TOKEN=process.env.TG_BOT_TOKEN||"";
const TG_CHAT_ID=process.env.TG_CHAT_ID||"";
const ADMIN_URL=process.env.ADMIN_URL||"";

const JSON_BODY_LIMIT="12mb";
const MAX_SCREENSHOT_SIZE=5*1024*1024;
const MAX_MOVIE_SIZE=5*1024*1024*1024;

const VALID_PROMO_CODE="ZEESHAN10";
const PROMO_DISCOUNT=.10;

const INSTAGRAM_PACKAGES={
 "200 Followers":100,
 "500 Followers":150,
 "1,000 Followers":250,
 "1,500 Followers":300,
 "2,000 Followers":400,
 "3,000 Followers":500,
 "4,000 Followers":600,
 "5,000 Followers":750,
 "6,000 Followers":900,
 "7,000 Followers":1100,
 "8,000 Followers":1200,
 "9,000 Followers":1400,
 "10,000 Followers":1500
};

function ensureDir(dir){
 if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
}

ensureDir(PRIVATE_DIR);
ensureDir(MOVIES_DIR);
ensureDir(SCREENSHOTS_DIR);

if(!fs.existsSync(STORE))fs.writeFileSync(STORE,"[]");
if(!fs.existsSync(MOVIES_STORE))fs.writeFileSync(MOVIES_STORE,"[]");

app.use(express.json({limit:JSON_BODY_LIMIT}));
app.use(express.urlencoded({extended:true,limit:JSON_BODY_LIMIT}));

function readJson(file,fallback=[]){
 try{
  if(!fs.existsSync(file))return fallback;
  const raw=fs.readFileSync(file,"utf8");
  if(!raw.trim())return fallback;
  return JSON.parse(raw);
 }catch(e){
  console.error("[JSON READ]",file,e.message);
  return fallback;
 }
}

function writeJson(file,data){
 fs.writeFileSync(file,JSON.stringify(data,null,2),"utf8");
}

function getOrders(){
 return readJson(STORE,[]);
}

function saveOrders(orders){
 writeJson(STORE,orders);
}

function getMovies(){
 return readJson(MOVIES_STORE,[]);
}

function saveMovies(movies){
 writeJson(MOVIES_STORE,movies);
}

function makeId(prefix="ORD"){
 return prefix+"-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
}

function clean(value,max=1000){
 if(value===undefined||value===null)return"";
 return String(value).trim().slice(0,max);
}

function normalizePackage(value){
 let v=clean(value,100);
 if(INSTAGRAM_PACKAGES[v]!==undefined)return v;

 const digits=v.replace(/,/g,"").match(/\d+/)?.[0]||0;
 if(digits){
  const num=Number(digits);
  const key=Object.keys(INSTAGRAM_PACKAGES).find(k=>Number(k.replace(/,/g,"").match(/\d+/)[0])===num);
  if(key)return key;
 }

 return"";
}

function instagramDisplayName(followers){
 const n=Number(String(followers||"").replace(/,/g,""));
 const names={
  200:"Starter",
  500:"Starter Plus",
  1000:"Popular",
  1500:"Growth",
  2000:"Growth Plus",
  3000:"Pro",
  4000:"Pro Plus",
  5000:"Premium",
  6000:"Premium Plus",
  7000:"Advanced",
  8000:"Advanced Plus",
  9000:"Elite",
  10000:"Elite Plus"
 };

 return names[n]||"Instagram Package";
}

function getInstagramPackageFromBody(body){
 const candidates=[
  body.package,
  body.packageId,
  body.followers,
  body.instagramFollowers
 ];

 for(const value of candidates){
  const normalized=normalizePackage(value);
  if(normalized){
   const followers=Number(normalized.replace(/,/g,"").match(/\d+/)[0]);
   return{
    key:normalized,
    followers,
    originalPrice:INSTAGRAM_PACKAGES[normalized],
    name:instagramDisplayName(followers)
   };
  }
 }

 return null;
}

function normalizeMovieTitle(value){
 return clean(value,500)
  .toLowerCase()
  .replace(/\s+/g," ")
  .trim();
}

function findMovieForOrder(body){
 const movies=getMovies();

 if(body.movieId){
  const exact=movies.find(m=>String(m.id)===String(body.movieId));
  if(exact)return exact;
 }

 const title=normalizeMovieTitle(
  body.movieName||body.movie||body.name||body.package
 );

 if(!title)return null;

 let matches=movies.filter(m=>{
  const mt=normalizeMovieTitle(m.title||m.name||m.movieName);
  return mt===title;
 });

 if(matches.length>1&&body.price){
  const wanted=Number(body.price);
  const priced=matches.find(m=>{
   const p=Number(m.price||m.amount||0);
   return Math.abs(p-wanted)<.01;
  });

  if(priced)return priced;
 }

 return matches[0]||null;
}

function moviePrice(movie){
 return Number(
  movie?.price||
  movie?.amount||
  movie?.sellingPrice||
  0
 )||0;
}

function isAdmin(req){
 const key=req.headers["x-admin-key"]||req.query.key||req.body?.adminKey;
 return Boolean(ADMIN_KEY&&key&&String(key)===String(ADMIN_KEY));
}

function requireAdmin(req,res,next){
 if(!isAdmin(req)){
  return res.status(401).json({
   ok:false,
   error:"Unauthorized"
  });
 }

 next();
}

function validMobile(value){
 return /^[0-9+\-\s()]{7,20}$/.test(clean(value,30));
}

function validEmail(value){
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value,200));
}

function validInstagramProfile(value){
 const v=clean(value,500);
 if(!v)return false;
 return /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\//i.test(v);
}

function validUtr(value){
 const v=clean(value,100);
 return /^[A-Za-z0-9]{6,50}$/.test(v);
}

function sanitizeOrder(order){
 if(!order)return null;

 const copy={...order};

 delete copy.adminKey;
 delete copy.password;
 delete copy.passcode;

 return copy;
}

async function telegramRequest(method,body){
 if(!TG_BOT_TOKEN||!TG_CHAT_ID){
  console.log("[Telegram] configuration missing");
  return null;
 }

 try{
  const url=`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`;

  const response=await fetch(url,{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)
  });

  const data=await response.json().catch(()=>null);

  if(!response.ok){
   console.error("[Telegram]",response.status,data);
  }

  return data;
 }catch(error){
  console.error("[Telegram]",error.message);
  return null;
 }
}

async function sendTelegram(text){
 return telegramRequest("sendMessage",{
  chat_id:TG_CHAT_ID,
  text,
  parse_mode:"HTML",
  disable_web_page_preview:true
 });
}

async function sendTelegramPhoto(filePath,caption){
 if(!TG_BOT_TOKEN||!TG_CHAT_ID)return null;

 try{
  const form=new FormData();

  form.append("chat_id",TG_CHAT_ID);
  form.append("caption",caption||"");
  form.append("parse_mode","HTML");

  form.append(
   "photo",
   new Blob([fs.readFileSync(filePath)]),
   path.basename(filePath)
  );

  const response=await fetch(
   `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`,
   {
    method:"POST",
    body:form
   }
  );

  return await response.json().catch(()=>null);
 }catch(error){
  console.error("[Telegram Photo]",error.message);
  return null;
 }
}

function orderTelegramText(order){
 const lines=[
  "🆕 <b>NEW ORDER</b>",
  "",
  `🆔 <b>Order ID:</b> ${clean(order.orderId,100)}`,
  `📦 <b>Type:</b> ${clean(order.type,50)}`,
  `📌 <b>Product:</b> ${clean(order.product,100)}`
 ];

 if(order.type==="INSTAGRAM"){
  lines.push(
   `📈 <b>Package:</b> ${clean(order.package,100)}`,
   `👥 <b>Followers:</b> ${clean(order.followers,30)}`,
   `📱 <b>Username:</b> ${clean(order.username||"Not provided",100)}`,
   `🔗 <b>Profile:</b> ${clean(order.profile,500)}`,
   `💰 <b>Amount:</b> ₹${Number(order.amount||0).toFixed(2)}`,
   `🎁 <b>Promo:</b> ${clean(order.promoCode||"FREE",50)}`
  );
 }else{
  lines.push(
   `🎬 <b>Movie:</b> ${clean(order.movieName||order.movie,200)}`,
   `📅 <b>Year:</b> ${clean(order.year,30)}`,
   `🎞️ <b>Quality:</b> ${clean(order.quality,100)}`,
   `🌐 <b>Language:</b> ${clean(order.language,100)}`,
   `💾 <b>Size:</b> ${clean(order.size,100)}`,
   `💰 <b>Amount:</b> ₹${Number(order.amount||0).toFixed(2)}`,
   `💳 <b>UTR:</b> ${clean(order.utr,100)}`
  );
 }

 lines.push(
  "",
  `📞 <b>Mobile:</b> ${clean(order.mobile||"Not provided",50)}`,
  `📧 <b>Email:</b> ${clean(order.email||"Not provided",200)}`,
  `📊 <b>Status:</b> ${clean(order.status,50)}`,
  `🕒 <b>Time:</b> ${clean(order.createdAt,100)}`
 );

 if(ADMIN_URL){
  lines.push("",`🔐 <a href="${ADMIN_URL}">Open Admin Panel</a>`);
 }

 return lines.join("\n");
}

function saveScreenshot(data,orderId){
 if(!data)return"";

 let base64=String(data);

 if(base64.includes(",")){
  base64=base64.split(",").pop();
 }

 const filename=
  `${orderId}-${Date.now()}.jpg`;

 const filePath=path.join(SCREENSHOTS_DIR,filename);

 const buffer=Buffer.from(base64,"base64");

 if(buffer.length>MAX_SCREENSHOT_SIZE){
  throw new Error("Screenshot is too large");
 }

 fs.writeFileSync(filePath,buffer);

 return filename;
}

function removePasswordFields(body){
 const forbidden=[
  "password",
  "passcode",
  "passwd",
  "loginPassword",
  "adminPassword"
 ];

 return forbidden.some(k=>body[k]!==undefined);
}

app.get("/api/health",(req,res)=>{
 res.json({
  ok:true,
  service:"ZS Universe",
  time:new Date().toISOString()
 });
});

app.get("/api/instagram-packages",(req,res)=>{
 const packages=Object.entries(INSTAGRAM_PACKAGES).map(([key,originalPrice])=>{
  const followers=Number(key.replace(/,/g,"").match(/\d+/)[0]);

  return{
   id:String(followers),
   package:instagramDisplayName(followers),
   name:instagramDisplayName(followers),
   followers,
   price:"0.00",
   originalPrice:Number(originalPrice).toFixed(2),
   promoCode:"FREE"
  };
 });

 res.json({
  ok:true,
  packages
 });
});

app.get("/api/movies",(req,res)=>{
 const movies=getMovies();

 const active=movies.filter(m=>{
  if(m.disabled===true)return false;
  if(m.active===false)return false;
  if(m.enabled===false)return false;
  return true;
 });

 res.json({
  ok:true,
  movies:active
 });
});

app.get("/api/movies/all",requireAdmin,(req,res)=>{
 res.json({
  ok:true,
  movies:getMovies()
 });
});

app.get("/api/movies/:id",(req,res)=>{
 const movie=getMovies().find(
  m=>String(m.id)===String(req.params.id)
 );

 if(!movie){
  return res.status(404).json({
   ok:false,
   error:"Movie not found"
  });
 }

 res.json({
  ok:true,
  movie
 });
});

app.post("/api/admin/movies/:id/disable",requireAdmin,(req,res)=>{
 const movies=getMovies();

 const movie=movies.find(
  m=>String(m.id)===String(req.params.id)
 );

 if(!movie){
  return res.status(404).json({
   ok:false,
   error:"Movie not found"
  });
 }

 movie.disabled=true;
 movie.active=false;
 movie.updatedAt=new Date().toISOString();

 saveMovies(movies);

 res.json({
  ok:true,
  movie
 });
});

app.post("/api/admin/movies/:id/enable",requireAdmin,(req,res)=>{
 const movies=getMovies();

 const movie=movies.find(
  m=>String(m.id)===String(req.params.id)
 );

 if(!movie){
  return res.status(404).json({
   ok:false,
   error:"Movie not found"
  });
 }

 movie.disabled=false;
 movie.active=true;
 movie.enabled=true;
 movie.updatedAt=new Date().toISOString();

 saveMovies(movies);

 res.json({
  ok:true,
  movie
 });
});

app.post("/api/orders",async(req,res)=>{
 try{
  const body=req.body||{};

  if(removePasswordFields(body)){
   return res.status(400).json({
    ok:false,
    error:"Password fields are not supported."
   });
  }

  const rawType=clean(
   body.type||body.product||body.productType,
   50
  ).toLowerCase();

  const isInstagram=
   rawType==="instagram"||
   rawType==="instagram-followers"||
   rawType==="followers";

  const isMovie=
   rawType==="movie"||
   rawType==="movies";

  if(isInstagram){
   const pkg=getInstagramPackageFromBody(body);

   if(!pkg){
    return res.status(400).json({
     ok:false,
     error:"Invalid Instagram package."
    });
   }

   const mobile=clean(body.mobile,30);
   const email=clean(body.email,200);
   const username=clean(body.username,100);
   const profile=clean(body.profile,500);

   if(mobile&&!validMobile(mobile)){
    return res.status(400).json({
     ok:false,
     error:"Invalid mobile number."
    });
   }

   if(email&&!validEmail(email)){
    return res.status(400).json({
     ok:false,
     error:"Invalid email address."
    });
   }

   if(!mobile&&!email){
    return res.status(400).json({
     ok:false,
     error:"Mobile number or email is required."
    });
   }

   if(!profile||!validInstagramProfile(profile)){
    return res.status(400).json({
     ok:false,
     error:"Valid Instagram profile link is required."
    });
   }

   const promo=clean(body.promoCode,50).toUpperCase();

   const promoApplied=
    promo==="FREE"||
    promo===VALID_PROMO_CODE;

   if(!promoApplied){
    return res.status(400).json({
     ok:false,
     error:"Invalid promo code."
    });
   }

   const now=new Date().toISOString();

   const order={
    orderId:makeId("IG"),
    id:makeId("IG"),
    type:"INSTAGRAM",
    product:"instagram",
    package:pkg.key,
    packageName:pkg.name,
    packageId:String(pkg.followers),
    followers:pkg.followers,
    originalAmount:Number(pkg.originalPrice).toFixed(2),
    discount:Number(pkg.originalPrice).toFixed(2),
    promoCode:promo||"FREE",
    promoApplied:true,
    amount:"0.00",
    mobile,
    email,
    username,
    profile,
    utr:"",
    screenshot:"",
    status:"PENDING",
    createdAt:now,
    updatedAt:now
   };

   const orders=getOrders();

   orders.push(order);
   saveOrders(orders);

   await sendTelegram(orderTelegramText(order));

   return res.status(201).json({
    ok:true,
    orderId:order.orderId,
    status:order.status,
    data:{
     orderId:order.orderId,
     status:order.status
    },
    order:sanitizeOrder(order)
   });
  }

  if(isMovie){
   const mobile=clean(body.mobile,30);
   const email=clean(body.email,200);
   const utr=clean(body.utr,100);
   const screenshot=body.screenshot;

   if(mobile&&!validMobile(mobile)){
    return res.status(400).json({
     ok:false,
     error:"Invalid mobile number."
    });
   }

   if(email&&!validEmail(email)){
    return res.status(400).json({
     ok:false,
     error:"Invalid email address."
    });
   }

   if(!mobile&&!email){
    return res.status(400).json({
     ok:false,
     error:"Mobile number or email is required."
    });
   }

   if(!validUtr(utr)){
    return res.status(400).json({
     ok:false,
     error:"Valid UTR number is required."
    });
   }

   if(!screenshot){
    return res.status(400).json({
     ok:false,
     error:"Payment screenshot is required."
    });
   }

   const movie=findMovieForOrder(body);

   if(!movie){
    return res.status(404).json({
     ok:false,
     error:"Movie not found or no longer available."
    });
   }

   if(
    movie.disabled===true||
    movie.active===false||
    movie.enabled===false
   ){
    return res.status(400).json({
     ok:false,
     error:"This movie is currently unavailable."
    });
   }

   const serverPrice=moviePrice(movie);

   if(serverPrice<=0){
    return res.status(400).json({
     ok:false,
     error:"Invalid movie price."
    });
   }

   let promoCode=clean(body.promoCode,50).toUpperCase();
   let discount=0;

   if(promoCode===VALID_PROMO_CODE){
    discount=serverPrice*PROMO_DISCOUNT;
   }else if(promoCode){
    return res.status(400).json({
     ok:false,
     error:"Invalid promo code."
    });
   }else{
    promoCode="";
   }

   const finalAmount=Math.max(0,serverPrice-discount);
   const orderId=makeId("MV");
   let screenshotFile="";

   try{
    screenshotFile=saveScreenshot(screenshot,orderId);
   }catch(error){
    return res.status(400).json({
     ok:false,
     error:error.message||"Unable to save screenshot."
    });
   }

   const now=new Date().toISOString();

   const order={
    orderId,
    id:orderId,
    type:"MOVIE",
    product:"movie",
    movieId:movie.id||"",
    movie:clean(body.movieName||body.movie||movie.title||movie.name,300),
    movieName:clean(body.movieName||body.movie||movie.title||movie.name,300),
    name:clean(movie.title||movie.name||body.movieName||body.movie,300),
    year:clean(body.year||movie.year,30),
    quality:clean(body.quality||movie.quality,100),
    language:clean(body.language||movie.language,100),
    size:clean(body.size||movie.size,100),
    package:clean(body.package||body.movieName||movie.title||movie.name,300),
    originalAmount:serverPrice.toFixed(2),
    discount:discount.toFixed(2),
    promoCode,
    promoApplied:Boolean(discount),
    amount:finalAmount.toFixed(2),
    mobile,
    email,
    utr,
    screenshot:screenshotFile,
    status:"PENDING",
    createdAt:now,
    updatedAt:now
   };

   const orders=getOrders();

   orders.push(order);
   saveOrders(orders);

   await sendTelegram(orderTelegramText(order));

   if(screenshotFile){
    const filePath=path.join(SCREENSHOTS_DIR,screenshotFile);

    if(fs.existsSync(filePath)){
     await sendTelegramPhoto(
      filePath,
      `🧾 <b>Payment Screenshot</b>\n🆔 ${order.orderId}`
     );
    }
   }

   return res.status(201).json({
    ok:true,
    orderId,
    status:"PENDING",
    movieId:movie.id||"",
    data:{
     orderId,
     status:"PENDING"
    },
    order:sanitizeOrder(order)
   });
  }

  return res.status(400).json({
   ok:false,
   error:"Invalid order type."
  });

 }catch(error){
  console.error("[POST /api/orders]",error);

  return res.status(500).json({
   ok:false,
   error:"Server error. Please try again later."
  });
 }
});

app.post("/api/movie-orders",(req,res)=>{
 req.body=req.body||{};
 req.body.type="movie";
 req.body.product="movie";

 return app.handle(req,res);
});

app.get("/api/orders",requireAdmin,(req,res)=>{
 const orders=getOrders();

 res.json({
  ok:true,
  orders:orders.map(sanitizeOrder)
 });
});

app.get("/api/admin/orders",requireAdmin,(req,res)=>{
 const orders=getOrders();

 res.json({
  ok:true,
  orders:orders.map(sanitizeOrder)
 });
});

app.get("/api/orders/:id",requireAdmin,(req,res)=>{
 const order=getOrders().find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 res.json({
  ok:true,
  order:sanitizeOrder(order)
 });
});

app.post("/api/orders/:id/status",requireAdmin,(req,res)=>{
 const orders=getOrders();

 const order=orders.find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 const requested=clean(req.body.status,50).toUpperCase();

 const allowed=[
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
  "PROCESSING"
 ];

 if(!allowed.includes(requested)){
  return res.status(400).json({
   ok:false,
   error:"Invalid status."
  });
 }

 order.status=requested;
 order.updatedAt=new Date().toISOString();

 if(req.body.adminNote!==undefined){
  order.adminNote=clean(req.body.adminNote,2000);
 }

 saveOrders(orders);

 res.json({
  ok:true,
  order:sanitizeOrder(order)
 });
});

app.patch("/api/orders/:id/status",requireAdmin,(req,res)=>{
 const orders=getOrders();

 const order=orders.find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 const requested=clean(req.body.status,50).toUpperCase();

 const allowed=[
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
  "PROCESSING"
 ];

 if(!allowed.includes(requested)){
  return res.status(400).json({
   ok:false,
   error:"Invalid status."
  });
 }

 order.status=requested;
 order.updatedAt=new Date().toISOString();

 saveOrders(orders);

 res.json({
  ok:true,
  order:sanitizeOrder(order)
 });
});

app.post("/api/admin/orders/:id/accept",requireAdmin,(req,res)=>{
 const orders=getOrders();

 const order=orders.find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 order.status="ACCEPTED";
 order.updatedAt=new Date().toISOString();

 saveOrders(orders);

 res.json({
  ok:true,
  order:sanitizeOrder(order)
 });
});

app.post("/api/admin/orders/:id/reject",requireAdmin,(req,res)=>{
 const orders=getOrders();

 const order=orders.find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 order.status="REJECTED";
 order.updatedAt=new Date().toISOString();

 if(req.body.reason){
  order.rejectionReason=clean(req.body.reason,1000);
 }

 saveOrders(orders);

 res.json({
  ok:true,
  order:sanitizeOrder(order)
 });
});

app.get("/api/orders/:id/screenshot",requireAdmin,(req,res)=>{
 const order=getOrders().find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order){
  return res.status(404).json({
   ok:false,
   error:"Order not found"
  });
 }

 if(!order.screenshot){
  return res.status(404).json({
   ok:false,
   error:"Screenshot not available."
  });
 }

 const filePath=path.join(SCREENSHOTS_DIR,order.screenshot);

 if(!fs.existsSync(filePath)){
  return res.status(404).json({
   ok:false,
   error:"Screenshot file not found."
  });
 }

 res.sendFile(filePath);
});

app.get("/api/admin/orders/:id/screenshot",requireAdmin,(req,res)=>{
 const order=getOrders().find(
  o=>String(o.orderId)===String(req.params.id)||
      String(o.id)===String(req.params.id)
 );

 if(!order||!order.screenshot){
  return res.status(404).json({
   ok:false,
   error:"Screenshot not available."
  });
 }

 const filePath=path.join(SCREENSHOTS_DIR,order.screenshot);

 if(!fs.existsSync(filePath)){
  return res.status(404).json({
   ok:false,
   error:"Screenshot file not found."
  });
 }

 res.sendFile(filePath);
});

app.get("/api/admin/stats",requireAdmin,(req,res)=>{
 const orders=getOrders();

 const stats={
  total:orders.length,
  pending:orders.filter(o=>o.status==="PENDING").length,
  accepted:orders.filter(o=>o.status==="ACCEPTED").length,
  rejected:orders.filter(o=>o.status==="REJECTED").length,
  completed:orders.filter(o=>o.status==="COMPLETED").length,
  instagram:orders.filter(o=>String(o.type).toUpperCase()==="INSTAGRAM").length,
  movies:orders.filter(o=>String(o.type).toUpperCase()==="MOVIE").length
 };

 res.json({
  ok:true,
  stats
 });
});

app.get("/api/admin/login",(req,res)=>{
 const key=req.query.key||req.headers["x-admin-key"];

 if(key&&String(key)===String(ADMIN_KEY)){
  return res.json({
   ok:true,
   authenticated:true
  });
 }

 res.status(401).json({
  ok:false,
  authenticated:false
 });
});

app.get("/api/admin/check",requireAdmin,(req,res)=>{
 res.json({
  ok:true,
  authenticated:true
 });
});

app.use(
 express.static(PUBLIC_DIR,{
  extensions:["html"],
  maxAge:"1h"
 })
);

app.use((req,res,next)=>{
 if(req.path.startsWith("/api/")){
  return res.status(404).json({
   ok:false,
   error:"API route not found."
  });
 }

 next();
});

/*
 * EXPRESS 5 FIX
 *
 * Old:
 * app.get("*", ...)
 *
 * Express 5 does not accept the old "*" wildcard.
 * The following route catches all non-API frontend routes.
 */
app.get("/{*splat}",(req,res)=>{
 const indexFile=path.join(PUBLIC_DIR,"index.html");

 if(fs.existsSync(indexFile)){
  return res.sendFile(indexFile);
 }

 res.status(404).send("ZS Universe");
});

app.use((error,req,res,next)=>{
 console.error("[GLOBAL ERROR]",error);

 if(res.headersSent)return next(error);

 res.status(500).json({
  ok:false,
  error:"Internal server error."
 });
});

app.listen(PORT,()=>{
 console.log("======================================");
 console.log("ZS Universe server started");
 console.log(`PORT: ${PORT}`);
 console.log(`PUBLIC: ${PUBLIC_DIR}`);
 console.log(`ORDERS: ${STORE}`);
 console.log(`MOVIES: ${MOVIES_STORE}`);
 console.log("======================================");
});
