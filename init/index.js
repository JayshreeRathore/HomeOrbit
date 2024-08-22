const mysql = require('mysql');
require('dotenv').config();

const { data: sampleListings } = require('./data.js'); // Import data

//Create a connection to the MySQL database
// const connection = mysql.createConnection({
//     host: 'localhost',
//     user: 'root', // Replace with your MySQL username
//     database: 'Wanderlust', // Replace with your database name
//     password: 'jaya', // Replace with your MySQL password
//     connectTimeout : 30000 ,
// });

const connection = mysql.createConnection({
    host: 'sql12.freesqldatabase.com',
    user: 'sql12726600',
    password: 'IGcskIfJLZ',
    database: 'sql12726600',
    connectTimeout: 30000
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database as ID', connection.threadId);

    // Clear the Reviews and Listings tables
    const clearReviewsTableQuery = 'DELETE FROM Reviews'; // Use DELETE instead of TRUNCATE
    const clearListingsTableQuery = 'DELETE FROM Listings'; // Use DELETE instead of TRUNCATE

    connection.query(clearReviewsTableQuery, (err) => {
        if (err) {
            console.error('Error clearing Reviews table:', err.stack);
            connection.end();
            return;
        }
        console.log('Reviews table cleared');

        connection.query(clearListingsTableQuery, (err) => {
            if (err) {
                console.error('Error clearing Listings table:', err.stack);
                connection.end();
                return;
            }
            console.log('Listings table cleared');

            // Define the fixed owner_id (should match an existing user_id in your database)
             // Example owner_id
            
            // Add owner_id to each listing
            const updatedListings = sampleListings.map((listing) => {
                // Check if geometry and coordinates are defined
                const geometryData = listing.geometry && listing.geometry.coordinates
                    ? JSON.stringify({
                        type: 'Point',
                        coordinates: listing.geometry.coordinates // Using user-provided coordinates
                    })
                    : null; // Handle missing geometry or coordinates
            
                // Return the updated listing with owner_id and geometry
                return {
                    ...listing,
                     // Add the owner_id to each listing
                    geometry: geometryData , // Add the geometry data
                    
                };
            });
            
            

            // Insert data into Listings table
             const insertListingQuery =
                `INSERT INTO Listings (title, description, image, price, location, country, owner_id, geometry,category) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`
            ;

            

            updatedListings.forEach((listing) => {
                // Concatenate the url and filename with a delimiter
                const image = `${listing.image.url}| ${listing.image.filename}`;

                const values = [listing.title, listing.description, image, listing.price, listing.location, listing.country, listing.owner_id,listing.geometry , listing.category];

                connection.query(insertListingQuery, values, (err, results) => {
                    if (err) {
                        console.error('Error inserting listing data:', err.stack);
                        return;
                    }
                    console.log('Inserted listing:', listing.title);
                    console.log('Inserted id:', listing.owner_id);

                    // Insert reviews for the listing
                    const listing_Id = results.insertId;
                    if (listing.reviews && Array.isArray(listing.reviews)) {
                        listing.reviews.forEach((review) => {
                            const insertReviewQuery = 
                                `INSERT INTO Reviews (comment, rating, listing_id, author_id)
                                VALUES (?, ?, ? , ? )`
                            ;
                            const reviewValues = [review.comment, review.rating, listing_Id, review.author_id];

                            connection.query(insertReviewQuery, reviewValues, (err) => {
                                if (err) {
                                    console.error('Error inserting review:', err.stack);
                                    return;
                                }
                                console.log('Inserted review for listing:', listing.title);
                            });
                        });
                    } else {
                        console.log('No reviews to insert for listing:', listing.title);
                    }
                });
            });
        
        });
    });
});



