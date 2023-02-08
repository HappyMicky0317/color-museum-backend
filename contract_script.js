import 'dotenv/config';
import Web3 from 'web3';
import {
  PROVIDER,
  CLONE_X_ADDRESS,
  DOODLES_ADDRESS,
} from './constants.js';
import { clonex_abi } from './abi/CloneX.js';
import { doodles_abi } from './abi/Doodles.js';

const web3 = new Web3(new Web3.providers.HttpProvider(PROVIDER));
export const clonex_contract = new web3.eth.Contract(clonex_abi, CLONE_X_ADDRESS);

// clonex_contract.methods.totalSupply().call().then((response) => {
//   console.log('total clonex NFTs: ', response);
// }).catch((error) => {
//   console.log(error);
// });

export const doodles_contract = new web3.eth.Contract(doodles_abi, DOODLES_ADDRESS);