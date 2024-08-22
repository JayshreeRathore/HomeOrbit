const mysql = require('mysql2');

//Create a connection to the database
// const connection = mysql.createConnection({
//     // host: 'localhost',
//     // user: 'root',
//     // database: 'Wanderlust',
//     // password: 'jaya' , // Replace with your MySQL password
//     // connectTimeout : 30000 ,
// });

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectTimeout: 30000
});
// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database as ID', connection.threadId);
 });


// Export the connection object for use in other modules
module.exports = connection;