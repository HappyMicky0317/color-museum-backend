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

export const sellOrdersRouter = Router();

sellOrdersRouter.post('/', addOrderType, validateOrder, createOrder);
sellOrdersRouter.get('/', addOrderTypeinQuery, getOrders);
sellOrdersRouter.patch('/current', addOrderType, updateCurrentAndHashes);
