const connection = require('./listing');

const createReview = (comment, rating, callback) => {
    const query = 'INSERT INTO Reviews (comment, rating,listing_id ,author_id) VALUES (?, ?,?,?)';
    connection.query(query, [comment, rating ,author_id ], callback);
};



module.exports = {
    createReview,
    
};