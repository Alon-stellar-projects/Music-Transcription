'use strict';
var debug = require('debug')('my express app');
var express = require('express');
var path = require('path');
const fs = require('fs');
var favicon = require('serve-favicon');  // For icons
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/routs');
var users = require('./routes/users');

var app = express();

// Maybe I already have them by importing routes:
const solutionBasePath = path.join(__dirname, '..');
const consts = JSON.parse(fs.readFileSync(path.join(solutionBasePath, 'Consts.json'), { encoding: 'utf8', flag: 'r' }));

// view engine setup
app.set('views', path.join(__dirname, 'views'));  // Setup a "views" lookup folder.
app.set('view engine', 'pug');  // Setup a view engine with ".pug" files.

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
// A logger:
app.use(logger('dev'));
// Parses data from incoming URL requests into an object, with field names matching those in the request's body:
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
// Allow the client to access files inside ./public/ folder. Files inside ./public/ are accessed by html files as if they're in the ./views/ folder:
app.use(express.static(path.join(__dirname, 'public')));

// Routers:
app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handlers:

// development error handler
// will print stacktrace
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

// production error handler
// no stacktraces leaked to user
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
    debug('Express server listening on port ' + server.address().port);
});
