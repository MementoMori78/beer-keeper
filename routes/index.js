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



router.get('/day', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }

    DayBalance.findById(req.query.id, (err, dayBalance) => {
        if (err) {
            console.log(err); return res.redirect('/');
        } else {
            if (!dayBalance) return res.redirect('/');
            Order.find({
                '_id': {
                    $in:
                        dayBalance.orders
                }
            }, (err, orders) => {
                if (err) {
                    console.log(err); return res.redirect('/');
                } else {
                    //counting sold quantity for each product
                    let productsTable = []; //store result in here
                    let discountedSum = 0;
                    orders.forEach((order) => {
                        if (order.discount && order.discount < 100) {
                            let initialSum = (order.totalSum * 100) / (100 - order.discount);
                            discountedSum += initialSum - order.discountSum;
                        }
                        order.products.forEach((product) => {
                            //looking if such product is already in result array
                            let productFromTable = productsTable.find(el => el._id == product._id);
                            //is in result arrays, so we are just adding the quantity 
                            if (productFromTable) {
                                productFromTable.quantity += product.quantity;
                            } else {
                                //else - pushing new product object to the array
                                productsTable.push({
                                    name: product.name,
                                    price: product.price,
                                    quantity: product.quantity,
                                    _id: product._id,
                                    category: product.category
                                });
                            }
                        });
                    });
                    res.render('day', {
                        dayBalance: dayBalance,
                        orders: orders,
                        navClasses: navClasses,
                        productsTable: productsTable,
                        discountedSum: discountedSum
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

        let plotObj = {
            x: [], //totalSum
            y: [], //date
            type: 'bar'
        };
        let years = [];
        for (let i = (dayBalances.length - 1); i >= 0 && i > dayBalances.length - 70; i--) {
            let date = moment(dayBalances[i].date);
            let weekFromPlotIndex = plotObj.y.findIndex(week => week == date.week());
            if (weekFromPlotIndex !== -1) {
                plotObj.x[weekFromPlotIndex] += dayBalances[i].totalSum;
            } else {
                plotObj.x.push(dayBalances[i].totalSum);
                plotObj.y.push(date.week());
                years.push(date.year());
            }
        }
        plotObj.y.forEach((el, index, arr) => {
            arr[index] = `${moment().day("Понеділок").year(years[index]).week(el).format('DD.MM')} - ${moment().day("Неділя").year(years[index]).week(el).format('DD.MM')}`
        })
        res.render('storage', {
            dbs: dayBalances,
            navClasses: navClasses,
            plotTrace: plotObj
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
    const recievedReplenishValue = parseFloat(req.body.quantity);
    if (!recievedReplenishValue || recievedReplenishValue < 0 ) {
        req.flash('error', `Некоректне значення для поповнення`);
        return res.redirect('balance');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) {
            console.log(error);
            req.flash('error', 'Помилка при поповненні товару');
            return res.redirect('balance');
        }
        product.quantity += recievedReplenishValue;
        product.save((err) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Помилка при поповненні товару');
                return res.redirect('balance')
            }
            let newTransaction = new Transaction({
                productId: product._id,
                productName: product.title,
                type: "replenishment",
                quantity: recievedReplenishValue,
                previousQuantitiy: product.quantity - recievedReplenishValue
            })
            newTransaction.save((err) => {
                if (!err) {
                    req.flash('success', `Успішно додано ${recievedReplenishValue.toFixed(2)} до кількості товару "${product.title}"`)
                    return res.redirect(`/balance`);
                }
                console.log(err);
                req.flash('warning', `Не вдалось зберегти операцію, однак успішно додано ${recievedReplenishValue.toFixed(2)} до кількості товару "${product.title}". Однак .`); 
                res.redirect(`/balance`);
            })

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
    const recievedWriteOffValue = parseFloat(req.body.quantity);
    if (!recievedWriteOffValue || recievedWriteOffValue < 0) {
        res.flash('error', 'Некоректна кількість до списання');
        return res.redirect('balance');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) {
            console.log(`Error writing-off product with id ${req.query.id}: ${err}`);
            return res.redirect('/');
        }
        product.quantity -= recievedWriteOffValue;
        product.save((err) => {
            if (err) console.log(err);
            //creating transaction document
            let newTransaction = new Transaction({
                productId: product._id,
                productName: product.title,
                type: "write-off",
                quantity: recievedWriteOffValue,
                previousQuantitiy: product.quantity + recievedWriteOffValue
            })

            newTransaction.save((err) => {
                if (err) {
                    req.flash('warning', 'Помилка збереження операції');
                    res.redirect('balance');
                }
                res.redirect('balance');
            })
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

router.get('/delete_order', (req, res) => {
    if (!req.query.id) {
        req.flash('error', 'Не вказано ID замовлення яке необхідно видалити');
        return res.redirect('/days')
    }
    Order.findById(req.query.id, (err, order) => {
        if (err) {
            console.warn(err);
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.redirect('/');
        }
        if (!order) {
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.redirect('/');
        }
        let removedSum = order.totalSum;
        order.remove((err) => {
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
                db.totalSum -= removedSum;
                let index = db.orders.findIndex(el => el == req.query.id);
                if (index !== -1) {
                    db.orders.splice(index, 1);
                }
                //trying to save the day balance
                db.save((err) => {
                    if (err) {
                        console.warn(err);
                        req.flash('warning', 'Помилка при видаленні');
                        return res.redirect('/');
                    }
                    //if no errors - clearing order
                    req.session.currentOrder = {
                        products: [],
                        sum: 0
                    };
                    //flashing success message
                    req.flash('success', `Успішно видалено замовлення ${req.query.id}`);
                    res.redirect('/days');
                });
            });
        });
    })
})


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
            return;
        }
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        res.redirect('/');
    });

})

// Exports
module.exports = router;


