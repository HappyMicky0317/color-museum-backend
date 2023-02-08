import { Router } from "express";

import { getNonce
} from "../controllers/nonce.js";

export const nonceRouter = Router();

nonceRouter.get('/', getNonce);