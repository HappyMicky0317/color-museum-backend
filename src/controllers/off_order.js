import { ObjectId } from "mongodb";
import {
    ERC721OrderFeatureAddress,
    PROVIDER,
    MARKETINGFEE,
    MARKETINGOWNER,
    CHAINID,
    infura_http_provider,
  } from "../constants.js";
  import { ERC721OrderFeatureABI } from "../helpers/ERC721OrdersFeature.js";
  import { checkSum } from '../helpers/checkSum.js';

import {
    TakerNotDefinedError,
    MakerNotDefinedError,
    InvalidAddressError,
    MissingRequiredFieldError,
    InvalidNonceError,
    InvalidErc20TokenAmount,
    InvalidErc20Token,
    InvalidErc721Token,
    InvalidErc721TokenId,
    InvalidExpiry,
    InvalidNftColorId,
    InvalidTransactionHash,
    InvalidMakingHash,
    InvalidAcceptingHash,
    DoesnotNeedFiled,
    InvalidOrder,
    UnexpectedError,
    DirectionIsUndefinedError,
    SignatureFailedError,
    MissingNonceError,
    MissingSignatureError,
    MissingCancelHashError,
    InvalidCancelHash
} from '../helpers/errors.js';

import { buy_orders_collection, sell_orders_collection } from "../app.js";
import Web3 from "web3";
import { ethers } from "ethers";
import { ERC721Order, NFTOrder, SignatureType } from "@0x/protocol-utils";
import { recoverTypedSignature_v4 } from 'eth-sig-util';

var infura_http = new ethers.providers.JsonRpcProvider(infura_http_provider);
var web3 = new Web3(PROVIDER);

const getNonce = async () => {
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
    return max_nonce
}

const checkFee = async (feeData,token_val) => {
    var return_val = false;
    if (feeData.length > 0) {
      var address_state = false;
      var fee_state = false;
      for (var i = 0; i < feeData.length; i++) {
        if (
            feeData[i].recipient.toLowerCase() ==
          MARKETINGOWNER.toLowerCase()
        )
          address_state = true;
        if (
            feeData[i].amount /
            (parseInt(token_val) +
              parseInt(feeData[i].amount)) >
          MARKETINGFEE
        )
          fee_state = true;
      }
      if (address_state == true && fee_state == true) return_val = true;
    }
    return return_val;
}

const checkSignature = async (direction, orderData, signature) => {
    const order = new ERC721Order({
        chainId: CHAINID,
        verifyingContract: '0x0000000000000000000000000000000000000000',
        direction : direction,
        maker : orderData.maker,
        taker : orderData.taker,
        expiry : orderData.expiry,
        nonce : orderData.nonce,
        erc20Token : orderData.erc20Token,
        erc20TokenAmount : orderData.erc20TokenAmount,
        erc721Token : orderData.erc721Token,
        erc721TokenId : orderData.erc721TokenId,
        fees: orderData.fees,
        erc721TokenProperties: orderData.erc721TokenProperties
    });

    const EIP712_DOMAIN_PARAMETERS = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
    ];
  
    const FEE_ABI = [
        { type: 'address', name: 'recipient' },
        { type: 'uint256', name: 'amount' },
        { type: 'bytes', name: 'feeData' },
    ];
  
    const PROPERTY_ABI = [
        { type: 'address', name: 'propertyValidator' },
        { type: 'bytes', name: 'propertyData' },
    ];

    const STRUCT_ABI = [
        { type: 'uint8', name: 'direction' },
        { type: 'address', name: 'maker' },
        { type: 'address', name: 'taker' },
        { type: 'uint256', name: 'expiry' },
        { type: 'uint256', name: 'nonce' },
        { type: 'address', name: 'erc20Token' },
        { type: 'uint256', name: 'erc20TokenAmount' },
        { type: 'Fee[]', name: 'fees' },
        { type: 'address', name: 'erc721Token' },
        { type: 'uint256', name: 'erc721TokenId' },
        { type: 'Property[]', name: 'erc721TokenProperties' },
    ];
    const { domain, message } = order.getEIP712TypedData();
    const types = {
        EIP712Domain : EIP712_DOMAIN_PARAMETERS,
        ['ERC721Order']: STRUCT_ABI,
        ['Fee']: FEE_ABI,
        ['Property']: PROPERTY_ABI,
    };
    var msgParams = JSON.stringify({types, domain, primaryType: 'ERC721Order', message});

    const recovered = recoverTypedSignature_v4({
        data: JSON.parse(msgParams),
        sig: signature,
    });

    return recovered;
}

