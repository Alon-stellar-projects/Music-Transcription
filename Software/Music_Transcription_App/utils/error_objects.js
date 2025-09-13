/**
 * Author: Alon Haviv, Stellar Intelligence.
 * 
 * A module for error handler classes.
 * */

/**
 * This base class represents a general error. Other error-classes will extend it.
 * */
class BaseError {
    /**
     * A constructor.
     * @param {number} code - A code from Consts.json.
     * @param {string} message - An optional message. Default value is: ''.
     */
    constructor(code, message = '') {
        this.code = code;
        this.message = message;
    }

    /**
     * Implementing the toString() method.
     * */
    toString() {
        return `${this.constructor.name} Error code: ${this.code}: ${this.message}`
    }
}

/**
 * This class represents an error that describes a spawned Python process failure.
 * */
class SpawnProcessError extends BaseError {
    /**
     * A constructor.
     * @param {number} code - A code from Consts.json.
     * @param {string} message - An optional message. Default value is: ''.
     */
    constructor(code, message = '') {
        super(code, message);
    }
}

/**
 * This class represents an error that describes system operations failure (s.a. saving files).
 * */
class SystemError extends BaseError {
    /**
     * A constructor.
     * @param {number} code - A code from Consts.json.
     * @param {string} message - An optional message. Default value is: ''.
     */
    constructor(code, message = '') {
        super(code, message);
    }
}

// Export the classes:
module.exports = {
    BaseError: BaseError,
    SpawnProcessError: SpawnProcessError,
    SystemError: SystemError
};