"use strict";

var path 			= require('path');
var util 			= require('util');
var rootPath        = path.normalize(__dirname + '/..');
var env             = process.env.APP_ENV || 'dev';

if(!env) new Error("NODE_ENV variable should be set");

const timeoutRatio = 1;
let config;

if(env == "dev"){
	config = require("./"+env+".config.js");
}else{
	config = require("./"+env+".config.js");
}

config = require("./"+env+".config.js");

config.env = env;
module.exports = config.config;