const checkingHash = async(hash, nonce, ex_topics, ex_abi) => {
    var return_val = {};
    return_val.status = true;
    const receipt = await web3.eth.getTransactionReceipt(hash);
    return_val.from_address = receipt.from;
    if (!receipt.blockNumber) return_val.status = false;
    let tx_receipt = await infura_http.getTransactionReceipt(
        hash
    );
    if (tx_receipt.status != 0) {
        for (var i = 0; i < tx_receipt.logs.length; ++i) {
          if (
            tx_receipt.logs[i].topics == ex_topics
          ) {
            // ERC721OrderFilled : erc721orders that accepted
            let iface = new ethers.utils.Interface(ex_abi);
            let log = iface.parseLog(tx_receipt.logs[i]);
            if (log.args.nonce.toNumber() != nonce) {
                return_val.status = false
            }
            break;
          }
        }
        if (i == tx_receipt.logs.length) {
            return_val.status == false;
        }
    }
    return return_val;
}

export const create = async (req, res) => {
    try{
        const body = req.body;

        // Validations
        // Type
        if (body.direction == null) throw new DirectionIsUndefinedError();

        // Addresses
        if (body.direction == 1 && !body.taker) throw new TakerNotDefinedError();
        if (body.direction == 0 && !body.maker) throw new MakerNotDefinedError();
        if (body.taker && !checkSum(body.taker)) throw new InvalidAddressError('taker');
        if (body.maker && !checkSum(body.maker)) throw new InvalidAddressError('maker');

        // Nonce
        if (body.nonce) throw new DoesnotNeedFiled('nonce');
        if (body.nonce && typeof body.nonce !== 'number') throw new InvalidNonceError();

        // Erc20TokenAmount
        if (!body.erc20TokenAmount) throw new MissingRequiredFieldError('erc20TokenAmount');
        if (body.erc20TokenAmount && typeof body.erc20TokenAmount !== 'string') throw new InvalidErc20TokenAmount();

        // Erc20Token
        if (!body.erc20Token) throw new MissingRequiredFieldError('erc20Token');
        if (body.erc20Token && !checkSum(body.erc20Token)) throw new InvalidErc20Token();

        // Erc721Token
        if (!body.erc721Token) throw new MissingRequiredFieldError('erc721Token');
        if (body.erc721Token && !checkSum(body.erc721Token)) throw new InvalidErc721Token();

        // Erc721TokenId
        if (!body.erc721TokenId) throw new MissingRequiredFieldError('erc721TokenId');
        if (body.erc721TokenId && typeof body.erc721TokenId !== 'number') throw new InvalidErc721TokenId();

        // expiry
        if (!body.expiry) throw new MissingRequiredFieldError('expiry');
        if (body.expiry && (typeof body.expiry !== 'number' || body.expiry < (new Date().getTime() / 1000))) throw new InvalidExpiry();

        // nft_color_id
        if (!body.nft_color_id) throw new MissingRequiredFieldError('nft_color_id');
        if (body.nft_color_id && (typeof body.nft_color_id !== 'string' || !ObjectId.isValid(body.nft_color_id))) throw new InvalidNftColorId();

        // // signature
        // if (!body.signature) throw new MissingRequiredFieldError('signature');

        // transactionHash
        if (body.transactionHash) {
        const receipt = await web3.eth.getTransactionReceipt(body.transactionHash);
        if (!receipt.blockNumber) throw new InvalidTransactionHash();
        }

        // makingHash
        if (body.makingHash) {
        const receipt = await web3.eth.getTransactionReceipt(body.makingHash);
        if (!receipt.blockNumber) throw new InvalidMakingHash();
        }

        // acceptingHash
        if (body.acceptingHash) {
        const receipt = await web3.eth.getTransactionReceipt(body.acceptingHash);
        if (!receipt.blockNumber) throw new InvalidAcceptingHash();
        }

        var max_nonce = await getNonce();
        // get nocne value
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
            ...data
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
        if (data.makingHash) docBody.makingHash = data.makingHash;
        if (data.acceptingHash) docBody.acceptingHash = data.acceptingHash;
        if (data.fees) docBody.fees = data.fees;
        if (data.erc721TokenProperties)
        docBody.erc721TokenProperties = data.erc721TokenProperties;
        if (data.onChain) docBody.onChain = false;
        else docBody.onChain = false;

        docBody.nonce = order_val.nonce;
        docBody.createdAt = new Date();
        docBody.updatedAt = new Date();
        docBody.expiry_date = new Date(expiry * 1000);
        docBody.current = 0;
        // if (docBody.signature.signatureType != 4) throw new SignatureError();
        var feeState = checkFee(req.body.fees, req.body.erc20TokenAmount);
        if (feeState == false) throw new InvalidOrder();

        let createData;
        if (body.direction == 1) {
            createData = await buy_orders_collection.insertOne(docBody);
        } else if (body.direction == 0) {
            createData = await sell_orders_collection.insertOne(docBody);
        }

        if (!createData.acknowledged) throw new UnexpectedError();

        res.status(201).json({
            success: true,
            nonce: docBody.nonce,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        })
    }
}

