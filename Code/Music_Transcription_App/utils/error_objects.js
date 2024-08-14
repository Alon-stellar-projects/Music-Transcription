/**
 * Author: Alon Haviv, Stellar Intelligence.
 * */

/**
 * This class represents an error that describes a spawned Python process failure.
 * */
class SpawnProcessError {
    /**
     * A constructor.
     * @param {number} code - A code from Consts.json.
     * @param {string} message - An optional message. Default value is: ''.
     */
    constructor(code, message = '') {
        this.code = code;
        this.message = message;
    }
}

// Export the classes:
module.exports = {
    SpawnProcessError: SpawnProcessError
};