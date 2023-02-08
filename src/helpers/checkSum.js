import { web3 } from "../app.js";

export const checkSum = (address) => {
  return web3.utils.isAddress(address);
}