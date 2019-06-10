var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var config = require('./config/database');
var bodyParser = require('body-parser');
var session = require('express-session');
var expressValidator = require('express-validator');
var fileUpload = require('express-fileupload');
var passport = require('passport');

// Connect to db
mongoose.connect(config.database);
var db = mongoose.connection;
db.once('open', function () {
    console.log('Підключено до БД за посиланням: ' + config.database);
    app.emit('ready');
});

db.on('error', (err) => {
    console.log('Помилка бази даних: ' + err);
    mongoose.disconnect();
});

db.on('disconnected', function () {
    console.log('Втрачено підключення з БД. Перезапустіть ПЗ або ж зверніться до telegram:@vlad_tertyshnyi');
    console.log('Автоматичне перепідключення до БД...');
    mongoose.connect(config.database, {server:{auto_reconnect:true}});
});

db.on('reconnected', function () {
    console.log('Перепідключено до БД!');
});

process.on('SIGINT', function() {  
    db.close(function () { 
      console.log('Скасовано підключення до бази даних у звязку з вимкненням сервера'); 
      process.exit(0); 
    }); 
  }); 

// Init app
var app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Set public folder
app.use(express.static(path.join(__dirname, 'public')));

// Set global errors variable
app.locals.errors = null;

// Get Page Model
var Page = require('./models/page');




// Express fileUpload middleware
app.use(fileUpload());

// Body Parser middleware
// 
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// Express Session middleware
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true
    //  cookie: { secure: true }
}));

// Express Validator middleware
app.use(expressValidator({
    errorFormatter: function (param, msg, value) {
        var namespace = param.split('.')
            , root = namespace.shift()
            , formParam = root;

        while (namespace.length) {
            formParam += '[' + namespace.shift() + ']';
        }
        return {
            param: formParam,
            msg: msg,
            value: value
        };
    },
    customValidators: {
        isImage: function (value, filename) {
            var extension = (path.extname(filename)).toLowerCase();
            switch (extension) {
                case '.jpg':
                    return '.jpg';
                case '.jpeg':
                    return '.jpeg';
                case '.png':
                    return '.png';
                case '':
                    return '.jpg';
                default:
                    return false;
            }
        }
    }
}));

// Express Messages middleware
app.use(require('connect-flash')());
app.use(function (req, res, next) {
    res.locals.messages = require('express-messages')(req, res);
    next();
});

// Passport Config
require('./config/passport')(passport);
// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

app.get('*', function (req, res, next) {
    //creating order object if it wasnt defined
    if (typeof req.session.currentOrder === "undefined") {
        req.session.currentOrder = {
            products: [],
            sum: 0
        };
    }
    res.locals.user = req.user || null;
    next();
});

app.post('*', function (req, res, next) {
    //creating order object if it wasnt defined
    if (typeof req.session.currentOrder === "undefined") {
        req.session.currentOrder = {
            products: [],
            sum: 0
        };
    }
    res.locals.user = req.user || null;
    next();
});

// Set routes 
var pages = require('./routes/pages.js');
var products = require('./routes/products.js');
var cart = require('./routes/cart.js');
var users = require('./routes/users.js');
var adminPages = require('./routes/admin_pages.js');
var adminCategories = require('./routes/admin_categories.js');
var adminProducts = require('./routes/admin_products.js');

app.use('/admin/pages', adminPages);
app.use('/admin/categories', adminCategories);
app.use('/admin/products', adminProducts);
app.use('/products', products);
app.use('/cart', cart);
app.use('/users', users);
app.use('/', pages);

// Start the server
var port = 3000;
app.on('ready', () => {
    app.listen(port, function () {
        console.log('Сервер успішно запущено, для використання - у браузері перейдіть за посиланням localhost:' + port);
    });
})