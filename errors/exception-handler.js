"use strict"

class Exception extends Error {
	constructor (message, cause){
		super(message);
		this.cause = cause || {};
		this.other = this.always;
	}

	catch (errorFunction, treatment) {
		if(this[errorFunction]){
			return this[errorFunction](treatment)
		}else{
			return this
		}
	}

	always (treatment) {
		treatment(this);
		this.other = function() {return this};
		return this;		
	}

	get stack() {
		return super.stack + '\nCaused By: \n' + this.cause.stack;
	}
}

module.exports = Exception;
