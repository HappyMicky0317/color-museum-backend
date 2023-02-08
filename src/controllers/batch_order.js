import { buy_orders_collection, sell_orders_collection, web3 } from "../app.js";
import { ObjectId } from "mongodb";

import {
  MissingRequiredFieldError,
  InvalidTransaction,
} from "../helpers/errors.js";
import {
  infura_http_provider,
} from "../constants.js";

import { ethers } from "ethers";

var infura_http = new ethers.providers.JsonRpcProvider(infura_http_provider);

const checkAcceptHash = async (hashData) => {
  var nonceData = [];
  let tx_receipt = await infura_http.getTransactionReceipt(hashData);
  var data = tx_receipt;
  if (tx_receipt.status != 0){
    for (var i = 0; i < data.logs.length; ++i) {
      if (
        data.logs[i].topics ==
        "0x50273fa02273cceea9cf085b42de5c8af60624140168bd71357db833535877af"
      ) {
        // ERC721OrderFilled : erc721orders that accepted
        // console.log(data.logs[i]);
        let abi = [
          "event ERC721OrderFilled(uint8 direction, address maker, address taker, uint256 nonce, address erc20Token, uint256 erc20TokenAmount, address erc721Token, uint256 erc721TokenId, address matcher)",
        ];
        let iface = new ethers.utils.Interface(abi);
        let log = iface.parseLog(data.logs[i]);
        var flag = {}
        flag.nonce = log.args.nonce.toNumber();
        flag.from = log.args.taker;
        flag.direction = log.args.direction;
        nonceData.push(flag);
      }
    }
  }
  return nonceData;
}

const checkCancelHash = async(hash) => {
  var return_val = {};
  return_val.flag = true;
  return_val.nonce = [];
  const receipt = await web3.eth.getTransactionReceipt(hash);
  if (!receipt.blockNumber) return_val.flag = false;
  let tx_receipt = await infura_http.getTransactionReceipt(hash);
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
        return_val.nonce.push(log.args.nonce.toNumber());
      }
    }
  }
  return return_val;
}

export const accept = async (req,res) => {
  try{
    var body = req.body;
    if(!body.nonces){
      throw new MissingRequiredFieldError("nonces");    
    }
    if(!body.acceptHash) {
      throw new MissingRequiredFieldError("acceptHash");
    }
    var nonceData = await checkAcceptHash(body.acceptHash);
    var updateVal = {};
    updateVal.current = 3;
    updateVal.acceptingHash = body.acceptHash;
    for(var i = 0; i < nonceData.length; i++){
      var orderToUpdate_sell = await sell_orders_collection.findOne({
        nonce: nonceData[i].nonce,
      });
      if(orderToUpdate_sell){
        if(orderToUpdate_sell.current == 1 || orderToUpdate_sell.current == 4){
          updateVal.from_address = nonceData[i].from;
          await sell_orders_collection.findOneAndUpdate(
            { nonce: body.nonce },
            { $set: updateVal },
            { returnDocument: "after" }
          );
          // perform an update if the current is being set to 3
          if (orderToUpdate_sell && orderToUpdate_sell._id) {
            const orders = await buy_orders_collection
              .aggregate([
                {
                  $match: {
                    $and: [
                      { erc721Token: orderToUpdate_sell.erc721Token },
                      { erc721TokenId: orderToUpdate_sell.erc721TokenId },
                      { _id: { $ne: new ObjectId(orderToUpdate_sell._id) } },
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
          }
          // update current for sell orders when buy order accept
          const orders_sell = await sell_orders_collection
            .aggregate([
              {
                $match: {
                  $and: [
                    { erc721Token: orderToUpdate_sell.erc721Token },
                    { erc721TokenId: orderToUpdate_sell.erc721TokenId },
                    { _id: { $ne: new ObjectId(orderToUpdate_sell._id) } },
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
        }
      }
    }
    res.json({success:true}) 
  } catch(error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

export const cancel = async (req, res) => {
  try{
    if(!req.body.cancelHash){
      throw new MissingRequiredFieldError("cancelHash");    
    }
    var cancelHash = req.body.cancelHash;
    var checkedHash = await checkCancelHash(cancelHash);
    if(checkedHash.flag == false){
      throw new InvalidTransaction();
    }
    var update_val = {};
    update_val.cancelHash = cancelHash;
    update_val.current = 5;
    if(checkedHash.nonce.length != 0){
      for(var i = 0; i < checkedHash.nonce.length ; i++){
        var nonce_val = checkedHash.nonce[i];
        var order_buy = await buy_orders_collection.findOne({
          nonce: nonce_val,
        });
        var order_sell = await sell_orders_collection.findOne({
          nonce: nonce_val,
        });
        if (order_sell == null && order_buy.length != 0) {
          if(order_buy.current == 1 || order_buy.current == 4){
            await buy_orders_collection.findOneAndUpdate(
              { nonce: nonce_val },
              { $set: update_val },
              { returnDocument: "after" }
            );
          }
        } else if(order_buy == null && order_sell.length != 0) {
          if(order_sell.current == 1 || order_sell.current == 4){
            await sell_orders_collection.findOneAndUpdate(
              { nonce: nonce_val },
              { $set: update_val },
              { returnDocument: "after" }
            );
          }
        }
      }
    }
    res.json({success:true});    
  } catch(error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}