"use strict";

var env = process.env.APP_ENV || "local";

console.log("SETTED => ", env);

if (!env) new Error("NODE_ENV variable should be set");

let config;

config = require("./" + env + ".config.js");

config.env = env;

module.exports = config;
