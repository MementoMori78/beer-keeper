var express = require('express');
var router = express.Router();
var async = require("async");
// Get Page model
var Page = require('../models/page');
var Order = require('../models/order');
var Category = require('../models/category');
var DayBalance = require('../models/dayBalance');


var Product = require('../models/product');
/*
 * GET /
 */
router.get('/', function (req, res) {
    let navClasses = {
        'cas': 'active',
        'storage': ''
    }
    Product.find({}, (err, products) => {
        if (err) {
            console.log(error);
            res.render('index', { products: [], order: req.session.currentOrder })
        } else {
            res.render('index', {
                products: products,
                order: req.session.currentOrder,
                navClasses: navClasses
            })
        }
    });
});

router.get('/clear_order', function (req, res) {
    req.session.currentOrder = {
        products: [],
        sum: 0
    }
    res.redirect('/');
});

router.get('/del_product', function (req, res) {
    console.log(`GET [/del] params: id=${req.query.id} quantity=${req.query.quantity} `);
    let _index;
    req.session.currentOrder.products.forEach((element, index) => {
        if (element._id == req.query.id && element.quantity == req.query.quantity) {
            _index = index;
        }
    });
    if (typeof _index != 'undefined') {
        req.session.currentOrder.sum -= (req.session.currentOrder.products[_index].price * req.session.currentOrder.products[_index].quantity);
        req.session.currentOrder.products.splice(_index, 1);
        if(req.session.currentOrder.discount){
            req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
        }
    }
    res.redirect('/');
});

router.get('/del_product_from_db', function (req, res) {
    console.log(`GET [/del] params: id=${req.query.id}`);
    Product.remove({ _id: req.query.id }, (err) => {
        if (!err) {
            console.log(`Deleted id:${req.query.id}`);
            res.redirect('/balance');
        } else {
            console.log(err);
        }
    });
});

/*
 * POST /. Adding a product to the order
 */
router.post('/', function (req, res) {
    let id = req.body.id;
    let quantity = parseFloat(req.body.quantity);
    if (!quantity) {
        return res.redirect('/')
    }
    console.log(`POST [/] params: id=${id} quantity=${quantity}`);
    Product.findById(id, (err, product) => {
        if (err) { console.log(err); }
        //Adding Bottles to order if type of the product is beer  
        if (product.category == "Пиво" || product.category == "ПИВО" || product.category == "ВИНО") {
            let bottleName = 'Пляшка ';
            let addStr;
            switch (parseFloat(quantity)) {
                case 0.5:
                    addStr = '0.5';
                    break;
                case 1.0:
                    addStr = '1.0';
                    break;
                case 1.5:
                    addStr = '1.5';
                    break;
                case 2.0:
                    addStr = '2.0';
                    break;
                default:
                    addStr = '0.5';
                    break;
            }
            bottleName += addStr;
            Product.findOne({ title: bottleName }, (err, p) => {
                if (err) { console.log(err); return res.redirect('/') }
                //adding main product
                req.session.currentOrder.products.push({
                    name: product.title,
                    price: product.price,
                    quantity: quantity,
                    _id: id
                });
                if (p) {
                    //adding bottle
                    req.session.currentOrder.products.push({
                        name: p.title,
                        price: p.price,
                        quantity: 1,
                        _id: p.id
                    });
                    //updating total sum
                    req.session.currentOrder.sum += p.price;
                }
                req.session.currentOrder.sum += parseFloat(product.price) * parseFloat(quantity);
                if(req.session.currentOrder.discount){
                    req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
                }
                res.redirect('/');
            });
        } else {
            //adding product
            req.session.currentOrder.products.push({
                name: product.title,
                price: product.price,
                quantity: quantity,
                _id: id
            });
            //updating total sum
            req.session.currentOrder.sum += product.price * quantity;
            if(req.session.currentOrder.discount){
                req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
            }
            console.log(req.session.currentOrder);
            res.redirect('/');
        }
    })
});

