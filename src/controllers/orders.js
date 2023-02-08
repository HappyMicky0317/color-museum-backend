import { ObjectId } from "mongodb";
import { buy_orders_collection, sell_orders_collection, web3 } from "../app.js";
import {
  LIMIT_SIZE,
  MAX_LIMIT,
  supabaseUrl,
  supabaseCanon,
  knockAPIKey,
  SIMPLEHASH_APIKey,
  infura_http_provider,
  ERC721OrderFeatureAddress,
  PROVIDER,
  MARKETINGFEE,
  MARKETINGOWNER,
  SLACKWEBHOOKURL,
  DISCORDWEBHOOK,
  MORALISAPIKEY
} from "../constants.js";
import {
  InvalidCurrent,
  InvalidNonceError,
  InvalidOrderId,
  MissingRequiredFieldError,
  TypeIsUndefinedError,
  UnexpectedError,
  InvalidTransaction,
  InvalidConfirm,
  SignatureError,
  InvalidOrder,
} from "../helpers/errors.js";
import { ERC721OrderFeatureABI } from "../helpers/ERC721OrdersFeature.js";
import axios from "axios";
import { ethers } from "ethers";
import Web3 from "web3";

// connect to supabase
import { createClient } from "@supabase/supabase-js";

const supaAPIUrl = supabaseUrl;
const supaCanon = supabaseCanon;
const supabase = createClient(supaAPIUrl, supaCanon);

// connect to knock
import { Knock } from "@knocklabs/node";
const knockClient = new Knock(knockAPIKey);

var infura_http = new ethers.providers.JsonRpcProvider(infura_http_provider);

const getKnockUser = async (address) => {
  // address = "0x03c000fAEB84CDf180814EE8Abc3C928847EE3B9"
  // setting return value
  var return_val = {
    user_id: [],
    user_mail: "",
  };
  // get users from supabase
  var user_id = "";
  const user_data = await supabase.from("users").select("*");
  for (var i = 0; i < user_data.data.length; i++) {
    if (
      user_data.data[i].connectedAddress.toLowerCase() == address.toLowerCase()
    ) {
      user_id = user_data.data[i].id;
    }
  }

  if (user_id != "") {
    const account_data = await supabase
      .from("accounts")
      .select("knock_id,email")
      .eq("user_id", user_id);
    return_val.user_id.push(account_data.data[0].knock_id);
    return_val.user_mail = account_data.data[0].email;
  }
  return return_val;
};

const sendNotification = async (type, user, content) => {
  await knockClient.notify(type, {
    // list of user ids for who should receive the notif
    recipients: user,
    // data payload to send through
    data: {
      subject: content.subject,
      content: content.content,
      image: content.image,
      expiry: content.expiry,
      link: content.link,
      tokenID: content.tokenID
    },
  });
};

const getTokenSynbol = async (address) => {
  var return_val = "";
  if (address == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
    return_val = "ETH";
  }
  if (address == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
    return_val = "WETH";
  }
  if (address == "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") {
    return_val = "USDC";
  }
  if (address == "0x6B175474E89094C44Da98b954EedeAC495271d0F") {
    return_val = "DAI";
  }
  if (address == "0xdAC17F958D2ee523a2206206994597C13D831ec7") {
    return_val = "USDT";
  }
  return return_val;
};

const errorReport = async (url, message, data) => {
  // return message
  var string = "";
  string += "{\n";
  for (var key in data) {
    if (key == "fees") {
      string += '*"' + key + '" :* \n[';
      for (var i = 0; i < data[key].length; i++) {
        string += "{";
        for (var key1 in data[key][i]) {
          string +=
            '*"' + key1 + '":*' + JSON.stringify(data[key][i][key1]) + ",";
        }
        string += "}";
      }
      string += "]\n";
    } else if (key == "signature") {
      string += "{";
      for (var key1 in data[key]) {
        string += '*"' + key1 + '":* ' + JSON.stringify(data[key][key1]) + ",";
      }
      string += "}\n";
    } else {
      string += " " + '*"' + key + '" :* ' + JSON.stringify(data[key]) + "\n";
    }
  }
  string += "}";
  const config = {
    method: "post",
    url: SLACKWEBHOOKURL,
    headers: { "Content-type": "application/json" },
    data: {
      text: "Error Occurred",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Error Occurred",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*API URL:*\n" + url,
            },
            {
              type: "mrkdwn",
              text: "*Error Type:*\n" + message,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Request data:* " + "\n" + string,
          },
        },
      ],
    },
  };
  await axios(config);
};

const discordReport = async (data) => {
  console.log(data.imageSocial)
  const colordata = data.tokenID;
  const res = await axios.post(DISCORDWEBHOOK, {
    "embeds": [
      {
        "title": `Color NFT: No.${data.number}: ${data.name}(${data.hexa}) purchased for ${data.tokenPrice} ${data.tokenSymbol}(${data.usdPrice} USD) by ${data.buyer} from ${data.seller}`,
        "image": {
          "url": data.imageSocial
        },
        "color": colordata,
        "url": data.link
      }
    ]
  });
}

const getUSDVal =  async(tokenVal, symbol) => {
  const config = {
    method: "get",
    url: "https://min-api.cryptocompare.com/data/price?fsym=" + symbol + "&tsyms=USD"
  }
  var tokenPrice = await axios(config);
  var return_val = tokenPrice.data.USD * tokenVal;
  return_val = Math.ceil(return_val * 100) / 100;
  return return_val;
}

const getENSName = async (address) => {
  var return_val = {};
  return_val.success = true
  try{
    var response = await axios({
      method: "get",
      url: "https://deep-index.moralis.io/api/v2/resolve/" + address + "/reverse",
      headers: {
        "x-api-key": MORALISAPIKEY,
      },
    });
    return_val.ensName = response.data.name
  } catch(error) {
    return_val.success = false
  }
  return return_val;
}

