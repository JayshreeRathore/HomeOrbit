class ExpressError extends Error {
    constructor(statusCode , meesage){
        super();
        this.statusCode = statusCode;
        this.message = meesage;
    }
}
module.exports = ExpressError;