export const make = async (req, res) => {
    try{
        if (req.body.nonce) {   
            var order_buy = await buy_orders_collection.findOne({
              nonce: req.body.nonce,
            });
            var order_sell = await sell_orders_collection.findOne({
              nonce: req.body.nonce,
            });
        } else {
            throw new MissingNonceError()
        }
        if (order_sell == null && order_buy.length != 0) { // buy order
            if(req.body.signature){
                var checkedAddress = await checkSignature(1,order_buy, req.body.signature)
                if(checkedAddress.toLowerCase() == order_buy.maker.toLowerCase()){
                    const { v, r, s } = ethers.utils.splitSignature(req.body.signature);
                    var signature = {
                        v,
                        r, 
                        s,
                        signatureType: 2
                    };
                    var updateData = {};
                    updateData.current = 1;
                    updateData.signature = signature;
                    if(order_buy.current == 0){
                        await buy_orders_collection.findOneAndUpdate(
                            { nonce: req.body.nonce },
                            { $set: updateData },
                            { returnDocument: "after" }
                        );
                    }
                }else{
                    throw new SignatureFailedError();
                }            
            } else{
                throw new MissingSignatureError()
            } 
        } else if(order_buy == null && order_sell.length != 0) { // sell order
            if(req.body.signature){
                var checkedAddress = await checkSignature(0,order_sell, req.body.signature)
                if(checkedAddress.toLowerCase() == order_sell.maker.toLowerCase()){
                    const { v, r, s } = ethers.utils.splitSignature(req.body.signature);
                    var signature = {
                        v,
                        r, 
                        s,
                        signatureType: 2
                    };
                    var updateData = {};
                    updateData.current = 1;
                    updateData.signature = signature;
                    if(order_sell.current == 0) {
                        await sell_orders_collection.findOneAndUpdate(
                            { nonce: req.body.nonce },
                            { $set: updateData },
                            { returnDocument: "after" }
                        );
                    }
                }else{
                    throw new SignatureFailedError();
                }            
            } else{
                throw new MissingSignatureError()
            } 
        }
        res.json({success:true})
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        })
    }
}

