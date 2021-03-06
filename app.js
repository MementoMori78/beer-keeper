var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var config = require('./config/database');
var bodyParser = require('body-parser');
var session = require('express-session');
var expressValidator = require('express-validator');
var fileUpload = require('express-fileupload');
var passport = require('passport');


mongoose.Promise = global.Promise;
const options = { useMongoClient: true, autoReconnect: true, reconnectTries: 60, reconnectInterval: 5000}
// Connect to db3000
mongoose.connect(config.database, options, (err) => {
    if (err) {
        console.log('Невдала спроба першого підключення до БД. ');
    }
});
var db = mongoose.connection;
db.once('open', function () {
    console.log('Підключено до БД за посиланням: ' + config.database);
    app.emit('ready');
});

db.on('error', (err) => {
    console.log('Помилка бази даних.');
    mongoose.disconnect();
});

db.on('disconnected', function () {
    console.log('Втрачено підключення з БД. Перезапустіть ПЗ або ж зверніться до telegram:@vlad_tertyshnyi');
    console.log('Автоматичне перепідключення до БД...');
});

db.on('reconnected', function () {
    console.log('Перепідключено до БД!');
});

process.on('SIGINT', function () {
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
var index = require('./routes/index.js');
var storage = require('./routes/storage.js');
var sales = require('./routes/sales.js');
// Add imported routes to the app
app.use('/', index);
app.use('/storage', storage);  
app.use('/sales', sales);


// Start the server
var port = 3000;
app.on('ready', () => {
    app.listen(port, function () {
        console.log(`Сервер успішно запущено. \nДля використання - перейдіть за посиланням localhost:${port} у браузері`);
    });
})