const mysql = require('mysql2');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const LocalStrategy = require('passport-local').Strategy;

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectTimeout: 30000
});


// Serialize and deserialize user
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    connection.query('SELECT * FROM Users WHERE id = ?', [id], (err, results) => {
        if (err) {
            return done(err);
        }
        done(null, results[0]);
    });
});

// Local strategy
passport.use(new LocalStrategy(
    { usernameField: 'email' },  // Make sure this matches your form field
    (email, password, done) => {
        console.log("Login attemps : ",{ email, password })
        connection.query('SELECT * FROM Users WHERE email = ?', [email], (err, results) => {
            if (err) {
                return done(err);
            }
            if (results.length === 0) {
                console.log("no user found");
                return done(null, false, { message: 'Incorrect email.' });
            }
            const user = results[0];
            bcrypt.compare(password, user.password_hash, (err, isMatch) => {
                if (err) {
                    return done(err);
                }
                if (isMatch) {
                    console.log("password match");
                    return done(null, user);
                } else {
                    console.log("password  not match");
                    return done(null, false, { message: 'Incorrect password.' });
                }
            });
        });
    }
));

// Register a new user with validation
const registerUser = (email, username, password, callback) => {
    // Check if email or username already exists
    const checkQuery = 'SELECT * FROM Users WHERE email = ? OR username = ?';
    connection.query(checkQuery, [email, username], (err, results) => {
        if (err) {
            return callback(err);
        }
        if (results.length > 0) {
            return callback(new Error('Email or Username already exists'));
        }

        // Hash the password
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return callback(err);
            }

            // Proceed with registration
            const query = 'INSERT INTO Users (email, username, password_hash) VALUES (?, ?, ?)';
            connection.query(query, [email, username, hash], (err, results) => {
                if (err) {
                    return callback(err);
                }
                console.log(`Email: ${email}, Username: ${username}, Password Hash: ${hash}`);
                callback(null, results);
            });
        });
    });
};

module.exports = {
    registerUser
};