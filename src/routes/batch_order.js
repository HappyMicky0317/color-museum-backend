import {Router} from "express";
import {
  accept,
  cancel
} from "../controllers/batch_order.js";

export const batchOrderRouter = Router();

batchOrderRouter.patch('/accept', accept);
batchOrderRouter.patch('/cancel', cancel);