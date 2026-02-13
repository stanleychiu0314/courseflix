var createError = require('http-errors');
var express = require('express');
var path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var session = require('express-session');
var pgSession = require('connect-pg-simple')(session);
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var coursesRouter = require('./routes/courses');
var departmentsRouter = require('./routes/departments');
var termsRouter = require('./routes/terms');
var scheduleRouter = require('./routes/schedule');
var authRouter = require('./routes/auth');
var reviewsRouter = require('./routes/reviews');
var db = require('./db');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// CORS configuration - allow frontend to access API
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set('trust proxy', 1);
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  name: 'courseflix.sid',
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Number(process.env.SESSION_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000),
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/terms', termsRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/auth', authRouter);
app.use('/api/reviews', reviewsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
