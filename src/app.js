import "dotenv/config";
import express from "express";
import Web3 from "web3";
import { MongoClient } from "mongodb";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { Server } from "socket.io";
import http from "http";
import axios from "axios";

import { DB_URI, PORT, PROVIDER, SOCKET_PORT,REAL_MODE } from "./constants.js";
import { colorDataRouter } from "./routes/color_data.js";
import { buyOrdersRouter } from "./routes/buy_orders.js";
import { sellOrdersRouter } from "./routes/sell_orders.js";
import { ordersRouter } from "./routes/orders.js";
import { nonceRouter } from "./routes/nonce.js";
import { otherRouter } from "./routes/others.js";
import { offOrderRouter } from "./routes/off_order.js";
import { batchOrderRouter } from "./routes/batch_order.js"

// preventing for DDOS attacks
// const allowlist = ['::ffff:3.134.238.10','::ffff:3.129.111.220','::ffff:52.15.118.168'];
// // Create the rate limit rule
// const apiRequestLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes of slot time.
//   max: 10, // limit each IP to 10 requests per windowMs,
//   skip: (request, response) => allowlist.includes(request.ip)
// })
const app = express();

// Use the limit rule as an application middleware
// app.use(apiRequestLimiter)

app.use(cors());
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Method", "GET, POST, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.use(function (req,res, next){
  if(REAL_MODE){
    const origin = req.headers.origin;
    if (origin !== 'https://color.museum' && origin !== 'https://www.color.museum' && origin !== 'http://color.museum' && origin !== 'http://www.color.museum' && origin !== 'https://3.134.238.10' && origin !== 'http://3.134.238.10' && origin !== 'https://3.129.111.220' && origin !== 'http://3.129.111.220' && origin !== 'https://52.15.118.168' && origin !== 'http://52.15.118.168' && origin !== 'http://localhost:3000') {
      res.json({
        success:false,
        message: "Access Denied"
      })
    }else{
      next();
    }
  }else {
    next()
  }
})

app.use(express.json());
app.use("/api/v1/color_data", colorDataRouter);
app.use("/api/v1/buy_orders", buyOrdersRouter);
app.use("/api/v1/sell_orders", sellOrdersRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/nonce", nonceRouter);
app.use("/api/v1/others", otherRouter);
app.use("/api/v1/off_order", offOrderRouter)
app.use("/api/v1/batch_order", batchOrderRouter)

let client = new MongoClient(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

client
  .connect()
  .then((mongoClient) => {
    client = mongoClient;
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.log(error);
  });

export const color_data_collection = client
  .db("color-data")
  .collection("nft-color-data");
export const buy_orders_collection = client
  .db("color-data")
  .collection("buy_orders");
export const sell_orders_collection = client
  .db("color-data")
  .collection("sell_orders");
export const tokenPrice_collection = client
  .db("color-data")
  .collection("tokenprice");
export const web3 = new Web3(new Web3.providers.HttpProvider(PROVIDER));

var httpServer = app.listen(PORT, (error) => {
  if (error) {
    console.log("Error occured: " + error);
    return;
  }
  console.log(`Express Server running on Port: ${PORT}`);
});

// Socket.io Part
// const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});
io.on("connection", (socket) => {
  console.log("client connected: ", socket.id);

  socket.join("real-time-transaction");

  socket.on("disconnect", (reason) => {
    console.log(`Socket Disconnect: ${reason}`);
  });
});

setInterval(async () => {
  sendSalesDataviaWS();
  sendBidsDataviaWS();
  sendAsksDataviaWS();
}, 5000);

const sendSalesDataviaWS = async () => {
  try {
    var orders = [];
    const sell_orders = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 3 }],
          },
        },
      ])
      .sort({ nonce: -1 })
      .toArray();

    for (let i = 0; i < sell_orders.length; i++) {
      if (!sell_orders[i].acceptingHash) continue;
      const sell_order = {
        erc20TokenAmount: sell_orders[i].erc20TokenAmount,
        erc20Token: sell_orders[i].erc20Token,
        erc721TokenId: sell_orders[i].erc721TokenId,
        fee: sell_orders[i].fees[0].amount,
        seller: sell_orders[i].maker,
        buyer: sell_orders[i].from_address,
        txHash: sell_orders[i].acceptingHash,
        createdAt: new Date(sell_orders[i].createdAt),
      };
      orders.push(sell_order);
    }

    const buy_orders = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 3 }],
          },
        },
      ])
      .sort({ nonce: -1 })
      .toArray();

    for (let j = 0; j < buy_orders.length; j++) {
      const buy_order = {
        erc20TokenAmount: buy_orders[j].erc20TokenAmount,
        erc20Token: buy_orders[j].erc20Token,
        erc721TokenId: buy_orders[j].erc721TokenId,
        fee: buy_orders[j].fees[0].amount,
        seller: buy_orders[j].taker,
        buyer: buy_orders[j].maker,
        txHash: buy_orders[j].acceptingHash,
        createdAt: buy_orders[j].createdAt,
      };
      orders.push(buy_order);
    }

    io.to("real-time-transaction").emit("sales", JSON.stringify(orders));
  } catch (err) {
    console.log(err);
  }
};

