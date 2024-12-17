const express = require('express'),
      path = require('path'),
      cookieParser = require('cookie-parser'),
      bodyParser = require('body-parser'),
      main = require('./controllers/MainController'),
      helpers        = require('./utils/hbs_helpers'),
      hbs = require('hbs'),
      config      = require('./config/config'),
      createError = require('http-errors'),
      logger = require('morgan'),
      indexRouter = require('./routes//index'),
      fileUpload = require('express-fileupload'),
      app = express();
 

app.use(fileUpload());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/statics', express.static(path.join(__dirname, 'public')));



app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {error:err.message, config:config});
});

hbs.registerPartials(__dirname + '/views/modules/');



module.exports = app;
