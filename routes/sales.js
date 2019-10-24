var express = require('express');
var router = express.Router();

var Order = require('../models/order');
var Transaction = require('../models/transaction');
var Category = require('../models/category');
var DayBalance = require('../models/dayBalance');
var Product = require('../models/product');

var moment = require('moment');
moment.locale('uk');

router.get('/day', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    DayBalance.findById(req.query.id, (err, dayBalance) => {
        if (err) {
            console.log(err);
            req.flash('error', 'Помилка при пошуку інформації по вказаному дню');
            return res.redirect('/sales');
        } else {
            if (!dayBalance) {
                req.flash('error', 'Помилка при пошуку інформації по вказаному дню');
                return res.redirect('/sales');
            }
            Order.find({
                '_id': {
                    $in: dayBalance.orders
                }
            }, (err, orders) => {
                if (err) {
                    console.log(err);
                    req.flash('error', 'Помилка при пошуку списку чеків для вказаного дня');
                    return res.redirect('/sales');
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

router.get('/', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    DayBalance.find({}, (err, dayBalances) => {
        if (err) {
            console.log(err);
            req.flash('error', `Помилка при завантаженні інформації з БД`);
            return res.redirect('/')
        }
        let plotObj = {
            x: [], //totalSum
            y: [], //date
            type: 'bar'
        };
        let years = [];
        for (let i = (dayBalances.length - 1); i >= 0 && i > dayBalances.length - 360; i--) {
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
        res.render('sales', {
            dbs: dayBalances,
            navClasses: navClasses,
            plotTrace: plotObj
        })
    })
});

router.get('/delete_order', (req, res) => {
    if (!req.query.id) {
        req.flash('error', 'Не вказано ID замовлення яке необхідно видалити');
        return res.redirect('/sales')
    }
    Order.findById(req.query.id, (err, order) => {
        if (err) {
            console.warn(err);
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.redirect('/sales');
        }
        if (!order) {
            req.flash('warning', 'Вказаний ID не знайдений у БД');
            return res.redirect('/sales');
        }
        let removedSum = order.totalSum;
        order.remove((err) => {
            if (err) {
                console.warn(err);
                req.flash('warning', 'Помилка при збереженні відредагованого замовлення');
                return res.redirect('/sales');
            }
            //if no errors - looking for day balance that contains order wich we are saving
            DayBalance.findOne({ orders: req.query.id }, (err, db) => {
                if (err) {
                    console.warn(err);
                    req.flash('warning', 'Помилка при збереженні відредагованого замовлення');
                    return res.redirect('/sales');
                }
                //if no errors - changing total sum of the day balance
                db.totalSum -= removedSum;
                let index = db.orders.findIndex(el => el == req.query.id);
                if (index !== -1) {
                    db.orders.splice(index, 1);
                }
                if (db.orders.length === 0) {
                    DayBalance.remove({ _id: db._id }, (err) => {
                        if (err) {
                            console.log(err);
                            req.flash('error', 'Вдалось видалити останнє замовлення у дні, однак не вдалось видалити зі списку сам день');
                            return res.redirect('/sales');
                        } else {
                            req.flash('success', `Успішно видалено замовлення ${req.query.id} та інформацію по даному дню`);
                            res.redirect('/sales');
                        }
                    });
                } else {
                    //trying to save the day balance
                    db.save((err) => {
                        if (err) {
                            console.warn(err);
                            req.flash('warning', 'Помилка при видаленні');
                            return res.redirect('/sales');
                        }
                        //if no errors - clearing order
                        req.session.currentOrder = {
                            products: [],
                            sum: 0
                        };
                        //flashing success message
                        req.flash('success', `Успішно видалено замовлення ${req.query.id}`);
                        res.redirect('/sales');
                    });
                }
            });
        });
    })
})

router.get('/report', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': '',
        'buh': 'active',
    }
    res.render('date_selection', { navClasses: navClasses });
})

router.post('/report', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }

    if (!req.body.start || !req.body.end) {
        req.flash('error', 'Не обрана початкова або кінцева дата');
        return res.render('date_selection', { navClasses: navClasses });
    }
    let startDate = moment(req.body.start, "DD.MM.YYYY");
    let endDate = moment(req.body.end, "DD.MM.YYYY");
    if (req.body.start == req.body.end) {
        startDate.hour(0);
        startDate.minute(0);
        endDate.hour(23);
        endDate.minutes(59);
    }
    Transaction.find({
        date: {
            $gte: startDate,
            $lte: endDate
        }
    }, (err, transactions) => {
        if (err) {
            console.log(err);
            req.flash('error', 'Помилка при пошуку операцій у БД');
            return res.render('date_selection', { navClasses: navClasses });
        }

        let main = {
            sale: 0,
            writeOff: 0,
            revenue: 0
        }
        let byProduct = [];
        let cycles = [];
        transactions.forEach((transaction) => {
            let index = findWithAttr(byProduct, 'productId', transaction.productId);
            let cyclesIndex = findWithAttr(cycles, 'productId', transaction.productId);
            switch (transaction.type) {
                case 'replenishment':
                    if (index < 0) {
                        byProduct.push({
                            name: transaction.productName,
                            category: (transaction.productCategory ? transaction.productCategory : "Не вказано"),
                            productId: transaction.productId,
                            replQuantity: transaction.quantity,
                            replMoney: transaction.quantity * (transaction.cost ? transaction.cost : transaction.price),
                            writeMoney: 0,
                            writeQuantity: 0,
                            saleMoney: 0,
                            saleQuantity: 0
                        });
                    } else {
                        byProduct[index].replMoney += transaction.quantity * (transaction.cost ? transaction.cost : transaction.price);
                        byProduct[index].replQuantity += transaction.quantity;
                    }
                    break;
                case 'write-off':
                    if (index < 0) {
                        byProduct.push({
                            name: transaction.productName,
                            category: (transaction.productCategory ? transaction.productCategory : "Не вказано"),
                            productId: transaction.productId,
                            replQuantity: 0,
                            replMoney: 0,
                            writeMoney: transaction.quantity * (transaction.cost ? transaction.cost : transaction.price),
                            writeQuantity: transaction.quantity,
                            saleMoney: 0,
                            saleQuantity: 0
                        });
                    } else {
                        byProduct[index].writeMoney += transaction.quantity * (transaction.cost ? transaction.cost : transaction.price);
                        byProduct[index].writeQuantity += transaction.quantity;
                    }
                    main.writeOff += transaction.quantity * (transaction.cost ? transaction.cost : transaction.price);
                    break;
                case 'sale':
                    if (index < 0) {
                        byProduct.push({
                            name: transaction.productName,
                            category: (transaction.productCategory ? transaction.productCategory : "Не вказано"),
                            productId: transaction.productId,
                            replQuantity: 0,
                            replMoney: 0,
                            writeMoney: 0,
                            writeQuantity: 0,
                            saleMoney: transaction.quantity * (transaction.cost ? transaction.cost : transaction.price),
                            saleQuantity: transaction.quantity
                        });
                    } else {
                        byProduct[index].saleMoney += transaction.quantity * (transaction.cost ? transaction.cost : transaction.price);
                        byProduct[index].saleQuantity += transaction.quantity;
                    }
                    main.revenue += transaction.quantity * ((transaction.cost) ? (transaction.price - transaction.cost) : (transaction.price * 0.1))
                    main.sale += transaction.quantity * ((transaction.cost) ? transaction.cost : transaction.price);
                    break;
                case 'out-of-product':
                    if (transaction.additional) {
                        if (cyclesIndex < 0) {
                            cycles.push({
                                name: transaction.productName,
                                category: (transaction.productCategory ? transaction.productCategory : "Не вказано"),
                                productId: transaction.productId,
                                repl: transaction.additional.replenishTotal,
                                write: transaction.additional.writeOffTotal,
                                sale: transaction.additional.saleTotal,
                                dateEnd: moment(transaction.date).format('DD.MM.YY'),
                                count: 1
                            });
                            if(transaction.additional.dateStarted) {
                               cycles[cycles.length -1].dateStarted = moment(transaction.additional.dateStarted).format('DD.MM.YY');
                            } else {
                                cycles[cycles.length -1].dateStarted = 'До оновлення'; 
                            }
                        } else {
                            cycles[cyclesIndex].count++;
                            cycles[cyclesIndex].dateEnd = moment(transaction.date).format('DD.MM.YY');
                            cycles[cyclesIndex].repl += transaction.additional.replenishTotal;
                            cycles[cyclesIndex].write += transaction.additional.writeOffTotal;
                            cycles[cyclesIndex].sale += transaction.additional.saleTotal;
                        }
                    }
                    break;
            }
        });
        console.log(byProduct);
        console.log(main);
        res.render('report', {
            navClasses: navClasses,
            start: req.body.start,
            end: req.body.end,
            main: main,
            byProduct: byProduct,
            cycles: cycles
        });
    })
})

function findWithAttr(array, attr, value) {
    for (var i = 0; i < array.length; i += 1) {
        if (array[i][attr].equals(value)) {
            return i;
        }
    }
    return -1;
}

// Exports
module.exports = router;