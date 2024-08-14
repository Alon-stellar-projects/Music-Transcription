/**
 * The main server application driver of the Music_Transcription_App. This app allows a user 
 * to upload music audio files, convert them into musical notes sheets ("transcription") and 
 * let the user download it as a PDF. The app also presents a preview image of the resulted 
 * notes.
 * The application runs on node.js and python technologies, and utilizes advanced Machine Learning 
 * models for the transcription process.
 * 
 * Author: Alon Haviv, Stellar Intelligence.
 */

'use strict';
var debug = require('debug')('my express app');
var express = require('express');
var path = require('path');
const fs = require('fs');
var favicon = require('serve-favicon');  // For icons
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require(path.join(__dirname, 'routes', 'routs'));
var users = require(path.join(__dirname, 'routes', 'users'));
const myLoggers = require(path.join(solutionBasePath, 'Music_Transcription_App', 'utils', 'loggers.js'));
const ENVS = myLoggers.ENVS;  // Object containing the allowed environments (dev, production, ...).

var app = express();
const solutionBasePath = path.join(__dirname, '..');
const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));
const logFilePath = path.join(solutionBasePath, consts["log_file"]);

// view engine setup
app.set('views', path.join(__dirname, 'views'));  // Setup a "views" lookup folder.
app.set('view engine', 'pug');  // Setup a view engine with ".pug" files.

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
// A logger for requests and responses:
if (app.get("env") === "production")
    app.use(morgan('combined', { stream: fs.createWriteStream(logFilePath, { flags: 'a' }) }));
else  // developement
    app.use(morgan('dev')); //log to console on development

// Parses data from incoming URL requests into an object, with field names matching those in the request's body:
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// Allow the client to access files inside ./public/ folder. Files inside ./public/ are accessed by html files as if they're in the ./views/ folder:
app.use(express.static(path.join(__dirname, 'public')));

// Routers:
app.use('/', routes);
app.use('/users', users);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handlers:

// Development error handler. Render the error page with all the error's data.
// Will print stacktrace.
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            title: 'OOPS! O.o`',
            message: err.message,
            error: err
        });
    });
}

// Production error handler. Render the error page with just the error message.
// No stacktraces leaked to user.
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        title: 'OOPS! O.o`',
        message: err.message,
        error: {}
    });
});

// Add more parameters to 'app' to use later:
app.set('port', process.env.PORT || consts.app_port);  // Whatever is in the environment variable PORT, or 3000 if there's nothing there.
app.set('host', consts.app_host);

// Launch app:
var server = app.listen(app.get('port'), app.get('host'), function () {
    debug('Music Transcription server listening on port ' + server.address().port);
    myLoggers.log(ENVS.ALL, 'Music Transcription server listening on port ' + server.address().port);
});
