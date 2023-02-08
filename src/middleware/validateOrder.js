import {
  TakerNotDefinedError,
  TypeIsNotSetError,
  TypeIsUndefinedError,
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
  DoesnotNeedFiled
} from '../helpers/errors.js';
import { checkSum } from '../helpers/checkSum.js';
import { ObjectId } from 'mongodb';
import { web3 } from '../app.js';

export const validateOrder = async (req, res, next) => {
  try {
    const body = req.body;
    
    // Validations

    // Type
    if (!body.type) throw new TypeIsNotSetError();
    if (body.type === 'undefined') throw new TypeIsUndefinedError();

    // Addresses
    if (body.type === 'buy' && !body.taker) throw new TakerNotDefinedError();
    if (body.type === 'sell' && !body.maker) throw new MakerNotDefinedError();
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

    // signature
    if (!body.signature) throw new MissingRequiredFieldError('signature');

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

    next();
  } catch (error) {
    // console.log(error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
