import { Router } from 'express';
import {
  addOrderType,
  addOrderTypeinQuery,
} from '../middleware/addOrderType.js';
import {
  createOrder,
  getOrders,
  updateCurrentAndHashes,
} from '../controllers/orders.js';
import { validateOrder } from '../middleware/validateOrder.js';

export const buyOrdersRouter = Router();

buyOrdersRouter.post('/', addOrderType, validateOrder, createOrder);
buyOrdersRouter.get('/', addOrderTypeinQuery, getOrders);
buyOrdersRouter.patch('/current', addOrderType, updateCurrentAndHashes);