export const accept = async (req, res) => {
    try{
        const body = req.body;
        if (!body.nonce)
            throw new MissingRequiredFieldError("order_id or nonce");

        // nonce
        if (body.nonce && typeof body.nonce !== "number")
            throw new InvalidNonceError();
        
        var ex_topics = "0x50273fa02273cceea9cf085b42de5c8af60624140168bd71357db833535877af"
        var ex_abi = [
            "event ERC721OrderFilled(uint8 direction, address maker, address taker, uint256 nonce, address erc20Token, uint256 erc20TokenAmount, address erc721Token, uint256 erc721TokenId, address matcher)",
          ];
        var checkedHash = await checkingHash(body.acceptingHash, body.nonce,ex_topics, ex_abi)
        if(checkedHash.status == false){
            throw new InvalidAcceptingHash();
        }
        var order_buy;
        var order_sell;
        order_buy = await buy_orders_collection.findOne({nonce: body.nonce,});
        order_sell = await sell_orders_collection.findOne({nonce: body.nonce,});
        var update_val = {};
        update_val.current = 3;
        update_val.acceptingHash = body.acceptingHash;
        update_val.from_address = checkedHash.from_address;
        if (order_sell == null && order_buy.length != 0) { // buy order
            if(order_buy.current == 1 || order_buy.current == 4){
                await buy_orders_collection.findOneAndUpdate(
                    {nonce: body.nonce},
                    {$set: update_val},
                    {returnDocument: "after"}
                )
                // for buy orders
                const other_buyOrders = await buy_orders_collection
                    .aggregate([
                    {
                        $match: {
                        $and: [
                            { erc721Token: order_buy.erc721Token },
                            { erc721TokenId: order_buy.erc721TokenId },
                            { _id: { $ne: new ObjectId(order_buy._id) } },
                            { expiry: { $gt: new Date().getTime() / 1000 } },
                            { current: 1 },
                        ],
                        },
                    },
                    ])
                    .toArray();
                if(other_buyOrders.length !==0) {
                    const ids = [];
                    other_buyOrders.forEach((elem) => {
                        ids.push(new ObjectId(elem._id));
                    });
                    await buy_orders_collection.updateMany(
                        { _id: { $in: ids } },
                        { $set: { current: 4 } },
                        { multi: true }
                    );
                }
                // for sell orders
                const other_sellOrders = await sell_orders_collection
                    .aggregate([
                    {
                        $match: {
                        $and: [
                            { erc721Token: order_buy.erc721Token },
                            { erc721TokenId: order_buy.erc721TokenId },
                            { _id: { $ne: new ObjectId(order_buy._id) } },
                            { expiry: { $gt: new Date().getTime() / 1000 } },
                            { current: 1 }
                        ],
                        },
                    },
                    ])
                    .toArray();
                if(other_sellOrders.length !== 0) {
                    const ids = [];
                    other_sellOrders.forEach((elem) => {
                        ids.push(new ObjectId(elem._id));
                    });
                    await sell_orders_collection.updateMany(
                        { _id: { $in: ids } },
                        { $set: { current: 4 } },
                        { multi: true }
                    );
                }
            }
        } else if(order_buy == null && order_sell.length != 0){ // sell order
            if(order_sell.current == 1 || order_sell.current == 4){
                await sell_orders_collection.findOneAndUpdate(
                    {nonce: body.nonce},
                    {$set: update_val},
                    {returnDocument: "after"}
                )
                // for buy orders
                const other_buyOrders = await buy_orders_collection
                    .aggregate([
                    {
                        $match: {
                        $and: [
                            { erc721Token: order_sell.erc721Token },
                            { erc721TokenId: order_sell.erc721TokenId },
                            { _id: { $ne: new ObjectId(order_sell._id) } },
                            { expiry: { $gt: new Date().getTime() / 1000 } },
                            { current: 1 },
                        ],
                        },
                    },
                    ])
                    .toArray();
                if(other_buyOrders.length !==0) {
                    const ids = [];
                    other_buyOrders.forEach((elem) => {
                        ids.push(new ObjectId(elem._id));
                    });
                    await buy_orders_collection.updateMany(
                        { _id: { $in: ids } },
                        { $set: { current: 4 } },
                        { multi: true }
                    );
                }
                // for sell orders
                const other_sellOrders = await sell_orders_collection
                    .aggregate([
                    {
                        $match: {
                        $and: [
                            { erc721Token: order_sell.erc721Token },
                            { erc721TokenId: order_sell.erc721TokenId },
                            { _id: { $ne: new ObjectId(order_sell._id) } },
                            { expiry: { $gt: new Date().getTime() / 1000 } },
                            { current: 1 }
                        ],
                        },
                    },
                    ])
                    .toArray();
                if(other_sellOrders.length !== 0) {
                    const ids = [];
                    other_sellOrders.forEach((elem) => {
                        ids.push(new ObjectId(elem._id));
                    });
                    await sell_orders_collection.updateMany(
                        { _id: { $in: ids } },
                        { $set: { current: 4 } },
                        { multi: true }
                    );
                }
            }
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(400).json({
            sucess:false,
            error: error.message
        })
    }
}

export const cancel = async (req, res) => {
    try{
        const body = req.body;
        
        if (!body.nonce)
            throw new MissingRequiredFieldError("order_id or nonce");

        // nonce
        if (body.nonce && typeof body.nonce !== "number")
            throw new InvalidNonceError();
        if(!body.cancelHash)
            throw new MissingCancelHashError();
        
        var ex_topics = "0xa015ad2dc32f266993958a0fd9884c746b971b254206f3478bc43e2f125c7b9e";
        var ex_abi = [
            "event ERC721OrderCancelled( address maker, uint256 nonce)",
          ];
        var checkedHash = await checkingHash(body.cancelHash, body.nonce,ex_topics, ex_abi);

        if(checkedHash.status == false){
            throw new InvalidCancelHash();
        }

        var order_buy;
        var order_sell;
        order_buy = await buy_orders_collection.findOne({nonce: body.nonce,});
        order_sell = await sell_orders_collection.findOne({nonce: body.nonce,});
        var update_val = {};
        update_val.current = 5;
        update_val.cancelHash = body.cancelHash;
        if (order_sell == null && order_buy.length != 0) { // buy order
            if(order_buy.current == 1 || order_buy.current == 4){
                await buy_orders_collection.findOneAndUpdate(
                    {nonce: body.nonce},
                    {$set: update_val},
                    {returnDocument: "after"}
                )
            }
        } else if(order_buy == null && order_sell.length != 0){ // sell order
            if(order_sell.current == 1 || order_sell.current == 4){
                await sell_orders_collection.findOneAndUpdate(
                    {nonce: body.nonce},
                    {$set: update_val},
                    {returnDocument: "after"}
                )
            }
        }
        res.status(200).json({ success: true });
    } catch(error){
        res.status(400).json({
            success:false,
            error: error.message
        })
    }
}