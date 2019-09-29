var express = require('express');
var router = express.Router();

var Order = require('../models/order');
var Transaction = require('../models/transaction');
var Category = require('../models/category');
var DayBalance = require('../models/dayBalance');
var Product = require('../models/product');

var moment = require('moment');
moment.locale('uk');


//custom functions below

function createOrderString(date) {
    return ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ' ' + ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();
}

function createDayBalanceHeaderString(date) {
    return ('0' + date.getDate()).slice(-2) + '.' + ('0' + (date.getMonth() + 1)).slice(-2) + '.' + date.getFullYear();
}


// GETting the check-out page

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
        if (req.session.currentOrder.discount) {
            req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
        }
    }
    res.redirect('/');
});


router.post('/', function (req, res) {
    let id = req.body.id;
    console.log(req.body);
    let quantity = parseFloat(req.body.quantity);
    if (!quantity || !id) {
        req.flash('error', `Не вказана кількість товару`);
        return res.redirect('/')
    }
    let mult = 1;
    if (req.body.mult) {
        if (req.body.mult == 'x2') {
            mult = 2
        } else {
            mult = 3;
        }
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
                for (let i = 0; i < mult; i++) {
                    req.session.currentOrder.products.push({
                        name: product.title,
                        price: product.price,
                        quantity: quantity,
                        _id: id,
                        category: product.category
                    });
                    if (p) {
                        //adding bottle
                        req.session.currentOrder.products.push({
                            name: p.title,
                            price: p.price,
                            quantity: 1,
                            _id: p.id,
                            category: p.category
                        });
                        //updating total sum
                        req.session.currentOrder.sum += p.price;
                    }
                    req.session.currentOrder.sum += parseFloat(product.price) * parseFloat(quantity);
                }
                if (req.session.currentOrder.discount) {
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
                _id: id,
                category: product.category
            });
            //updating total sum
            req.session.currentOrder.sum += product.price * quantity;
            if (req.session.currentOrder.discount) {
                req.session.currentOrder.discountSum = req.session.currentOrder.sum - (req.session.currentOrder.sum * (req.session.currentOrder.discount / 100.));
            }
            console.log(req.session.currentOrder);
            res.redirect('/');
        }
    })
});

// Saving order to the database and decreasing quantity of the added products
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

        let orderDate = new Date();
        let headline = createOrderString(orderDate);
        let totalSum = req.session.currentOrder.discount ? req.session.currentOrder.discountSum : req.session.currentOrder.sum;
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
            Object.getOwnPropertyNames(quantityToDecreaseByProduct).forEach((productID) => {
                Product.findById(productID, (err, product) => {
                    if (err) { console.log(`Помилка при зменшенні кількості продукта: ${err}`); return; }
                    let newTransaction = new Transaction({
                        productId: productID,
                        productName: product.title,
                        type: "sale",
                        quantity: quantityToDecreaseByProduct[productID],
                        previousQuantity: product.quantity,
                        orderId: orderSaved._id
                    });
                    product.quantity -= quantityToDecreaseByProduct[productID];
                    product.save();
                    newTransaction.save();
                });
            });
            req.flash('success', "Замовлення успішно збережено");
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

// Bad solution for changing existing order
router.get('/checkout', (req, res) => {
    console.log()
    if (req.session.currentOrder.sum == 0) {
        req.flash('error', 'Загальна сума - 0. Замовлення пусте');
        return res.redirect('/');
    } else if (!req.query.id) {
        req.flash('error', 'Не вказаний ID заявки');
        return res.redirect('/');
    }
    Order.findById(req.query.id, (err, order) => {
        if (err) {
            console.warn(err);
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.redirect('/');
        }
        if (!order) {
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.render('/');
        }
        let totalSum = req.session.currentOrder.discount ? req.session.currentOrder.discountSum : req.session.currentOrder.sum;
        order.totalItemsCount = req.session.currentOrder.products.length;
        /*
            besides changing required fields of the order, 
            we are calculating the difference between
            new and old sum of the order. So we can further apply 
            changes to sum of the Day Balance wich this order is related to 
        */
        let diffSum = totalSum - order.totalSum;
        order.totalSum = totalSum;
        order.discount = req.session.currentOrder.discount;
        order.discountSum = req.session.currentOrder.discountSum;
        order.products = req.session.currentOrder.products
        //trying to save changed order
        order.save((err) => {
            if (err) {
                console.warn(err);
                req.flash('warning', 'Помилка при збереженні відредагованого замовлення');
                return res.redirect('/');
            }
            //if no errors - looking for day balance that contains order wich we are saving
            DayBalance.findOne({ orders: req.query.id }, (err, db) => {
                if (err) {
                    console.warn(err);
                    req.flash('warning', 'Помилка при збереженні відредагованого замовлення');
                    return res.redirect('/');
                }
                //if no errors - changing total sum of the day balance
                db.totalSum += diffSum;
                //trying to save the day balance
                db.save((err) => {
                    if (err) {
                        console.warn(err);
                        req.flash('warning', 'Помилка при збереженні відредагованого замовлення');
                        return res.redirect('/');
                    }
                    //if no errors - clearing order
                    req.session.currentOrder = {
                        products: [],
                        sum: 0
                    };
                    //flashing success message
                    req.flash('success', `Успішно оновлено Замовлення за ${order.headerStr}`);
                    res.redirect('/');
                });
            });
        });
    })
})

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



const { exec } = require('child_process');
const fs = require('fs');
const iconv = require('iconv-lite');

router.get('/print', (req, res) => {
    console.log(`Recieved print command:\n${req.query.name}${req.query.quantity}`);
    let printString = req.query.name.substring(0, 9) + ':' + req.query.quantity.slice(-3);
    while (printString.length != 13) {
        printString += ' ';
    }

    let fileBuf = fs.readFileSync('label-borders.prn');
    let fileStr = iconv.decode(fileBuf, "cp1251").toString();

    let newStr = fileStr.replace('1234567890123', printString);
    let buf = iconv.encode(newStr, "cp1251");
    let stream = fs.createWriteStream(`toPrint.prn`);
    stream.write(buf);
    stream.end();
    exec('netsuite-print.bat toPrint.prn', (err, stdout, stderr) => {
        if (err) {
            // node couldn't execute the command
            req.flash('error', 'Вибачте. Не можемо надрукувати');
            res.redirect('/');
            return console.log('err');
        }
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        res.redirect('/');
    });
})

// Exports
module.exports = router;


