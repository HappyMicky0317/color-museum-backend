import { Router } from "express";

import {
    create,
    make,
    accept,
    cancel
} from "../controllers/off_order.js";

export const offOrderRouter = Router();

offOrderRouter.post("/create", create);
offOrderRouter.patch("/make", make);
offOrderRouter.patch("/accept", accept);
offOrderRouter.patch("/cancel", cancel);