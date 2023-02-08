import jwt from "jsonwebtoken";
import { tokenPrice_collection } from "../app.js";
  export const authentication = async (req, res, next) => {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        var jwtToken = jwt.sign(
            {
              // knock user ID
              sub: req.body.user_id,
              iat: currentTime,
              exp: currentTime + 60 * 60 * 5, // 5 hour from now
            },

            `-----BEGIN RSA PRIVATE KEY-----\n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\n-----END RSA PRIVATE KEY-----`,


            {
              algorithm: "RS256",
            },
          );
      res.json(jwtToken)
    } catch (error) {
      // console.log(error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  export const tokenPrice = async (req, res) => {
    try{
      var priceData = await tokenPrice_collection.findOne({ USD: {$ne:'a'} });
      res.json({"USD":priceData.USD})
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
  