export const createOrder = async (req, res, next) => {
  try {
    // for getting nonce value
    const buy_order_list = await buy_orders_collection
      .find()
      .sort({ nonce: -1 })
      .toArray();
    const max_buy_order = buy_order_list[0];
    const sell_order_list = await sell_orders_collection
      .find()
      .sort({ nonce: -1 })
      .toArray();
    const max_sell_order = sell_order_list[0];
    var max_nonce;
    if (buy_order_list.length != 0 && sell_order_list.length != 0) {
      if (max_buy_order.nonce > max_sell_order.nonce) {
        max_nonce = max_buy_order.nonce;
      } else {
        max_nonce = max_sell_order.nonce;
      }
    } else if (buy_order_list.length == 0 && sell_order_list.length != 0) {
      max_nonce = max_sell_order.nonce;
    } else if (sell_order_list.length == 0 && buy_order_list.length != 0) {
      max_nonce = max_buy_order.nonce;
    } else if (sell_order_list.length == 0 && buy_order_list.length == 0) {
      max_nonce = 1;
    }
    // checking at the blockchain
    var web3 = new Web3(PROVIDER);
    const marketPlaceInstance = new web3.eth.Contract(
      ERC721OrderFeatureABI,
      ERC721OrderFeatureAddress
    );
    var order_val = req.body;
    order_val.nonce = max_nonce + 1;
    var isOrderCorrect = false;
    while (!isOrderCorrect) {
      try {
        await marketPlaceInstance.methods
          .getERC721OrderStatus(order_val)
          .call();
        isOrderCorrect = true;
      } catch (e) {
        console.log(e);
        order_val.nonce += 1;
      }
    }

    // create order data for saving
    const {
      maker,
      taker,
      expiry,
      erc20TokenAmount,
      erc20Token,
      erc721Token,
      erc721TokenId,
      nft_color_id,
      signature,
      ...body
    } = req.body;
    const docBody = {
      maker,
      taker,
      expiry,
      erc20TokenAmount,
      erc20Token,
      erc721Token,
      erc721TokenId,
      nft_color_id: new ObjectId(nft_color_id),
      signature,
    };

    if (body.makingHash) docBody.makingHash = body.makingHash;
    if (body.acceptingHash) docBody.acceptingHash = body.acceptingHash;
    if (body.fees) docBody.fees = body.fees;
    if (body.erc721TokenProperties)
      docBody.erc721TokenProperties = body.erc721TokenProperties;
    if (body.onChain) docBody.onChain = true;
    else docBody.onChain = true;

    docBody.nonce = order_val.nonce;
    docBody.createdAt = new Date();
    docBody.updatedAt = new Date();
    docBody.expiry_date = new Date(expiry * 1000);
    docBody.current = 0;
    if (docBody.signature.signatureType != 4) throw new SignatureError();

    // res.json(req.body.fees);
    var order_state = false;
    if (req.body.fees.length > 0) {
      var address_state = false;
      var fee_state = false;
      for (var i = 0; i < req.body.fees.length; i++) {
        if (
          req.body.fees[i].recipient.toLowerCase() ==
          MARKETINGOWNER.toLowerCase()
        )
          address_state = true;
        if (
          req.body.fees[i].amount /
            (parseInt(req.body.erc20TokenAmount) +
              parseInt(req.body.fees[i].amount)) >
          MARKETINGFEE
        )
          fee_state = true;
      }
      if (address_state == true && fee_state == true) order_state = true;
    }
    if (order_state == false) throw new InvalidOrder();

    let createDoc;
    if (body.type === "buy") {
      createDoc = await buy_orders_collection.insertOne(docBody);
    } else if (body.type === "sell") {
      createDoc = await sell_orders_collection.insertOne(docBody);
    } else throw new TypeIsUndefinedError();

    if (!createDoc.acknowledged) throw new UnexpectedError();

    res.status(201).json({
      success: true,
      body: docBody,
    });
  } catch (error) {
    if (req.body.type === "buy") var api_url = "/api/v1/buy_orders/";
    if (req.body.type === "sell") var api_url = "/api/v1/sell_orders/";
    await errorReport(api_url, error.message, req.body);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getOrders = async (req, res, next) => {
  try {
    // Reading all query variables given by the user
    const query = req.query;
    const sort = query.sort ? query.sort : null;
    let order = query.order ? query.order : 1;
    let limit = query.limit ? query.limit : LIMIT_SIZE;
    const filterBy = query.filterBy ? query.filterBy : null;
    let filter = filterBy && query.filter ? query.filter : null;
    let skip = query.skip ? query.skip : 0;

    // Permissible filterBy & sort values
    const available_filters = ["nft_color_id", "erc721_token", "current"];
    const available_sorters = [
      "erc20TokenAmount",
      "erc721TokenId",
      "created_at",
      "expiry",
    ];

    if (order && isNaN(parseInt(order))) throw new Error("invalid order");
    order = parseInt(order);

    // Error handling for incorrect inputs in query
    if (filterBy && !available_filters.includes(filterBy))
      throw new Error("entered 'filter by' is not supported");
    if (filterBy && !filter) throw new Error("filter not provided");
    if (sort && !available_sorters.includes(sort))
      throw new Error("entered 'sorter' is not supported");
    if (order && order !== 1 && order !== -1)
      throw new Error("order given is not valid");
    if (limit && isNaN(parseInt(limit))) throw new Error("invalid limit");
    if (skip && isNaN(parseInt(skip))) throw new Error("invalid skip");

    // Convert limit & skip to number
    limit = parseInt(limit);
    skip = parseInt(skip);

    // Check max limit that is permissible
    if (limit > MAX_LIMIT) throw new Error("Exceeded maximum limit");
    if (skip < 0) throw new Error("Exceeded minimum skip");

    const aggregateQuery = [];

    if (filterBy === available_filters[1]) {
      filter = JSON.parse(filter);
      if (!filter.erc721Token)
        throw new MissingRequiredFieldError("erc721Token");
      if (!filter.erc721TokenId)
        throw new MissingRequiredFieldError("erc721TokenId");
      if (filter.current !== undefined) {
        filter.current = filter.current.toString();
        filter.current = filter.current.split(",");
        for (let i = 0; i < filter.current.length; i++) {
          filter.current[i] = parseInt(filter.current[i]);
          if (
            typeof filter.current[i] !== "number" ||
            isNaN(filter.current[i]) ||
            (filter.current[i] > 3 && filter.current[i] < 0)
          )
            throw new InvalidCurrent();
        }
        aggregateQuery.push({
          $match: {
            $and: [
              { erc721Token: filter.erc721Token },
              { erc721TokenId: filter.erc721TokenId },
              { current: { $in: filter.current } },
            ],
          },
        });
      } else {
        aggregateQuery.push({
          $match: {
            $and: [
              { erc721Token: filter.erc721Token },
              { erc721TokenId: filter.erc721TokenId },
            ],
          },
        });
      }
    } else if (filterBy === available_filters[0]) {
      aggregateQuery.push({
        $match: { nft_color_id: new ObjectId(filter) },
      });
    } else if (filterBy === available_filters[2]) {
      filter = filter.split(",");
      for (let i = 0; i < filter.length; i++) {
        filter[i] = parseInt(filter[i]);
        if (
          typeof filter[i] !== "number" ||
          isNaN(filter[i]) ||
          (filter[i] > 3 && filter[i] < 0)
        )
          throw new InvalidCurrent();
      }

      aggregateQuery.push({
        $match: { current: { $in: filter } },
      });
    } else {
      throw new Error("entered 'filter by' is not supported");
    }

    if (query.type === "both") {
      if (order === 1) {
        aggregateQuery.push({ $sort: { createdAt: 1 } });
        if (limit) aggregateQuery.push({ $limit: limit });

        const [buyOrders, sellOrders] = await Promise.all([
          buy_orders_collection
            .aggregate(
              [...aggregateQuery, { $addFields: { order_direction: 1 } }],
              { allowDiskUse: true }
            )
            .toArray(),
          sell_orders_collection
            .aggregate(
              [...aggregateQuery, { $addFields: { order_direction: 0 } }],
              { allowDiskUse: true }
            )
            .toArray(),
        ]);
        let orders = [];

        if (buyOrders.length === 0 && sellOrders.length === 0) orders = [];
        else if (buyOrders.length === 0) orders = sellOrders;
        else if (sellOrders.length === 0) orders = buyOrders;
        else {
          let i = 0,
            j = 0;
          while (
            orders.length < limit &&
            i < buyOrders.length &&
            j < sellOrders.length
          ) {
            if (buyOrders[i].createdAt < sellOrders[j].createdAt) {
              orders.push(buyOrders[i]);
              i++;
            } else {
              orders.push(sellOrders[j]);
              j++;
            }
          }
          if (orders.length < limit) {
            const diff = limit - orders.length;
            if (i >= buyOrders.length) {
              while (orders.length < limit && j < sellOrders.length) {
                orders.push(sellOrders[j]);
                j++;
              }
            } else {
              while (orders.length < limit && i < buyOrders.length) {
                orders.push(buyOrders[i]);
                i++;
              }
            }
          }
        }
        res.status(200).json({
          success: true,
          body: orders,
        });
        return;
      } else if (order === -1) {
        aggregateQuery.push({ $sort: { createdAt: -1 } });
        if (limit) aggregateQuery.push({ $limit: limit });

        const [buyOrders, sellOrders] = await Promise.all([
          buy_orders_collection
            .aggregate(
              [...aggregateQuery, { $addFields: { order_direction: 1 } }],
              { allowDiskUse: true }
            )
            .toArray(),
          sell_orders_collection
            .aggregate(
              [...aggregateQuery, { $addFields: { order_direction: 0 } }],
              { allowDiskUse: true }
            )
            .toArray(),
        ]);
        let orders = [];

        if (buyOrders.length === 0 && sellOrders.length === 0) orders = [];
        else if (buyOrders.length === 0) orders = sellOrders;
        else if (sellOrders.length === 0) orders = buyOrders;
        else {
          let i = 0,
            j = 0;
          while (
            orders.length < limit &&
            i < buyOrders.length &&
            j < sellOrders.length
          ) {
            if (buyOrders[i].createdAt > sellOrders[j].createdAt) {
              orders.push(buyOrders[i]);
              i++;
            } else {
              orders.push(sellOrders[j]);
              j++;
            }
          }
          if (orders.length < limit) {
            const diff = limit - orders.length;
            if (i >= buyOrders.length) {
              while (orders.length < limit && j < sellOrders.length) {
                orders.push(sellOrders[j]);
                j++;
              }
            } else {
              while (orders.length < limit && i < buyOrders.length) {
                orders.push(buyOrders[i]);
                i++;
              }
            }
          }
        }
        res.status(200).json({
          success: true,
          body: orders,
        });
        return;
      }
    }

    if (sort) {
      if (sort === available_sorters[0])
        aggregateQuery.push({ $sort: { erc20TokenAmount: order } });
      else if (sort === available_sorters[1])
        aggregateQuery.push({ $sort: { erc721TokenId: order } });
      else if (sort === available_sorters[2])
        aggregateQuery.push({ $sort: { createdAt: order } });
      else if (sort === available_sorters[3])
        aggregateQuery.push({ $sort: { expiry: order } });
    }

    aggregateQuery.push({ $skip: skip });
    aggregateQuery.push({ $limit: limit });

    let data;

    if (query.type === "buy") {
      data = await buy_orders_collection
        .aggregate(aggregateQuery, { allowDiskUse: true })
        .toArray();
    } else if (query.type === "sell") {
      data = await sell_orders_collection
        .aggregate(aggregateQuery, { allowDiskUse: true })
        .toArray();
    } else throw new TypeIsUndefinedError();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    await errorReport("/api/v1/orders", error.message, req.query);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const updateCurrentAndHashes = async (req, res, next) => {
  try {
    const body = req.body;

    const bodyToSend = { current: body.current };

    if (!body.order_id && !body.nonce)
      throw new MissingRequiredFieldError("order_id or nonce");

    // order_id
    if (
      body.order_id &&
      (typeof body.order_id !== "string" || !ObjectId.isValid(body.order_id))
    )
      throw new InvalidOrderId();

    // nonce
    if (body.nonce && typeof body.nonce !== "number")
      throw new InvalidNonceError();

    // current
    if (!body.current) throw new MissingRequiredFieldError("current");
    if (
      body.current &&
      (typeof body.current !== "number" || isNaN(body.current))
    )
      throw new InvalidCurrent();

    // makingHash
    if (body.makingHash) {
      const receipt = await web3.eth.getTransactionReceipt(body.makingHash);
      if (!receipt.blockNumber) throw new InvalidMakingHash();
      else bodyToSend.makingHash = body.makingHash;

      let tx_receipt = await infura_http.getTransactionReceipt(body.makingHash);
      if (tx_receipt.status != 0) {
        for (var i = 0; i < tx_receipt.logs.length; ++i) {
          if (
            tx_receipt.logs[i].topics ==
            "0x8c5d0c41fb16a7317a6c55ff7ba93d9d74f79e434fefa694e50d6028afbfa3f0"
          ) {
            let log = tx_receipt.logs[i].data;
            var numParams = (log.length - 2) / 64;
            if (numParams != 18) {
              throw new InvalidConfirm();
            }
            var paramsForOrder = [];
            for (var j = 0; j < numParams; ++j) {
              let param;
              if (j == 0 || j == 3 || j == 4 || j == 6 || j == 9 || j == 14) {
                param = parseInt(
                  log.substring(2 + 64 * j, 2 + 64 * (j + 1)),
                  16
                );
              } else {
                param =
                  "0x" +
                  log
                    .substring(2 + 64 * j, 2 + 64 * (j + 1))
                    .replace(/^0+/, "");
              }
              // console.log(param);
              paramsForOrder[j] = param;
            }
            if (paramsForOrder[4] != body.nonce) {
              throw new InvalidTransaction();
            }
            break;
          }
        }
        if (i == tx_receipt.logs.length) {
          throw new InvalidTransaction();
        }
      }
    }
    // acceptingHash
    var from_address = "";
    if (body.acceptingHash) {
      const receipt = await web3.eth.getTransactionReceipt(body.acceptingHash);
      from_address = receipt.from;
      if (!receipt.blockNumber) throw new InvalidMakingHash();
      else bodyToSend.acceptingHash = body.acceptingHash;

      let tx_receipt = await infura_http.getTransactionReceipt(
        body.acceptingHash
      );
      var tx = await web3.eth.getTransaction(body.acceptingHash);
      var hashType = tx.input.slice(0,10)
      //  0xeae93ee7 batch order
      // 0xfbee349d simple order
      var decoded_nonces = [];
      if (tx_receipt.status != 0) {
        for (var i = 0; i < tx_receipt.logs.length; ++i) {
          if (
            tx_receipt.logs[i].topics ==
            "0x50273fa02273cceea9cf085b42de5c8af60624140168bd71357db833535877af"
          ) {
            // ERC721OrderFilled : erc721orders that accepted
            let abi = [
              "event ERC721OrderFilled(uint8 direction, address maker, address taker, uint256 nonce, address erc20Token, uint256 erc20TokenAmount, address erc721Token, uint256 erc721TokenId, address matcher)",
            ];
            let iface = new ethers.utils.Interface(abi);
            let log = iface.parseLog(tx_receipt.logs[i]);
            decoded_nonces.push(log.args.nonce.toNumber());
            // if (log.args.nonce.toNumber() != body.nonce) {
            //   throw new InvalidTransaction();
            // }
            // break;
          }
        }
        // if (i == tx_receipt.logs.length) {
        //   throw new InvalidTransaction();
        // }
        // decoded_nonces.includes(body.nonce)
        if(!decoded_nonces.includes(body.nonce)){
          throw new InvalidTransaction();
        }
      }
    }
    var orderToUpdate_buy;
    var orderToUpdate_sell;
    if (body.nonce) {
      orderToUpdate_buy = await buy_orders_collection.findOne({
        nonce: body.nonce,
      });
      orderToUpdate_sell = await sell_orders_collection.findOne({
        nonce: body.nonce,
      });
    }
    if (body.type === "buy") {
      if (body.current) {
        if (body.current == 1) {
          var updateData = {};
          if (body.nonce) {
            updateData.current = 1;
            updateData.makingHash = body.makingHash;
            await buy_orders_collection.findOneAndUpdate(
              { nonce: body.nonce },
              { $set: updateData },
              { returnDocument: "after" }
            );
          }
        }
      }
      if (orderToUpdate_buy.current == 1 || orderToUpdate_buy.current == 4) {
        let orderToUpdate = undefined;
        if (body.nonce) {
          // setting current for all other active orders for the given erc721 token and token id as 4
          if (bodyToSend.current === 3) {
            // checking if the current doc to update had current = 3
            orderToUpdate = await buy_orders_collection.findOne({
              nonce: body.nonce,
            });
            // getting NFT metadata
            const config = {
              method: "get",
              url:
                "https://api.simplehash.com/api/v0/nfts/ethereum/" +
                orderToUpdate.erc721Token +
                "/" +
                orderToUpdate.erc721TokenId,
              headers: { "X-API-KEY": SIMPLEHASH_APIKey },
            };

            var token_data = await axios(config);
            const seller_subject = "SOLD";
            const seller_address = from_address;
            const TokenID = orderToUpdate.erc721TokenId;
            const accepting_transaction =
              "https://etherscan.io/tx/" + orderToUpdate.acceptingHash;
            var seller_price =
              parseInt(orderToUpdate.erc20TokenAmount) +
              parseInt(orderToUpdate.fees[0].amount);
            // const currency = orderToUpdate.erc721Token;
            const buyer_subject = "PURCHASED";
            const buyer_address = orderToUpdate.maker;
            var buyer_price =
              parseInt(orderToUpdate.erc20TokenAmount) +
              parseInt(orderToUpdate.fees[0].amount);
            // get token symbol
            var token_symbol = await getTokenSynbol(orderToUpdate.erc20Token);
            if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
              seller_price = seller_price / 1000000000000000000;
              buyer_price = buyer_price / 1000000000000000000;
            } else if(token_symbol == "USDC" || token_symbol == "USDT") {
              seller_price = seller_price / 1000000;
              buyer_price = buyer_price / 1000000;
            }
            const seller_content =
              "Color NFT : " +
              TokenID +
              " sold for <br/><br/>" +
              seller_price +
              " " +
              token_symbol +
              " to " +
              buyer_address.slice(0, 5) +
              "..." +
              buyer_address.slice(-4);
            const buyer_content =
              "Bid of " +
              buyer_price +
              " " +
              token_symbol +
              " for Color <br/><br/>NFT: " +
              TokenID +
              " accepted";
            const image_router = token_data.data.image_url;

            // for seller notification
            // get knock user data
            var notification_user = {};
            notification_user = await getKnockUser(seller_address);
            // set notification content variable
            var notification_content = {
              subject: seller_subject,
              content: seller_content,
              image: image_router,
              expiry: "",
              link: accepting_transaction,
              tokenID:TokenID
            };
            // send notification
            if (notification_user.user_id != "") {
              await sendNotification(
                "www",
                notification_user.user_id,
                notification_content
              );
              if (notification_user.user_mail != null) {
                await sendNotification(
                  "email",
                  notification_user.user_id,
                  notification_content
                );
              }
            }
            // for buyer notification
            // get knock user data
            notification_user = await getKnockUser(buyer_address);
            // set notification content variable
            var notification_content = {
              subject: buyer_subject,
              content: buyer_content,
              image: image_router,
              expiry: "",
              link: accepting_transaction,
              tokenID:TokenID
            };
            // send notification
            if (notification_user.user_id != "") {
              await sendNotification(
                "www",
                notification_user.user_id,
                notification_content
              );
              if (notification_user.user_mail != null) {
                await sendNotification(
                  "email",
                  notification_user.user_id,
                  notification_content
                );
              }
            }

            // send report to discord  
            const metadataConfig = {
                method: 'get',
                url: 'https://metadata.color.museum/api/v1/image/get-image/' + TokenID
            }        
            var metadata = await axios(metadataConfig)
            var report_val = {};
            report_val.number = metadata.data.nftNo;
            report_val.name = metadata.data.name;
            report_val.hexa = metadata.data.hex;
            report_val.imageSocial = metadata.data.image;
            report_val.tokenPrice = seller_price;
            report_val.tokenSymbol = token_symbol;
            report_val.tokenID = TokenID;
            report_val.usdPrice = await getUSDVal(seller_price, token_symbol);
            var ensName;
            // ensName = await getENSName("0xf090ee2332de866f61f57869ad72dab8f0657c59");
            ensName = await getENSName(buyer_address);
            if(ensName.success == true){
              report_val.buyer = ensName.ensName;
            }else{
              report_val.buyer = buyer_address.slice(0, 5) +
              "..." + buyer_address.slice(-4); 
            }
            ensName = await getENSName(seller_address);   
            if(ensName.success == true){
              report_val.seller = ensName.ensName;
            }else{
              report_val.seller = seller_address.slice(0, 5) +
              "..." + seller_address.slice(-4); 
            }            
            report_val.link = accepting_transaction;
            await discordReport(report_val);

          }
          await buy_orders_collection.findOneAndUpdate(
            { nonce: body.nonce },
            { $set: bodyToSend },
            { returnDocument: "after" }
          );
          if (from_address != "")
            await buy_orders_collection.findOneAndUpdate(
              { nonce: body.nonce },
              { $set: { from_address: from_address } },
              { returnDocument: "after" }
            );
        } else {
          throw new UnexpectedError();
        }

        // perform an update if the current is being set to 3
        if (orderToUpdate && orderToUpdate._id) {
          const orders = await buy_orders_collection
            .aggregate([
              {
                $match: {
                  $and: [
                    { erc721Token: orderToUpdate.erc721Token },
                    { erc721TokenId: orderToUpdate.erc721TokenId },
                    { _id: { $ne: new ObjectId(orderToUpdate._id) } },
                    { expiry: { $gt: new Date().getTime() / 1000 } },
                    { current: 1 },
                  ],
                },
              },
            ])
            .toArray();
          if (orders.length !== 0) {
            const ids = [];
            orders.forEach((elem) => {
              ids.push(new ObjectId(elem._id));
            });
            await buy_orders_collection.updateMany(
              { _id: { $in: ids } },
              { $set: { current: 4 } },
              { multi: true }
            );
          }

          // update current for sell orders when buy order accept
          const orders_sell = await sell_orders_collection
            .aggregate([
              {
                $match: {
                  $and: [
                    { erc721Token: orderToUpdate.erc721Token },
                    { erc721TokenId: orderToUpdate.erc721TokenId },
                    { _id: { $ne: new ObjectId(orderToUpdate._id) } },
                    { expiry: { $gt: new Date().getTime() / 1000 } },
                    { current: 1 }
                  ],
                },
              },
            ])
            .toArray();
          if (orders_sell.length !== 0) {
            const ids_sell = [];
            orders_sell.forEach((elem) => {
              ids_sell.push(new ObjectId(elem._id));
            });
            await sell_orders_collection.updateMany(
              { _id: { $in: ids_sell } },
              { $set: { current: 4 } },
              { multi: true }
            );
          }
          // end - update current for sell orders when buy order accept
        }
      }
    } else if (body.type === "sell") {
      if (body.current) {
        if (body.current == 1) {
          var updateData = {};
          if (body.nonce) {
            updateData.current = 1;
            updateData.makingHash = body.makingHash;
            await sell_orders_collection.findOneAndUpdate(
              { nonce: body.nonce },
              { $set: updateData },
              { returnDocument: "after" }
            );
          }
        }
      }
      let orderToUpdate = undefined;
      if (body.nonce) {
        if (
          orderToUpdate_sell.current == 1 ||
          orderToUpdate_sell.current == 4
        ) {
          // setting current for all other active orders for the given erc721 token and token id as 4
          if (bodyToSend.current === 3) {
            // checking if the current doc to update had current = 3
            orderToUpdate = await sell_orders_collection.findOne({
              nonce: body.nonce,
            });
            // getting NFT metadata
            const config = {
              method: "get",
              url:
                "https://api.simplehash.com/api/v0/nfts/ethereum/" +
                orderToUpdate.erc721Token +
                "/" +
                orderToUpdate.erc721TokenId,
              headers: { "X-API-KEY": SIMPLEHASH_APIKey },
            };

            var token_data = await axios(config);
            const seller_subject = "SOLD";
            const seller_address = orderToUpdate.maker;
            const TokenID = orderToUpdate.erc721TokenId;
            const accepting_transaction =
              "https://etherscan.io/tx/" + orderToUpdate.acceptingHash;
            var seller_price =
              parseInt(orderToUpdate.erc20TokenAmount) +
              parseInt(orderToUpdate.fees[0].amount);
            const buyer_subject = "PURCHASED";
            const buyer_address = from_address;
            var buyer_price =
              parseInt(orderToUpdate.erc20TokenAmount) +
              parseInt(orderToUpdate.fees[0].amount);
            // get token symbol
            var token_symbol = await getTokenSynbol(orderToUpdate.erc20Token);
            if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
              seller_price = seller_price / 1000000000000000000;
              buyer_price = buyer_price / 1000000000000000000;
            } else if(token_symbol == "USDC" || token_symbol == "USDT") {
              seller_price = seller_price / 1000000;
              buyer_price = buyer_price / 1000000;
            }
            const seller_content =
              "Color NFT : " +
              TokenID +
              " sold for <br/><br/>" +
              seller_price +
              " " +
              token_symbol +
              " to " +
              buyer_address.slice(0, 5) +
              "..." +
              buyer_address.slice(-4);
            const buyer_content =
              "Bid of " +
              buyer_price +
              " " +
              token_symbol +
              " for Color <br/><br/>NFT: " +
              TokenID +
              " accepted";
            const image_router = token_data.data.image_url;

            // for seller notification
            // get knock user data
            var notification_user = {};
            notification_user = await getKnockUser(seller_address);
            // set notification content variable
            var notification_content = {
              subject: seller_subject,
              content: seller_content,
              image: image_router,
              expiry: "",
              link: accepting_transaction,
              tokenID: TokenID
            };
            // send notification
            if (notification_user.user_id != "") {
              await sendNotification(
                "www",
                notification_user.user_id,
                notification_content
              );
              if (notification_user.user_mail != null) {
                await sendNotification(
                  "email",
                  notification_user.user_id,
                  notification_content
                );
              }
            }

            // for buyer notification
            // get knock user data
            notification_user = await getKnockUser(buyer_address);
            // set notification content variable
            var notification_content = {
              subject: buyer_subject,
              content: buyer_content,
              image: image_router,
              expiry: "",
              link: accepting_transaction,
              tokenID:TokenID
            };
            // send notification
            if (notification_user.user_id != "") {
              await sendNotification(
                "www",
                notification_user.user_id,
                notification_content
              );
              if (notification_user.user_mail != null) {
                await sendNotification(
                  "email",
                  notification_user.user_id,
                  notification_content
                );
              }
            }
            // send report to discord
            const metadataConfig = {
              method: 'get',
              url: 'https://metadata.color.museum/api/v1/image/get-image/' + TokenID
            } 
            var metadata = await axios(metadataConfig)
            var report_val = {};
            report_val.number = metadata.data.nftNo;
            report_val.name = metadata.data.name;
            report_val.hexa = metadata.data.hex;
            report_val.imageSocial = metadata.data.image;
            report_val.tokenPrice = seller_price;
            report_val.tokenSymbol = token_symbol;
            report_val.tokenID = TokenID;
            report_val.usdPrice = await getUSDVal(seller_price, token_symbol);
            var ensName;
            ensName = await getENSName(buyer_address);
            if(ensName.success == true){
              report_val.buyer = ensName.ensName;
            }else{
              report_val.buyer = buyer_address.slice(0, 5) +
              "..." + buyer_address.slice(-4); 
            }
            // ensName = await getENSName("0xf090ee2332de866f61f57869ad72dab8f0657c59");
            ensName = await getENSName(seller_address);   
            if(ensName.success == true){
              report_val.seller = ensName.ensName;
            }else{
              report_val.seller = seller_address.slice(0, 5) +
              "..." + seller_address.slice(-4); 
            } 
            report_val.link = accepting_transaction;
            await discordReport(report_val);

          }
          await sell_orders_collection.findOneAndUpdate(
            { nonce: body.nonce },
            { $set: bodyToSend },
            { returnDocument: "after" }
          );
          if (from_address != "")
            await sell_orders_collection.findOneAndUpdate(
              { nonce: body.nonce },
              { $set: { from_address: from_address } },
              { returnDocument: "after" }
            );
        }
      } else {
        throw new UnexpectedError();
      }

      // perform an update if the current is being set to 3
      if (orderToUpdate && orderToUpdate._id) {
        const orders = await sell_orders_collection
          .aggregate([
            {
              $match: {
                $and: [
                  { erc721Token: orderToUpdate.erc721Token },
                  { erc721TokenId: orderToUpdate.erc721TokenId },
                  { _id: { $ne: new ObjectId(orderToUpdate._id) } },
                  { expiry: { $gt: new Date().getTime() / 1000 } },
                  { current: 1 }
                ],
              },
            },
          ])
          .toArray();
          console.log("orders.length")
        if (orders.length !== 0) {
          const ids = [];
          orders.forEach((elem) => {
            ids.push(new ObjectId(elem._id));
          });
          await sell_orders_collection.updateMany(
            { _id: { $in: ids } },
            { $set: { current: 4 } },
            { multi: true }
          );
        }

        // update current for buy orders when sell order accept
        const orders_buy = await buy_orders_collection
          .aggregate([
            {
              $match: {
                $and: [
                  { erc721Token: orderToUpdate.erc721Token },
                  { erc721TokenId: orderToUpdate.erc721TokenId },
                  { _id: { $ne: new ObjectId(orderToUpdate._id) } },
                  { expiry: { $gt: new Date().getTime() / 1000 } },
                  { current: 1 }
                ],
              },
            },
          ])
          .toArray();
        if (orders_buy.length !== 0) {
          const ids_buy = [];
          orders_buy.forEach((elem) => {
            ids_buy.push(new ObjectId(elem._id));
          });
          await buy_orders_collection.updateMany(
            { _id: { $in: ids_buy } },
            { $set: { current: 4 } },
            { multi: true }
          );
        }
        // end - update current for buy orders when sell order accept
      }
    } else {
      throw new TypeIsUndefinedError();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    if (req.body.type === "buy") var api_url = "/api/v1/buy_orders/current";
    if (req.body.type === "sell") var api_url = "/api/v1/sell_orders/current";
    await errorReport(api_url, error.message, req.body);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const body = req.body;

    const bodyToSend = { current: 5 };

    if (!body.order_id && !body.nonce)
      throw new MissingRequiredFieldError("order_id or nonce");

    // order_id
    if (
      body.order_id &&
      (typeof body.order_id !== "string" || !ObjectId.isValid(body.order_id))
    )
      throw new InvalidOrderId();

    // nonce
    if (body.nonce && typeof body.nonce !== "number")
      throw new InvalidNonceError();

    if (body.cancelHash) {
      const receipt = await web3.eth.getTransactionReceipt(body.cancelHash);
      // cancelHash = receipt.cancelHash;
      if (!receipt.blockNumber) throw new InvalidMakingHash();
      else bodyToSend.cancelHash = body.cancelHash;

      let tx_receipt = await infura_http.getTransactionReceipt(body.cancelHash);
      if (tx_receipt.status != 0) {
        for (var i = 0; i < tx_receipt.logs.length; ++i) {
          if (
            tx_receipt.logs[i].topics ==
            "0xa015ad2dc32f266993958a0fd9884c746b971b254206f3478bc43e2f125c7b9e"
          ) {
            let abi = [
              "event ERC721OrderCancelled( address maker, uint256 nonce)",
            ];
            let iface = new ethers.utils.Interface(abi);
            let log = iface.parseLog(tx_receipt.logs[i]);
            if (log.args.nonce.toNumber() != body.nonce) {
              throw new InvalidTransaction();
            }
            break;
          }
        }
        if (i == tx_receipt.logs.length) {
          throw new InvalidTransaction();
        }
      }
    }
    let orderToUpdate_buy = [];
    let orderToUpdate_sell = [];
    if (body.nonce) {
      orderToUpdate_buy = await buy_orders_collection.findOne({
        nonce: body.nonce,
      });
      orderToUpdate_sell = await sell_orders_collection.findOne({
        nonce: body.nonce,
      });
    }
    if (orderToUpdate_sell == null && orderToUpdate_buy.length != 0) {
      if (body.nonce) {
        if (orderToUpdate_buy.current == 1 || orderToUpdate_buy.current == 4) {
          await buy_orders_collection.findOneAndUpdate(
            { nonce: body.nonce },
            { $set: bodyToSend },
            { returnDocument: "after" }
          );
          // getting NFT metadata
          const config = {
            method: "get",
            url:
              "https://api.simplehash.com/api/v0/nfts/ethereum/" +
              orderToUpdate_buy.erc721Token +
              "/" +
              orderToUpdate_buy.erc721TokenId,
            headers: { "X-API-KEY": SIMPLEHASH_APIKey },
          };

          var token_data = await axios(config);
          // get information for notification
          const cancel_subject = "BID CANCELED";
          const cancel_address = orderToUpdate_buy.maker;
          const cancel_TokenID = orderToUpdate_buy.erc721TokenId;
          const cancel_transaction =
            "https://etherscan.io/tx/" + body.cancelHash;
          var cancel_price =
            parseInt(orderToUpdate_buy.erc20TokenAmount) +
            parseInt(orderToUpdate_buy.fees[0].amount);
          // get token symbol
          var token_symbol = await getTokenSynbol(orderToUpdate_buy.erc20Token);
          if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
            cancel_price = cancel_price / 1000000000000000000;
          } else if(token_symbol == "USDC" || token_symbol == "USDT") {
            cancel_price = cancel_price / 1000000;
          }
          const cancel_content =
            "Offer to buy Color NFT: <br/><br/>" +
            cancel_TokenID +
            " for " +
            cancel_price +
            " " +
            token_symbol +
            " withdrawn";
          const cancel_image = token_data.data.image_url;

          // get knock user data
          var notification_user = {};
          notification_user = await getKnockUser(cancel_address);
          // set notification content variable
          var notification_content = {
            subject: cancel_subject,
            content: cancel_content,
            image: cancel_image,
            expiry: "",
            link: cancel_transaction,
            tokenID:cancel_TokenID
          };
          // send notification
          if (notification_user.user_id != "") {
            await sendNotification(
              "www",
              notification_user.user_id,
              notification_content
            );
            if (notification_user.user_mail != null) {
              await sendNotification(
                "email",
                notification_user.user_id,
                notification_content
              );
            }
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    } else if (orderToUpdate_buy == null && orderToUpdate_sell.length != 0) {
      if (body.nonce) {
        if (
          orderToUpdate_sell.current == 1 ||
          orderToUpdate_sell.current == 4
        ) {
          await sell_orders_collection.findOneAndUpdate(
            { nonce: body.nonce },
            { $set: bodyToSend },
            { returnDocument: "after" }
          );
          // getting NFT metadata
          const config = {
            method: "get",
            url:
              "https://api.simplehash.com/api/v0/nfts/ethereum/" +
              orderToUpdate_sell.erc721Token +
              "/" +
              orderToUpdate_sell.erc721TokenId,
            headers: { "X-API-KEY": SIMPLEHASH_APIKey },
          };

          var token_data = await axios(config);
          // get information for notification
          const cancel_subject = "SELL CANCELED";
          const cancel_address = orderToUpdate_sell.maker;
          const cancel_TokenID = orderToUpdate_sell.erc721TokenId;
          const cancel_transaction =
            "https://etherscan.io/tx/" + body.cancelHash;
          var cancel_price =
            parseInt(orderToUpdate_sell.erc20TokenAmount) +
            parseInt(orderToUpdate_sell.fees[0].amount);
          var token_symbol = await getTokenSynbol(
            orderToUpdate_sell.erc20Token
          );
          if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
            cancel_price = cancel_price / 1000000000000000000;
          } else if(token_symbol == "USDC" || token_symbol == "USDT") {
            cancel_price = cancel_price / 1000000;
          }
          const cancel_content =
            "Listing of Color NFT: " +
            cancel_TokenID +
            " <br/><br/>for " +
            cancel_price +
            " " +
            token_symbol +
            " removed";
          const cancel_image = token_data.data.image_url;

          // get knock user data
          var notification_user = {};
          notification_user = await getKnockUser(cancel_address);
          // set notification content variable
          var notification_content = {
            subject: cancel_subject,
            content: cancel_content,
            image: cancel_image,
            expiry: "",
            link: cancel_transaction,
            tokenID: cancel_TokenID
          };
          // send notification
          if (notification_user.user_id != "") {
            await sendNotification(
              "www",
              notification_user.user_id,
              notification_content
            );
            if (notification_user.user_mail != null) {
              await sendNotification(
                "email",
                notification_user.user_id,
                notification_content
              );
            }
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    }
  } catch (error) {
    await errorReport("/api/v1/orders/cancel", error.message, req.body);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const confirmOrder = async (req, res, next) => {
  try {
    const body = req.body;
    // nonce
    if (body.nonce && typeof body.nonce !== "number")
      throw new InvalidNonceError();
    if (body.transaction_hash) {
      const receipt = await web3.eth.getTransactionReceipt(
        body.transaction_hash
      );
      if (!receipt.blockNumber) throw new InvalidMakingHash();
    }
    let buy_orders = [];
    let sell_orders = [];
    if (body.nonce) {
      buy_orders = await buy_orders_collection.findOne({ nonce: body.nonce });
      sell_orders = await sell_orders_collection.findOne({ nonce: body.nonce });
    }
    if (sell_orders == null && buy_orders.length != 0) {
      // the case of buy_order
      if (body.nonce) {
        // getting NFT metadata
        const config = {
          method: "get",
          url:
            "https://api.simplehash.com/api/v0/nfts/ethereum/" +
            buy_orders.erc721Token +
            "/" +
            buy_orders.erc721TokenId,
          headers: { "X-API-KEY": SIMPLEHASH_APIKey },
        };
        var token_data = await axios(config);
        // get information for notification
        const confirm_subject = "BID PLACED";
        const confirm_address = buy_orders.maker;
        const confirm_TokenID = buy_orders.erc721TokenId;
        const confirm_expiryDate = buy_orders.expiry_date;
        const confirm_transaction =
          "https://etherscan.io/tx/" + body.transaction_hash;
        var owner_price =
          parseInt(buy_orders.erc20TokenAmount) +
          parseInt(buy_orders.fees[0].amount);
        var confirm_price =
          parseInt(buy_orders.erc20TokenAmount) +
          parseInt(buy_orders.fees[0].amount);
        // get token symbol
        var token_symbol = await getTokenSynbol(buy_orders.erc20Token);
        if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
          confirm_price = confirm_price / 1000000000000000000;
          owner_price = owner_price / 1000000000000000000;
        } else if(token_symbol == "USDC" || token_symbol == "USDT") {
          confirm_price = confirm_price / 1000000;
          owner_price = owner_price / 1000000;
        }
        const confirm_content =
          confirm_price +
          " " +
          token_symbol +
          " bid for Color NFT:<br /><br />" +
          confirm_TokenID +
          " posted";
        const confirm_formatedExpiry =
          "Expires on " +
          (confirm_expiryDate.getMonth() + 1) +
          "/" +
          confirm_expiryDate.getDate() +
          "/" +
          String(confirm_expiryDate.getYear()).slice(-2) +
          " " +
          confirm_expiryDate.getHours() +
          ":" +
          confirm_expiryDate.getMinutes() +
          " GMT";
        const confirm_image = token_data.data.image_url;
        const owner_subject = "BID RECEIVED";
        // const NFT_owner = token_data.data.owners[0].owner_address;
        const NFT_owner = buy_orders.taker;
        const owner_content =
          "Bid of " +
          owner_price +
          " " +
          token_symbol +
          " for Color<br/><br/>NFT: " +
          confirm_TokenID +
          " from " +
          confirm_address.slice(0, 5) +
          "..." +
          confirm_address.slice(-4);
        // get knock user data
        var notification_user = {};
        notification_user = await getKnockUser(confirm_address);
        // notification_user = await getKnockUser("0x697C4A6aAae5a9296ce323F20F20485D2FEbC032");
        // set notification content variable
        var notification_content = {
          subject: confirm_subject,
          content: confirm_content,
          image: confirm_image,
          expiry: confirm_formatedExpiry,
          link: confirm_transaction,
          tokenID: confirm_TokenID
        };
        // send notification
        if (notification_user.user_id != "") {
          await sendNotification(
            "www",
            notification_user.user_id,
            notification_content
          );
          if (notification_user.user_mail != null) {
            await sendNotification(
              "email",
              notification_user.user_id,
              notification_content
            );
          }
        }

        // get knock user data
        notification_user = await getKnockUser(NFT_owner);
        // set notification content variable
        notification_content = {
          subject: owner_subject,
          content: owner_content,
          image: confirm_image,
          expiry: "",
          link: confirm_transaction,
          tokenID: confirm_TokenID
        };
        // send notification
        if (notification_user.user_id != "") {
          await sendNotification(
            "www",
            notification_user.user_id,
            notification_content
          );
          if (notification_user.user_mail != null) {
            await sendNotification(
              "email",
              notification_user.user_id,
              notification_content
            );
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    } else if (buy_orders == null && sell_orders.length != 0) {
      // the case of sell_order
      if (body.nonce) {
        // getting NFT metadata
        const config = {
          method: "get",
          url:
            "https://api.simplehash.com/api/v0/nfts/ethereum/" +
            sell_orders.erc721Token +
            "/" +
            sell_orders.erc721TokenId,
          headers: { "X-API-KEY": SIMPLEHASH_APIKey },
        };
        var token_data = await axios(config);
        // get information for notification
        const confirm_subject = "LISTED";
        const confirm_address = sell_orders.maker;
        const confirm_TokenID = sell_orders.erc721TokenId;
        const confirm_expiryDate = sell_orders.expiry_date;
        const confirm_transaction =
          "https://etherscan.io/tx/" + body.transaction_hash;
        var confirm_price =
          parseInt(sell_orders.erc20TokenAmount) +
          parseInt(sell_orders.fees[0].amount);
        // get token symbol
        var token_symbol = await getTokenSynbol(sell_orders.erc20Token);
        if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
          confirm_price = confirm_price / 1000000000000000000;
        } else if(token_symbol == "USDC" || token_symbol == "USDT") {
          confirm_price = confirm_price / 1000000;
        }
        const confirm_content =
          "Color NFT: " +
          confirm_TokenID +
          " is now<br /><br />listed for sale for " +
          confirm_price +
          " " +
          token_symbol;
        const confirm_formatedExpiry =
          "Expires on " +
          (confirm_expiryDate.getMonth() + 1) +
          "/" +
          confirm_expiryDate.getDate() +
          "/" +
          String(confirm_expiryDate.getYear()).slice(-2) +
          " " +
          confirm_expiryDate.getHours() +
          ":" +
          confirm_expiryDate.getMinutes() +
          " GMT";
        const confirm_image = token_data.data.image_url;
        // get knock user data
        var notification_user = {};
        notification_user = await getKnockUser(confirm_address);
        // set notification content variable
        var notification_content = {
          subject: confirm_subject,
          content: confirm_content,
          image: confirm_image,
          expiry: confirm_formatedExpiry,
          link: confirm_transaction,
          tokenID: confirm_TokenID
        };
        // send notification
        if (notification_user.user_id != "") {
          await sendNotification(
            "www",
            notification_user.user_id,
            notification_content
          );
          if (notification_user.user_mail != null) {
            await sendNotification(
              "email",
              notification_user.user_id,
              notification_content
            );
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    }
  } catch (error) {
    await errorReport("/api/v1/orders/confirm", error.message, req.body);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getAvailableOrders = async (req, res, next) => {
  try {
    const sell_orders1 = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 1 }],
          },
        },
      ])
      .toArray();
    const buy_orders1 = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 1 }],
          },
        },
      ])
      .toArray();
    var return_val = {
      current1: [],
      current4: [],
    };
    for (var i = 0; i < sell_orders1.length; i++) {
      var temp = {};
      temp.nonce = sell_orders1[i].nonce;
      temp.expiration = sell_orders1[i].expiry_date;
      temp.transaction_hash = sell_orders1[i].makingHash;
      return_val.current1.push(temp);
    }
    for (var i = 0; i < buy_orders1.length; i++) {
      var temp = {};
      temp.nonce = buy_orders1[i].nonce;
      temp.expiration = buy_orders1[i].expiry_date;
      temp.transaction_hash = buy_orders1[i].makingHash;
      return_val.current1.push(temp);
    }
    const sell_orders2 = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 4 }],
          },
        },
      ])
      .toArray();
    const buy_orders2 = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 4 }],
          },
        },
      ])
      .toArray();
    for (var i = 0; i < sell_orders2.length; i++) {
      var temp = {};
      temp.nonce = sell_orders2[i].nonce;
      temp.expiration = sell_orders2[i].expiry_date;
      temp.transaction_hash = sell_orders2[i].makingHash;
      return_val.current4.push(temp);
    }
    for (var i = 0; i < buy_orders2.length; i++) {
      var temp = {};
      temp.nonce = buy_orders2[i].nonce;
      temp.expiration = buy_orders2[i].expiry_date;
      temp.transaction_hash = buy_orders2[i].makingHash;
      return_val.current4.push(temp);
    }
    res.json(return_val);
  } catch (error) {
    await errorReport("/api/v1/orders/available", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const expiriedOrder = async (req, res, next) => {
  try {
    const body = req.body;
    // nonce
    if (body.nonce && typeof body.nonce !== "number")
      throw new InvalidNonceError();
    if (body.transaction_hash) {
      const receipt = await web3.eth.getTransactionReceipt(
        body.transaction_hash
      );
      if (!receipt.blockNumber) throw new InvalidMakingHash();
    }
    let buy_orders = [];
    let sell_orders = [];
    if (body.nonce) {
      buy_orders = await buy_orders_collection.findOne({ nonce: body.nonce });
      sell_orders = await sell_orders_collection.findOne({ nonce: body.nonce });
    }
    if (sell_orders == null && buy_orders.length != 0) {
      // the case of buy_order
      if (body.nonce) {
        // res.json(buy_orders)
        await buy_orders_collection.findOneAndUpdate(
          { $and:[ {nonce: body.nonce},{$or:[{current:1},{current:4}]} ]},
          { $set: { current: 6 } },
          { returnDocument: "after" }
        );
        // getting NFT metadata
        const config = {
          method: "get",
          url:
            "https://api.simplehash.com/api/v0/nfts/ethereum/" +
            buy_orders.erc721Token +
            "/" +
            buy_orders.erc721TokenId,
          headers: { "X-API-KEY": SIMPLEHASH_APIKey },
        };
        var token_data = await axios(config);
        // get information for notification
        const expiry_subject = "BID EXPIRED";
        const expiry_address = buy_orders.maker;
        const expiry_TokenID = buy_orders.erc721TokenId;
        const expiry_transaction =
          "https://etherscan.io/tx/" + body.transaction_hash;
        var expiry_price =
          parseInt(buy_orders.erc20TokenAmount) +
          parseInt(buy_orders.fees[0].amount);
        // get token symbol
        var token_symbol = await getTokenSynbol(buy_orders.erc20Token);
        if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
          expiry_price = expiry_price / 1000000000000000000;
        } else if(token_symbol == "USDC" || token_symbol == "USDT") {
          expiry_price = expiry_price / 1000000;
        }
        const expiry_content =
          "Offer to buy Color NFT: " +
          expiry_TokenID +
          "<br/><br/>for " +
          expiry_price +
          " " +
          token_symbol +
          " expired";
        const expiry_image = token_data.data.image_url;
        // get knock user data
        var notification_user = {};
        notification_user = await getKnockUser(expiry_address);
        // set notification content variable
        var notification_content = {
          subject: expiry_subject,
          content: expiry_content,
          image: expiry_image,
          expiry: "",
          link: expiry_transaction,
          tokenID: expiry_TokenID
        };
        // send notification
        if (notification_user.user_id != "") {
          await sendNotification(
            "www",
            notification_user.user_id,
            notification_content
          );
          if (notification_user.user_mail != null) {
            await sendNotification(
              "email",
              notification_user.user_id,
              notification_content
            );
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    } else if (buy_orders == null && sell_orders.length != 0) {
      // the case of sell_order
      if (body.nonce) {
        await sell_orders_collection.findOneAndUpdate(
          { $and:[ {nonce: body.nonce},{$or:[{current:1},{current:4}]} ] },
          { $set: { current: 6 } },
          { returnDocument: "after" }
        );
        // getting NFT metadata
        const config = {
          method: "get",
          url:
            "https://api.simplehash.com/api/v0/nfts/ethereum/" +
            sell_orders.erc721Token +
            "/" +
            sell_orders.erc721TokenId,
          headers: { "X-API-KEY": SIMPLEHASH_APIKey },
        };
        var token_data = await axios(config);
        // get information for notification
        const expiry_subject = "LISTING EXPIRED";
        const expiry_address = sell_orders.maker;
        const expiry_TokenID = sell_orders.erc721TokenId;
        const expiry_transaction =
          "https://etherscan.io/tx/" + body.transaction_hash;
        var expiry_price =
          parseInt(sell_orders.erc20TokenAmount) +
          parseInt(sell_orders.fees[0].amount);
        // get token symbol
        var token_symbol = await getTokenSynbol(sell_orders.erc20Token);
        if(token_symbol == "ETH" || token_symbol == "WETH" || token_symbol == "DAI"){
          expiry_price = expiry_price / 1000000000000000000;
        } else if(token_symbol == "USDC" || token_symbol == "USDT") {
          expiry_price = expiry_price / 1000000;
        }
        const expiry_content =
          "Offer to sell Color NFT: " +
          expiry_TokenID +
          "<br/><br/>for " +
          expiry_price +
          " " +
          token_symbol +
          " expired";
        const expiry_image = token_data.data.image_url;
        // get knock user data
        var notification_user = {};
        notification_user = await getKnockUser(expiry_address);
        // set notification content variable
        var notification_content = {
          subject: expiry_subject,
          content: expiry_content,
          image: expiry_image,
          expiry: "",
          link: expiry_transaction,
          tokenID: expiry_TokenID
        };
        // send notification
        if (notification_user.user_id != "") {
          await sendNotification(
            "www",
            notification_user.user_id,
            notification_content
          );
          if (notification_user.user_mail != null) {
            await sendNotification(
              "email",
              notification_user.user_id,
              notification_content
            );
          }
        }
      } else {
        throw new UnexpectedError();
      }
      res.status(200).json({ success: true });
    }
  } catch (error) {
    await errorReport("/api/v1/orders/expiry", error.message, req.body);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getNoncelist = async (req, res, next) => {
  try {
    const sell_orders = await sell_orders_collection.aggregate().toArray();
    const buy_orders = await buy_orders_collection.aggregate().toArray();
    var return_val = [];
    for (var i = 0; i < sell_orders.length; i++) {
      return_val.push(sell_orders[i].nonce);
    }
    for (var i = 0; i < buy_orders.length; i++) {
      return_val.push(buy_orders[i].nonce);
    }
    res.json(return_val);
  } catch (error) {
    await errorReport("/api/v1/orders/noncelist", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getSalesOrders = async (req, res, next) => {
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
    res.json(orders);
  } catch (error) {
    await errorReport("/api/v1/orders/sales", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getBidsOrders = async (req, res, next) => {
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
    res.json(orders);
  } catch (error) {
    await errorReport("/api/v1/orders/bids", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getAsksOrders = async (req, res, next) => {
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
        nonce: sell_orders[j].nonce,
        erc20TokenAmount: sell_orders[j].erc20TokenAmount,
        erc20Token: sell_orders[j].erc20Token,
        erc721Token: sell_orders[j].erc721Token,
        erc721TokenProperties: sell_orders[j].erc721TokenProperties,
        erc721TokenId: sell_orders[j].erc721TokenId,
        fee: sell_orders[j].fees[0].amount,
        fees: sell_orders[j].fees[0],
        seller: sell_orders[j].maker,
        txHash: sell_orders[j].makingHash,
        createdAt: sell_orders[j].createdAt,
        expiry: sell_orders[j].expiry,
        signature:sell_orders[j].signature,
        taker: sell_orders[j].taker
      };
      orders.push(sell_order);
    }
    res.json(orders);
  } catch (error) {
    await errorReport("/api/v1/orders/asks", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const maliciousTransaction = async (req, res, next) => {
  try {
    const body = req.body;
    var nonce = "";
    var transactionHash = "";
    var address = "";
    if (body.nonce) nonce = body.nonce;
    if (body.transaction_hash) transactionHash = body.transaction_hash;
    if (body.address) address = body.address;
    res.json({ success: true });
  } catch (error) {
    await errorReport(
      "/api/v1/orders//malicioustransaction",
      error.message,
      req.body
    );
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const isUnconfirmedOrder = async (req, res, next) => {
  try {
    const body = req.body;
    var nonce = "";
    var address = "";
    if (body.nonce) nonce = body.nonce;
    if (body.address) address = body.address;
    var order_data = [];
    const sell_orders = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 0 }],
          },
        },
      ])
      .toArray();
    const buy_orders = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ current: 0 }],
          },
        },
      ])
      .toArray();
    for (var i = 0; i < buy_orders.length; i++) {
      if (buy_orders[i].nonce == nonce) order_data.push(buy_orders[i]);
    }
    for (var i = 0; i < sell_orders.length; i++) {
      if (sell_orders[i].nonce == nonce) order_data.push(sell_orders[i]);
    }
    var status;
    if (order_data.length == 0) {
      status = 3;
    } else if (order_data.length > 0) {
      status = 2;
      for (var i = 0; i < order_data.length; i++) {
        if (order_data[i].maker == address) {
          status = 1;
        }
      }
    }
    res.json(status);
  } catch (error) {
    await errorReport(
      "/api/v1/orders/isunconfirmedorder",
      error.message,
      req.body
    );
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const isConfirmedOrder = async (req, res, next) => {
  try {
    const body = req.body;
    var nonce = "";
    var hash = "";
    if (body.nonce) nonce = body.nonce;
    if (body.transaction_hash) hash = body.transaction_hash;
    var order_data = "";
    const sell_orders = await sell_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ nonce: nonce }, { current: 1 }],
          },
        },
      ])
      .toArray();
    const buy_orders = await buy_orders_collection
      .aggregate([
        {
          $match: {
            $and: [{ nonce: nonce }, { current: 1 }],
          },
        },
      ])
      .toArray();
    for (var i = 0; i < buy_orders.length; i++) {
      if (buy_orders[i].nonce == nonce) order_data = buy_orders[i];
    }
    for (var i = 0; i < sell_orders.length; i++) {
      if (sell_orders[i].nonce == nonce) order_data = sell_orders[i];
    }

    var status = false;
    if (order_data != "") {
      if (order_data.makingHash) {
        if (order_data.makingHash == hash) {
          status = true;
        }
      }
    }
    res.json(status);
  } catch (error) {
    await errorReport(
      "/api/v1/orders/isconfirmedorder",
      error.message,
      req.body
    );
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};


export const getNFTVolume = async (req, res, next) => {
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
      };
      orders.push(buy_order);
    }
    
    res.json(orders);
    
  } catch (error) {
    await errorReport("/api/v1/orders/sales", error.message, {});
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};