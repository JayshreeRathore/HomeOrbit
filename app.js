if(process.env.NODE_ENV != "production"){
  require('dotenv').config();
}
//console.log(process.env.SECRET) // remove this after you've confirmed it is working


const express = require('express');
//const mysql = require('mysql2');
const app = express();
const db = require("./models/listing.js");
const data = require("./init/data");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const {listingSchema,reviewSchema} = require("./schema.js");
const { el } = require('@faker-js/faker');
const { createReviewsTable, insertReview } = require("./models/review.js"); // Import review functions
//const Review = require("./models/review.js");
//const listing = require("./init/index.js");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require('passport');
const { registerUser } = require('./models/user.js'); // assuming the above code is in userModel.js
const LocalStrategy = require('passport-Local').Strategy;
const bcrypt = require('bcryptjs');
const { isLoggedIn , saveRedirectUrl , isOwner } = require('./middleware.js');
const multer  = require('multer');
const {storage} = require("./cloudConfig.js");


const upload = multer({storage});  

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });








app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true}));
app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,"/public")));
app.use(cookieParser());
const sessionOptions = {
  secret : process.env.SECRET,
resave:false,
saveUninitialized:true,
cookie : {
  expires : Date.now()+100*60*60*24*3, //millisecond so add this no. one week to stre this cookie
  maxAge : 100*60*60*24*3 ,
  httpsOnly : true
}
};
app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next) =>{
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;  // user ki emailid,password for navbar
  console.log(res.locals.success);
  console.log(res.locals.error);

  next();
});





const validateListing = (req,res,next) => {
  let {error }= listingSchema.validate(req.body);
  if(error){
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400,errMsg);
  }else{
        next();
  }
};

const validReview = (req,res,next) => {
  let {error }= reviewSchema.validate(req.body);
  if(error){
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400,errMsg);
  }else{
        next();
  }
};




//Index Route
app.get("/listings",(req,res) => {
  let q = `select * from Listings`;
  try{
   db.query(q,(err,result) => {
     if(err)throw err;
     let allListing = result;
     //console.log(data);
     res.render("listings/index.ejs", {allListing});
   });
  }
  catch(err){
    console.log(err);
   res.send("some error occured");
  }
 });



//New Route------------------------------------------
app.get("/listings/new",isLoggedIn,async(req,res) => {
  res.render("listings/new.ejs");
})

//create route----------------------------------------
app.post('/listings', isLoggedIn, upload.single('image'), async (req, res) => {
  try {
      // Geocode the location to get coordinates
      let response = await geocodingClient.forwardGeocode({
          query: req.body.location,
          limit: 1,
      }).send();

      // Extract geometry from response
      const geometry = response.body.features[0].geometry;

      // Validate the request body
      let result = listingSchema.validate(req.body);
      if (result.error) {
          throw new ExpressError(400, result.error.details[0].message);
      }

      // Destructure request body
      const { title, description, price, location, country, category } = req.body;
      const owner_id = req.user.id;
 console.log(owner_id);
      // Handle file upload
      const url = req.file.path;
      const filename = req.file.filename;
      const image = `${url}|${filename}`;

      // Format geometryData as POINT
      const longitude = geometry.coordinates[0];
      const latitude = geometry.coordinates[1];
      const geometryData = `POINT(${longitude} ${latitude})`;

      // Prepare SQL insert 
      const insertQuery = 
          `INSERT INTO Listings (title, description, image, price, location, country, owner_id, geometry, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, GeomFromText(?), ?)`
      ;

      const values = [title, description, image, price, location, country, owner_id, geometryData, category];

      // Execute SQL query
      db.query(insertQuery, values, (err, results) => {
          if (err) {
              console.error('Error inserting data:', err.stack);
              res.status(500).send('Error inserting data');
              return;
          }

          req.flash("success", "New Listing Created");
          res.redirect('/listings');
      });

  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
  }
});



