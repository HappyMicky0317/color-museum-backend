import {
  buy_orders_collection,
  sell_orders_collection,
} from "../app.js";

export const getNonce = async (req, res, next) => {
  try {
    const buy_order_list = await buy_orders_collection.find().sort( { nonce: -1 } ).toArray();
    const max_buy_order = buy_order_list[0];
    const sell_order_list = await sell_orders_collection.find().sort( { nonce: -1 } ).toArray();
    const max_sell_order = sell_order_list[0];
    if(buy_order_list.length != 0 && sell_order_list.length != 0){
      if(max_buy_order.nonce > max_sell_order.nonce) {
        res.status(200).json({
          success: true,
          nonce: max_buy_order.nonce,
        });
      }else{
        res.status(200).json({
          success: true,
          nonce: max_sell_order.nonce,
        });
      }
    }else if (buy_order_list.length == 0 && sell_order_list.length != 0){
      res.status(200).json({
        success: true,
        nonce: max_sell_order.nonce,
      });
    }else if (sell_order_list.length == 0 && buy_order_list.length != 0){
      res.status(200).json({
        success: true,
        nonce: max_buy_order.nonce,
      });
    }else if (sell_order_list.length == 0 && buy_order_list.length == 0){
      res.status(200).json({
        success: true,
        nonce: 1,
      });
    }
  } catch (error) {
    // console.log(error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
