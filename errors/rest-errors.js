"use strict"

var Exception = require('../errors/exception-handler');

class ClientErrorException extends Exception {
    constructor(message, cause){
        super(message, cause)
        this.client_error = this.always
    }
}

class ServerErrorException extends Exception {
    constructor(message, cause){
        super(message, cause)
        this.server_error = this.always
    }
}

class NotFoundException extends ClientErrorException {
    constructor(message, cause){
        super(message, cause)
        this.not_found = this.always
    }
}

class BadRequestException extends ClientErrorException {
    constructor(message, cause){
        super(message, cause)
        this.bad_request = this.always
    }
}

class TimeoutException extends Exception {
    constructor(message, cause){
        super(message, cause)
        this.timeout = this.always
    }
}

module.exports = {
    ClientErrorException: ClientErrorException,
    ServerErrorException: ServerErrorException,
    NotFoundException: NotFoundException,
    BadRequestException: BadRequestException,
    TimeoutException: TimeoutException
}