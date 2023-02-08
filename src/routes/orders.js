import { Router } from "express";
import {
  getOrders,
  cancelOrder,
  confirmOrder,
  getAvailableOrders,
  expiriedOrder,
  getNoncelist,
  getSalesOrders,
  getBidsOrders,
  getAsksOrders,
  maliciousTransaction,
  isUnconfirmedOrder,
  isConfirmedOrder,
  getNFTVolume,
} from "../controllers/orders.js";
import { addOrderTypeinQuery } from "../middleware/addOrderType.js";

export const ordersRouter = Router();

ordersRouter.get("/", addOrderTypeinQuery, getOrders);
ordersRouter.patch("/cancel", cancelOrder);
ordersRouter.patch("/confirm", confirmOrder);
ordersRouter.get("/available", getAvailableOrders);
ordersRouter.patch("/expiry", expiriedOrder);
ordersRouter.get("/noncelist", getNoncelist);
ordersRouter.get("/sales", getSalesOrders);
ordersRouter.get("/bids", getBidsOrders);
ordersRouter.get("/asks", getAsksOrders);
ordersRouter.patch("/malicioustransaction", maliciousTransaction);
ordersRouter.patch("/isunconfirmedorder", isUnconfirmedOrder);
ordersRouter.patch("/isconfirmedorder", isConfirmedOrder);
ordersRouter.get("/getnftvolume", getNFTVolume);