//show Route-----------------------------------
app.get("/listings/:id", (req, res) => {
  const { id } = req.params;

  const listingQuery = `
      SELECT Listings.*, Users.username AS owner_username, Users.id AS owner_id 
      FROM Listings 
      LEFT JOIN Users ON Listings.owner_id = Users.id 
      WHERE Listings.id = ?`;

  const reviewsQuery = `
      SELECT Reviews.*, Users.username AS reviewer_username
      FROM Reviews
      JOIN Users ON Reviews.author_id = Users.id
      WHERE Reviews.listing_id = ?`;

  db.query(listingQuery, [id], (err, listingResults) => {
      if (err) {
          console.error('Error fetching listing:', err);
          return res.status(500).send('Error fetching listing: ' + err.message);
      }

      console.log('Listing Results:', listingResults);

      if (listingResults.length === 0) {
          return res.status(404).send('Listing not found');
      }

      const listing = listingResults[0];
      listing.owner = {
          id: listing.owner_id,
          username: listing.owner_username
      };

      db.query(reviewsQuery, [id], (err, reviewResults) => {
          if (err) {
              console.error('Error fetching reviews:', err);
              return res.status(500).send('Error fetching reviews: ' + err.message);
          }

          console.log('Review Results:', reviewResults);

          const reviews = reviewResults.map(review => ({
              ...review,
              author: {
                  username: review.reviewer_username
              }
          }));

          let coordinatesArray = null;

          if (listing.geometry && typeof listing.geometry === 'object' && 'x' in listing.geometry && 'y' in listing.geometry) {
              coordinatesArray = [listing.geometry.x, listing.geometry.y];
          } else {
              console.error('Geometry object does not have the expected "x" and "y" properties:', listing.geometry);
          }

          const mapCoordinates = coordinatesArray || [0, 0];

          console.log('Listing:', listing);
          console.log('Reviews:', reviews);
          console.log('Map Coordinates:', mapCoordinates);

          return res.render("listings/show.ejs", {
              listing,
              reviews,
              mapCoordinates,
              currUser: req.user
          });
      });
  });
});


//edit
app.get("/listings/:id/edit",isLoggedIn,(req,res) => {
  // const url = req.file.path;
  // const filename = req.file.filename;
  
  const { id } = req.params;
  const q = `SELECT * FROM Listings WHERE id = '${ id }'`;
  const currUser = req.user; // Assuming req.user holds the current logged-in user
  
  // Fetch the listing to verify ownership
  const fetchListingQuery = 'SELECT * FROM Listings WHERE id = ?';
  
  db.query(fetchListingQuery, [id], (err, listingResults) => {
    if (err) {
      console.error('Error fetching listing:', err.stack);
      res.status(500).send('Error fetching listing');
      return;
    }

    if (listingResults.length === 0) {
      req.flash("error", "Listing not found");
      res.redirect(`/listings/${id}`);
      return;
    }

    const listing = listingResults[0];

    if (listing.owner_id !== currUser.id) {
      req.flash("error", "You are not the owner of this listing");
      res.redirect(`/listings/${id}`);
      return;
    }
  });



  try {
    db.query(q, [id], (err, result) => {
      if (err) throw err;
      if (result.length === 0) {
        res.send("Listing not found");
      }
      
      else {
        const listing = result[0];
        //res.send("good");
        // console.log(id);
        // console.log(listing);
        if(!listing){
          req.flash("error","Listing you requested does not exit");
          res.redirect("/listings");
        }
        let originalImageUrl  = null;
        if (listing.image.split('|') && listing.image.split('|')[0]) {
           originalImageUrl = listing.image.split('|')[0];
          originalImageUrl  = originalImageUrl.replace("/upload", "/upload/w_250");
      }
        res.render("listings/edit.ejs", { listing , originalImageUrl });
      }
    });
  } catch (err) {
    console.log(err);
    res.send("Some error occurred");
  }
});


