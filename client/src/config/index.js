const brand = process.env.BRAND || "GERARDFIL".toLowerCase();
let config;

if (window.location.hostname === "localhost") {
  config = require(`./${brand}/local.config.js`);
}

if (window.location.hostname === "www.gerardfilsrl.com.ar") {
  config = require(`./${brand}/dev.config.js`);
}

// if (window.location.hostname === "www.gerardfilsrl.com.ar") {
//   console.log("env prod", brand);
//   config = require(`./${brand}/prod.config.js`);
// }

if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "www.gerardfilsrl.com.ar"
) {
  console.log(config.config);
}

module.exports = config.config;
