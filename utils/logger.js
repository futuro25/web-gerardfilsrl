"use strict"

var winston = require('winston');

var consoleTransport = new winston.transports.Console();

var logTransports = [consoleTransport];

// var logger = new winston.Logger({
//   level: 'info',
//   transports: logTransports,
//   exitOnError : false
// });

let logger = winston.createLogger({
  transports: [
    new (winston.transports.Console)(console)
  ],
  exitOnError: false, // do not exit on handled exceptions
});


module.exports = logger;