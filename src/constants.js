export const DB_URI = process.env.DB_URI;
export const PROVIDER = process.env.PROVIDER;
export const SERVER_MODE = process.env.REAL_MODE;
export const PORT = process.env.PORT;
export const SOCKET_PORT = process.env.SOCKET_PORT || 80;
export const WEBSOCKETPORT = process.env.WEBSOCKETPORT;
export const CLONE_X_ADDRESS = "0x49cF6f5d44E70224e2E23fDcdd2C053F30aDA28B";
export const LIMIT_SIZE = 20;
export const MAX_LIMIT = 50;
export const supabaseUrl = "https://yrjjxjedmscqqzxoxgpk.supabase.co";
export const supabaseCanon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyamp4amVkbXNjcXF6eG94Z3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTAzOTE0MzksImV4cCI6MTk2NTk2NzQzOX0.ooQ9TOcfYe_rbbVrD-L-uVrDaIaS70EGVPpWdlr3w7w";
export const SIMPLEHASH_APIKey = "color_sk_roug528be14nyfp8";
export var REAL_MODE = process.env.REAL_MODE == "1" ? true : false;
export var infura_http_provider = REAL_MODE
  ? process.env.RPC_URL
  : process.env.RPC_URL_TEST;
export const ERC721OrderFeatureAddress = REAL_MODE
  ? "0x8b56607D0635b1B0C36ba1786b028200f1D68767"
  : "0x90A675840686A6e92DB656CEef474E770b7be76A";
export const MARKETINGFEE = 0.025;
export const MARKETINGOWNER = "0x0148bE2b36E7Ff2F86E2b6c41554379921312902";
export const SLACKWEBHOOKURL = "https://hooks.slack.com/services/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";
export const CHAINID = REAL_MODE ? 1 : 3;
export const knockAPIKey = REAL_MODE
  ? process.env.KNOCK_PRODUCTION_SECRETKEY
  : process.env.KNOCK_DEVELOPMENT_SECRETKEY;
export const DISCORDWEBHOOK = process.env.DISCORDWEBHOOK;
export const MORALISAPIKEY = process.env.MORALISAPIKEY;