const sendBidsDataviaWS = async () => {
  try {
    var orders = [];

    const buy_orders = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 1 }],
          },
        },
      ])
      .sort({ nonce: -1 })
      .toArray();

    for (let j = 0; j < buy_orders.length; j++) {
      const buy_order = {
        erc20TokenAmount: buy_orders[j].erc20TokenAmount,
        erc20Token: buy_orders[j].erc20Token,
        erc721TokenId: buy_orders[j].erc721TokenId,
        fee: buy_orders[j].fees[0].amount,
        seller: buy_orders[j].taker,
        buyer: buy_orders[j].maker,
        txHash: buy_orders[j].makingHash,
        createdAt: buy_orders[j].createdAt,
        expiry: buy_orders[j].expiry,
      };
      orders.push(buy_order);
    }

    io.to("real-time-transaction").emit("bids", JSON.stringify(orders));
  } catch (err) {
    console.log(err);
  }
};

const sendAsksDataviaWS = async () => {
  try {
    var orders = [];

    const sell_orders = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 1 }],
          },
        },
      ])
      .sort({ nonce: -1 })
      .toArray();

    for (let j = 0; j < sell_orders.length; j++) {
      const sell_order = {
        erc20TokenAmount: sell_orders[j].erc20TokenAmount,
        erc20Token: sell_orders[j].erc20Token,
        erc721TokenId: sell_orders[j].erc721TokenId,
        fee: sell_orders[j].fees[0].amount,
        seller: sell_orders[j].maker,
        txHash: sell_orders[j].makingHash,
        createdAt: sell_orders[j].createdAt,
        expiry: sell_orders[j].expiry,
      };
      orders.push(sell_order);
    }

    io.to("real-time-transaction").emit("asks", JSON.stringify(orders));
  } catch (err) {
    console.log(err);
  }
};

// httpServer.listen(SOCKET_PORT, (err) => {
//   if (err) console.log(err);
//   console.log(`Http Server running on Port ${SOCKET_PORT}`);
// });

var minutes = 0.5, the_interval = minutes * 60 * 1000;
const getTokenPrice = async () => {
  const config = {
    method: "get",
    url: "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD&api_key=c6847abd342b24d23da84027971bf88421c902a382fbb487c707b3f30363c8f0"
  }
  var tokenPrice = await axios(config);
  return tokenPrice.data;
}
setInterval(async function() {
  var tokenPrice = await getTokenPrice();
  let priceData = []
  priceData = await tokenPrice_collection.findOne({ USD: {$ne:'a'} });
  if(priceData == null){
    await tokenPrice_collection.insertOne(tokenPrice)
  }
  await tokenPrice_collection.findOneAndUpdate(
    { USD: {$ne:'a'} },
    { $set: tokenPrice},
    { returnDocument: "after" }
  );
}, the_interval);
