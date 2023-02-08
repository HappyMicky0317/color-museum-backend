import { Router } from 'express';

import { getData } from '../controllers/color_data.js';

export const colorDataRouter = Router();

colorDataRouter.get('/', getData);