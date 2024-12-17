"use strict"

var Q             = require("q"),
    logger        = require('../utils/logger'),
    restConnector = require('restler'),
    NodeCache     = require("node-cache"),
    cache         = new NodeCache(),
    rest_errors   = require('../errors/rest-errors'),
    Exception     = require('../errors/exception-handler'),
    self          = {};

var configTimeout = 6000;
Q.longStackSupport = true;

self.get = function(url, options) {
    var deferred = Q.defer();
    let opts = (options||{})
    opts.timeout = opts.timeout || configTimeout
    restConnector.get(url, opts)
        .on('success', (response) => {
            deferred.resolve(response);
        })
        .on('fail', (err, response) => {deferred.reject(new rest_errors.ServerErrorException(`GET [${url}] -> Failed[${response.statusCode}]`, err))})
        .on('error', (err) => {deferred.reject(new rest_errors.ClientErrorException(`GET [${url}]`, err)) } )
        .on('timeout', (err) => {deferred.reject(new rest_errors.TimeoutException(`GET [${url}] -> Timeout[${err}]`, err)) } )

    return deferred.promise;
};


self.getWithError = function(url, options) {
    var deferred = Q.defer();
    let opts = (options||{})
    opts.timeout = opts.timeout || configTimeout
    restConnector.get(url, opts)
        .on('success', (response) => {
            deferred.resolve(response);
        })
        .on('fail', (err, response) => {
            if(response.statusCode == 404){
                deferred.reject(new rest_errors.NotFoundException(`GET [${url}] -> Failed[${response.statusCode}]`, err))
            }else{
                deferred.reject(new rest_errors.ServerErrorException(`GET [${url}] -> Failed[${response.statusCode}]`, err))
            }
        })
        .on('error', (err) => {deferred.reject(new rest_errors.ClientErrorException(`GET [${url}]`, err)) } )
        .on('timeout', (err) => {deferred.reject(new rest_errors.TimeoutException(`GET [${url}] -> Timeout[${err}]`, err)) } )

    return deferred.promise;
};

self.getCached = function (url, ttl, options) {
    ttl = ttl || 1;

    var deferred = Q.defer();

    cache.get( url, function( err, value ){

        if ( !err && value != undefined ){
            logger.info( "Found in cache ", url );
            return deferred.resolve(value);
        }else{
            logger.info( "Not found in cache", url );
            cache.get('L2:' + url, function(err, value){

                //TODO Pensar bien esto
                try{
                    let freshValue = self.get(url, options).tap(function(value){
                        cache.set(url, value, ttl);
                        cache.set('L2:' + url, value);
                    })

                    if (!err && value != undefined){
                        logger.info('Found in cache L2', url)
                        deferred.resolve(value)
                    }else{
                        deferred.resolve(freshValue)
                    }
                } catch(err){
                    deferred.reject( new Exception('GET cached ['+url+']', err) )
                }
            })
        }
    });
    return deferred.promise;
}

self.getWithOptions = function(url, options) {
    var deferred = Q.defer();

    restConnector.get(url, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject( new rest_errors.ServerErrorException(`GET [${url}] fail [${response.statusCode}]`, err) ) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`GET [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`GET [${url}]`, err)) )

    return deferred.promise;
};

self.getWithHeaders = function(url, headers) {

    let deferred = Q.defer();
    let options = { timeout: configTimeout, headers: headers};

    restConnector.get(url, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject( new rest_errors.ServerErrorException(`GET [${url}] fail [${response.statusCode}]`, err) ) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`GET [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`GET [${url}]`, err)) )

    return deferred.promise;
};

self.put = function(url, headers) {
    var deferred = Q.defer();
    restConnector.put(url, {timeout: configTimeout, headers: headers})
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject(new rest_errors.ServerErrorException(`PUT [${url}] fail [${response.statusCode}]`, err)) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`PUT [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`PUT [${url}]`, err)) )

    return deferred.promise;
};

self.putWithOptions = function (url, options) {

    /*
     Options is an object being passed to put method. to see full documentation
     check it here: https://www.npmjs.com/package/restler
     */

    var deferred = Q.defer();

    options.timeout = options.timeout || configTimeout;

    logger.info('info', 'Put options', options);

    restConnector.put(url, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject(new rest_errors.ServerErrorException(`PUT [${url}] fail [${response.statusCode}]`, err)) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`PUT [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`PUT [${url}]`, err)) )

    return deferred.promise;
}

self.post = function (url, options) {

    /*
     Options is an object being passed to put method. to see full documentation
     check it here: https://www.npmjs.com/package/restler
     */

    var deferred = Q.defer();

    options.timeout = options.timeout || configTimeout;

    logger.info('info', 'POST options', options);

    restConnector.post(url, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject(new rest_errors.ServerErrorException(`POST [${url}] fail [${response.statusCode}]`, err)) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`POST [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`POST [${url}]`, err)) )

    return deferred.promise;
}

self.postJson = function (url, data) {

    /*
     Options is an object being passed to put method. to see full documentation
     check it here: https://www.npmjs.com/package/restler
     */

    var deferred = Q.defer();

    let options = { timeout: configTimeout};

    logger.info('info', 'POST options', options);

    restConnector.postJson(url, data, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject(new rest_errors.ServerErrorException(`POST [${url}] fail [${response.statusCode}]`, err)) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`POST [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`POST [${url}]`, err)) )

    return deferred.promise;
}

self.postWithoutErrors = function (url, options) {

    /*
     Options is an object being passed to put method. to see full documentation
     check it here: https://www.npmjs.com/package/restler
     */

    var deferred = Q.defer();

    options.timeout = options.timeout || configTimeout;

    logger.info('info', 'POST options', options);

    restConnector.post(url, options)
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err) => deferred.reject({type: "render", error: err, message: 'POST [' + url + '] fail -> ' + JSON.stringify(err)}))
        .on('error', (err) => deferred.reject({type: "error", error: err, message: 'POST [' + url + '] internal error -> ' + JSON.stringify(err)}))
        .on('timeout', (err) =>  deferred.reject({type: "error", error: err, message: 'POST [' + url + '] timeout -> ' + JSON.stringify(err)}));

    return deferred.promise;
}

self.delete = function(url, headers) {
    var deferred = Q.defer();
    restConnector.del(url, {timeout: configTimeout, headers: headers})
        .on('success', (response) => deferred.resolve(response))
        .on('fail', (err, response) => deferred.reject(new rest_errors.ServerErrorException(`DELETE [${url}] fail [${response.statusCode}]`, err)) )
        .on('error', (err) => deferred.reject(new rest_errors.ClientErrorException(`DELETE [${url}]`, err)) )
        .on('timeout', (err) =>  deferred.reject(new rest_errors.TimeoutException(`DELETE [${url}]`, err)) )

    return deferred.promise;
};

module.exports = self;