const Joi = require('joi');
module.exports.listingSchema = Joi.object({
    //listing : Joi.object({
        title : Joi.string().required(),
        description : Joi.string().required(),
        location : Joi.string().required(),
        category: Joi.string().valid('trending', 'rooms', 'iconic_cities', 'mountain_cities', 'castles', 'amazing_pools', 'camping', 'arctic').required(),
        country : Joi.string().required(),
        price : Joi.number().required().min(0),
        
        //image : Joi.string().required()
    //}).required()
}); 

module.exports.reviewSchema = Joi.object({
    review:Joi.object({
        rating:Joi.number().required().min(1).max(5),
        comment:Joi.string().required()
    })
})
