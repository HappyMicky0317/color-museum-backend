import { Router } from 'express';
import { 
    authentication,
    tokenPrice
} from '../controllers/others.js';
// import { addOrderTypeinQuery } from '../middleware/addOrderType.js';

export const otherRouter = Router();

// ordersRouter.get('/', addOrderTypeinQuery, getOrders);
otherRouter.patch('/', authentication);
otherRouter.get('/tokenPrice', tokenPrice);