//update Route-----------------------------------------------
app.put('/listings/:id', isLoggedIn, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, description, price, location, country, category } = req.body;
  const currUser = req.user;

  // Fetch the listing to verify ownership
  const fetchListingQuery = 'SELECT * FROM Listings WHERE id = ?';

  db.query(fetchListingQuery, [id], async (err, listingResults) => {
    if (err) {
      console.error('Error fetching listing:', err.stack);
      res.status(500).send('Error fetching listing');
      return;
    }

    if (listingResults.length === 0) {
      req.flash('error', 'Listing not found');
      res.redirect(`/listings/${id}`);
      return;
    }

    const listing = listingResults[0];

    if (listing.owner_id !== currUser.id) {
      req.flash('error', 'You are not the owner of this listing');
      res.redirect(`/listings/${id}`);
      return;
    }

    // Handle image update
    let image = listing.image;
    if (req.file) {
      const url = req.file.path;
      const filename = req.file.filename;
      image = `${url}|${filename}`;
    }

    try {
      // Geocode the location to get coordinates
      const response = await geocodingClient.forwardGeocode({
        query: location, // Use the location from the request body
        limit: 1,
      }).send();

      const geometry = response.body.features[0].geometry;
      const geometryData = `POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;

      // Update the listing
      const updateQuery = `
        UPDATE Listings
        SET title = ?, description = ?, image = ?, price = ?, location = ?, country = ?, geometry = GeomFromText(?), category = ?
        WHERE id = ?`;

      const values = [title, description, image, price, location, country, geometryData, category, id];

      db.query(updateQuery, values, (err, result) => {
        if (err) {
          console.error('Error updating data:', err.stack);
          res.status(500).send('Error updating data');
          return;
        }

        req.flash('success', 'Listing updated');
        res.redirect(`/listings/${id}`);
      });
    } catch (geocodeErr) {
      console.error('Error geocoding location:', geocodeErr.stack);
      res.status(500).send('Error geocoding location');
    }
  });
});



//delete
app.delete("/listings/:id",isLoggedIn,(req, res) => {
  const { id } = req.params;
  const q = 'DELETE FROM Listings WHERE id = ?';
  
  const currUser = req.user; // Assuming req.user holds the current logged-in user
  
  // Fetch the listing to verify ownership
  const fetchListingQuery = 'SELECT * FROM Listings WHERE id = ?';
  
  db.query(fetchListingQuery, [id], (err, listingResults) => {
    if (err) {
      console.error('Error fetching listing:', err.stack);
      res.status(500).send('Error fetching listing');
      return;
    }

    if (listingResults.length === 0) {
      req.flash("error", "Listing not found");
      res.redirect(`/listings/${id}`);
      return;
    }

    const listing = listingResults[0];

    if (listing.owner_id !== currUser.id) {
      req.flash("error", "You are not the owner of this listing");
      res.redirect(`/listings/${id}`);
      return;
    }
  });


  db.query(q, [id], (err, result) => {
    if (err) {
      console.error('Error deleting data:', err.stack);
      res.status(500).send('Error deleting data');
      return;
    }
    if (result.affectedRows === 0) {
      res.send("Listing not found");
    } else {
      req.flash("error","Listing is Deleted");
      res.redirect('/listings');
    }
  });
});



//Create Review Route

app.post('/listings/:id/review', validReview,isLoggedIn, wrapAsync(async(req, res) => {
  const listing_id = req.params.id;
  const { comment, rating } = req.body.review;

  // Step 1: Check if the listing exists
  const listingQuery = 'SELECT * FROM Listings WHERE id = ?';
  db.query(listingQuery, [listing_id], (err, listingResults) => {
      if (err) {
          console.error('Error fetching listing:', err);
          res.status(500).send('Error fetching listing');
          return;
      }

      if (listingResults.length === 0) {
          res.status(404).send('Listing not found');
          return;
      }

      // Step 2: Insert the new review into the Reviews table
      const insertReviewQuery = `
          INSERT INTO Reviews (comment, rating,listing_id, author_id)
          VALUES (?, ?, ?, ?)
      `;
      author_id = req.user.id;
      const reviewValues = [comment, rating,listing_id,author_id];
      
      console.log(reviewValues);

      db.query(insertReviewQuery, reviewValues, (err, reviewResults) => {
          if (err) {
              console.error('Error inserting review:', err);
              res.status(500).send('Error inserting review');
              return; 
          }
          
          // Step 3: Redirect to the listing page
          req.flash("success","Created New Review");
          res.redirect(`/listings/${req.params.id}`);
      });
  });
}));


// Delete Reviewa----------------------

app.delete('/listings/:listingId/reviews/:reviewId', (req, res) => {
  const { listingId, reviewId } = req.params;
  const currUser = req.user; // Assuming req.user holds the current logged-in user
  
  // Fetch the review to verify ownership
  const fetchReviewQuery = 'SELECT * FROM Reviews WHERE id = ?';
  
  db.query(fetchReviewQuery, [reviewId], (err, reviewResults) => {
    if (err) {
      console.error('Error fetching review:', err.stack);
      return res.status(500).send('Error fetching review');
    }

    if (reviewResults.length === 0) {
      req.flash("error", "Review not found");
      return res.redirect(`/listings/${listingId}`);
    }

    const review = reviewResults[0];

    if (review.author_id !== currUser.id) {
      req.flash("error", "You are not the author of this review");
      return res.redirect(`/listings/${listingId}`);
    }

    // If the user is the author, delete the review
    const deleteReviewQuery = 'DELETE FROM Reviews WHERE id = ? AND listing_id = ?';
    db.query(deleteReviewQuery, [reviewId, listingId], (err, result) => {
      if (err) {
        console.error('Error deleting review:', err);
        return res.status(500).send('Error deleting review');
      }

      req.flash("success", "Review Deleted");
      return res.redirect(`/listings/${listingId}`);
    });
  });
});


//signup page-----------------------------
app.get("/signup",(req,res) => {
  res.render("users/signup.ejs");
})



app.post('/signup', wrapAsync(async(req, res, next) => {
  const { email, username, password } = req.body;
  registerUser(email, username, password, (err, results) => {
      if (err) {
          if (err.message === 'Email or Username already exists') {
            req.flash("error", err.message);
           return res.redirect("/signup");
          }
          return res.status(500).send('Error registering user');
      }
      req.login(registerUser,(err) => {
        if(err){
          return next(err);
        }
        req.flash("success", "Welcome to Wanderlust.....");
        return res.redirect("/listings"); 
      })
      console.log('Error:', err);
     

      }
      );
}));


//login page-----------------------------
app.get("/login",(req,res) => {
  res.render("users/login.ejs");
})




app.post('/login',saveRedirectUrl,(req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err); // Handle any errors
    }
    if (!user) {
      req.flash('error', info.message); // Flash error message if login fails
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash('success', 'Welcome Back Wanderlust.....'); // Flash success message if login succeeds
      const redirectUrl = res.locals.redirectUrl ||'/listings';
      return res.redirect(redirectUrl);
    });
  })(req, res, next);
});



//logout---------------------------------------------
app.get("/logout",(req,res) =>{
  req.logout((err) => {
    if(err){
      return next(err);
    }
    req.flash("success","Logged You Out");
    return res.redirect("/listings");
  })
})



app.get('/search', (req, res) => {
  const { searchTerm } = req.query;

  if (!searchTerm || searchTerm.trim() === '') {
      return res.redirect('/listings');
  }

  // Exact match with '='
  const query = 
      `SELECT * FROM Listings 
      WHERE location COLLATE utf8mb4_general_ci = ? 
      OR country COLLATE utf8mb4_general_ci = ?`;

  const values = [searchTerm, searchTerm];

  db.query(query, values, (err, results) => {
      if (err) {
          console.error('Database error:', err);
          return res.redirect('/listings');
      }

      if (results.length === 0) {
          console.log('No listings found');
      } else {
          console.log(`${results.length} listings found`);
      }

      res.render('listings/search.ejs', { allListing: results });
  });
});



app.get('/filter', (req, res) => {
  const { category } = req.query;

  if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
  }

  const query = 
      `SELECT * FROM Listings 
      WHERE category = ?`
  ;

  db.query(query, [category], (err, results) => {
      if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
      }

      res.json(results);
  });
});


app.all("*", (req,res,next) => {
  next(new ExpressError(404,"Page is not found!"));
})

app.use((err,req,res,next) =>{
  let {statusCode = 500 , message = "Something Wrong" } =err;
  // res.status(statusCode).send(message); 
  res.status(statusCode).render("error.ejs",{message});
})


app.listen(9898, () => {
  console.log("Server is listening on port 9898");
});
