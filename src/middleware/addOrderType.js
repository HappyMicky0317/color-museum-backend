export const addOrderType = async (req, res, next) => {
  try {
    const elements = req.originalUrl.split('/');
    if (elements.includes('buy_orders')) {
      req.body.type = 'buy';
    } else if (elements.includes('sell_orders')) {
      req.body.type = 'sell';
    } else {
      req.body.type = 'undefined';
    }
    next();
  } catch (error) {
    // console.log(error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

export const addOrderTypeinQuery = async (req, res, next) => {
  try {
    const elements = req.originalUrl.split('/');
    // console.log(elements);
    if (elements[elements.length - 1].includes('buy_orders')) {
      req.query.type = 'buy';
    } else if (elements[elements.length - 1].includes('sell_orders')) {
      req.query.type = 'sell';
    } else if (elements[elements.length - 1].includes('orders')) {
      req.query.type = 'both';
    } else {
      req.query.type = 'undefined';
    }
    next();
  } catch (error) {
    // console.log(error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
