const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const consolidate = require('consolidate');
import SpotifyWebApi from 'spotify-web-api-node';
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const port = 3000;
const authCallbackPath = '/auth/spotify/callback';

// MongoDB connection
mongoose.connect(process.env.MONGO_URI);

// Passport session setup.
passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

// Use the SpotifyStrategy within Passport.
passport.use(
    new SpotifyStrategy(
        {
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: 'https://snailz3.com' + authCallbackPath,
        },
        function (accessToken, refreshToken, expires_in, profile, done) {
            profile.accessToken = accessToken; // Store accessToken in profile
            profile.refreshToken = refreshToken; // Store refreshToken in profile
            return done(null, profile);
        },
    ),
);

const app = express();

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'html');

app.use(
    session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    }),
);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));
app.engine('html', consolidate.nunjucks);

app.get('/', function (req, res) {
    res.render('index.html', { user: req.user });
});

const fetchAllPaginatedResults = async (spotifyApiMethod, options = {}) => {
    const limit = options.limit || 50; // Default limit per request
    const offset = options.offset || 0; // Initial offset
    let totalItems = Infinity; // Placeholder for total items count
    let results = [];

    // Function to fetch results for a given offset
    const fetchResults = async (offset) => {
        try {
            const data = await spotifyApiMethod({ offset, limit });
            return data.body;
        } catch (error) {
            console.error(
                `Error fetching results with offset ${offset}:`,
                error,
            );
            return { items: [] }; // Return empty items array on error
        }
    };

    // Fetch initial batch to determine total items count
    const initialData = await fetchResults(offset);
    totalItems = initialData.total || 0;
    results = initialData.items || [];

    // Determine remaining items to fetch
    const remainingItems = totalItems - limit;

    // Calculate number of parallel requests needed
    const numRequests = Math.ceil(remainingItems / limit);

    // Prepare an array of promises for parallel fetching
    const requests = [];
    for (let i = 1; i <= numRequests; i++) {
        const currentOffset = offset + i * limit;
        requests.push(fetchResults(currentOffset));
    }

    // Execute all requests in parallel
    const responses = await Promise.all(requests);

    // Collect items from all responses
    responses.forEach((response) => {
        results = results.concat(response.items || []);
    });

    return results;
};

app.get('/account', ensureAuthenticated, async function (req, res) {
    const accessToken = req.user.accessToken;
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(accessToken);

    try {
        // Fetch all liked songs using the helper function
        const tracks = await fetchAllPaginatedResults(
            spotifyApi.getMySavedTracks.bind(spotifyApi),
            { limit: 50 },
        );

        // Group songs by release year
        const songsByYear = {};

        tracks.forEach((item) => {
            const track = item.track;
            const releaseYear = track.album.release_date.slice(0, 4); // Extract the year part

            if (!songsByYear[releaseYear]) {
                songsByYear[releaseYear] = [];
            }
            songsByYear[releaseYear].push(track.name);
        });

        res.render('account.html', {
            user: req.user,
            songsByYear: JSON.stringify(songsByYear),
        });
    } catch (err) {
        console.error('Error fetching liked songs:', err);
        res.render('account.html', {
            user: req.user,
            error: 'Error fetching liked songs',
        });
    }
});

app.get('/login', function (req, res) {
    res.render('login.html', { user: req.user });
});

app.get(
    '/auth/spotify',
    passport.authenticate('spotify', {
        scope: [
            'user-read-email',
            'user-read-private',
            'playlist-read-private',
            'playlist-read-collaborative',
            'user-library-read',
        ],
        showDialog: true,
    }),
);

app.get(
    authCallbackPath,
    passport.authenticate('spotify', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/');
    },
);

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.listen(port, function () {
    console.log('App is listening on port ' + port);
});

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}