router.get('/check-out', (req, res) => {
    if (req.session.currentOrder.sum == 0) {
        res.redirect('/');
    } else {
        let customerMoney = (parseFloat(req.query.money)) ? parseFloat(req.query.money) : 0;

        console.log('Cheking out, session object: ', req.session.currentOrder)
        //Decreasing quantity of all added products
        //Summing quantity for each product so we will query the db for each product only once. Object structure as follows
        //  {
        //      "id1" : <value1>,  
        //      "id2" : <value2>    
        //  }
        let quantityToDecreaseByProduct = {};
        req.session.currentOrder.products.forEach((product) => {
            if (Object.getOwnPropertyNames(quantityToDecreaseByProduct).indexOf(product._id) != -1) {
                quantityToDecreaseByProduct[product._id] += product.quantity;
            } else {
                quantityToDecreaseByProduct[product._id] = product.quantity;
            }
        });
        Object.getOwnPropertyNames(quantityToDecreaseByProduct).forEach((productID) => {
            Product.findById(productID, (err, product) => {
                if (err) { console.log(`Помилка при зменшенні кількості продукта: ${err}`); return; }
                product.quantity -= quantityToDecreaseByProduct[productID];
                product.save();
            })
        });
        let orderDate = new Date();
        let headline = createOrderString(orderDate);
        let totalSum = req.session.currentOrder.discount?req.session.currentOrder.discountSum:req.session.currentOrder.sum;
        var newOrder = new Order({
            products: req.session.currentOrder.products,
            date: orderDate,
            totalItemsCount: req.session.currentOrder.products.length,
            totalSum: totalSum,
            headerStr: headline,
            customerMoney: customerMoney,
            discount: req.session.currentOrder.discount,
            discountSum: req.session.currentOrder.discountSum,
        });
        newOrder.save((err, orderSaved) => {
            if (err) {
                console.log(err);
                return res.redirect('/');
            }
            //checking if dayBalance exists
            DayBalance.find({}, (err, days) => {
                //if dayBalances exist at all
                if (days.length == 0) {
                    let date = new Date();
                    let dayBalanceHeaderString = createDayBalanceHeaderString(date);
                    //creating new dayBalance
                    let dayBalance = new DayBalance({
                        orders: [orderSaved.id],
                        date: date,
                        totalSum: orderSaved.totalSum,
                        headerStr: dayBalanceHeaderString,
                        month: parseInt(date.getMonth()),
                        day: parseInt(date.getDate()),
                        year: parseInt(date.getFullYear())
                    });
                    //saving new dayBalance
                    dayBalance.save((err, db) => {
                        if (err) {
                            console.log(err); return res.redirect('/');
                        } else {
                            //clearing current order
                            req.session.currentOrder = {
                                products: [],
                                sum: 0
                            };
                            //redirecting to main
                            res.redirect('/');
                        }
                    });
                    //if there are DayBalance enty in database
                } else {
                    //checking if there is day balance with same day, month and year as today's
                    let date = new Date();
                    DayBalance.findOne({
                        month: parseInt(date.getMonth()),
                        day: parseInt(date.getDate()),
                        year: parseInt(date.getFullYear())
                    }, (err, dayBalance) => {
                        if (err) {
                            console.log(err); return res.redirect('/');
                        } else {
                            //checking if day balance with required date has been found
                            if (dayBalance === null) { //means that not found
                                let dayBalanceHeaderString = createDayBalanceHeaderString(date);
                                let dayBalance = new DayBalance({
                                    orders: [orderSaved.id],
                                    date: date,
                                    totalSum: orderSaved.totalSum,
                                    headerStr: dayBalanceHeaderString,
                                    month: parseInt(date.getMonth()),
                                    day: parseInt(date.getDate()),
                                    year: parseInt(date.getFullYear())
                                });
                                //saving new dayBalance
                                dayBalance.save((err, db) => {
                                    if (err) {
                                        console.log(err); return res.redirect('/');
                                    } else {
                                        //clearing current order
                                        req.session.currentOrder = {
                                            products: [],
                                            sum: 0
                                        };
                                        //redirecting to main
                                        res.redirect('/');
                                    }
                                });
                            } else { //means that dayBalance already exists
                                dayBalance.totalSum += parseFloat(orderSaved.totalSum);
                                dayBalance.orders.push(orderSaved.id);
                                dayBalance.save((err) => {
                                    if (err) {
                                        console.log(err); return res.redirect('/');
                                    } else {
                                        //clearing current order
                                        req.session.currentOrder = {
                                            products: [],
                                            sum: 0
                                        };
                                        //redirecting to main
                                        res.redirect('/');
                                    }
                                })
                            }
                        }
                    })
                }
            })
        })
    }
});

function createOrderString(date) {
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ' ' + ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();
}

function createDayBalanceHeaderString(date) {
    return ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();
}

router.get('/day', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    DayBalance.findById(req.query.id, (err, dayBalance) => {
        if (err) {
            console.log(err); return res.redirect('/');
        } else {
            Order.find({
                '_id': {
                    $in:
                        dayBalance.orders
                }
            }, (err, orders) => {
                if (err) {
                    console.log(err); return res.redirect('/');
                } else {
                    res.render('day', {
                        dayBalance: dayBalance,
                        orders: orders,
                        navClasses: navClasses
                    })
                }
            });
        }
    })

});

router.get('/days', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    DayBalance.find({}, (err, dayBalances) => {
        res.render('storage', {
            dbs: dayBalances,
            navClasses: navClasses
        })
    })
});

router.get('/balance', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.find({}, (err, products) => {
        res.render('balance', {
            products: products,
            navClasses: navClasses
        })
    })
});

router.get('/replenish', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        res.render('replenish', {
            product: product,
            navClasses: navClasses
        })
    })
});

router.post('/replenish', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        product.quantity += parseFloat(req.body.quantity);
        product.save((err) => {
            if (err) console.log(err);
            res.redirect('balance');
        })
    })
});



router.get('/write-off', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        res.render('write_off', {
            product: product,
            navClasses: navClasses
        })
    })
});

router.post('/write-off', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        product.quantity -= parseFloat(req.body.quantity);
        product.save((err) => {
            if (err) console.log(err);
            res.redirect('balance');
        })
    })
});

router.get('/edit', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) return console.log(err);
        Category.find({}, (err, categories) => {
            if (err) return console.log(err);
            res.render('edit', {
                categories: categories,
                product: product,
                navClasses: navClasses
            })
        });
    })
});

router.post('/edit', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Product.findById(req.query.id, (err, product) => {
        product.title = (req.body.title) ? req.body.title : product.title;
        product.price = parseFloat(req.body.price) ? parseFloat(req.body.price) : product.price;
        product.category = req.body.category;
        product.save((err) => {
            if (err) console.log(err);
            res.redirect('balance');
        });
    });
});

router.get('/create_product', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Category.find({}, (err, categories) => {
        if (err) return console.log(err);
        res.render('create_product', {
            categories: categories,
            navClasses: navClasses
        })
    });
});

router.post('/create_product', (req, res) => {

    let newProduct = new Product({
        title: req.body.title,
        price: parseFloat(req.body.price),
        category: req.body.category,
        desс: 'desc',
        quantity: 0
    })

    newProduct.save((err) => {
        if (err) { console.log(err); res.redirect('/balance'); }
        res.redirect('balance');
    });
});

router.get('/create_category', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    res.render('create_сategory', {
        navClasses: navClasses
    });
});

router.post('/create_category', (req, res) => {
    let newCategory = new Category({
        title: req.body.title,
    })

    newCategory.save((err) => {
        if (err) { console.log(err); res.redirect('/balance'); }
        res.redirect('balance');
    });
});

router.get('/add-discount', (req, res) => {
    let userInput = parseInt(req.query.discount)
    if (userInput >= 0 && userInput <= 100) {
        req.session.currentOrder.discount = userInput;
        req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
        if (userInput) {
            req.flash('success', `Успішно застосовано знижку ${userInput}%! Щоб скасувати - вкажіть знижку рівною 0%`);
        } else {
            req.flash('warning', `Знижку скасовано`);
        }
    } else {
        req.flash('error', `Некоректне значення для знижки: ${req.query.discount}`);
        console.log(`Некоректне значення для знижки: ${req.query.discount}`);
    }
    res.redirect('/')
});

// Exports
module.exports = router;


