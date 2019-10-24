var express = require('express');
var router = express.Router();

var Order = require('../models/order');
var Transaction = require('../models/transaction');
var Category = require('../models/category');
var DayBalance = require('../models/dayBalance');
var Product = require('../models/product');

var moment = require('moment');
moment.locale('uk');

router.get('/del_product_from_db', function(req, res) {
    console.log(`GET [/del] params: id=${req.query.id}`);
    Product.remove({ _id: req.query.id }, (err) => {
        if (!err) {
            console.log(`Deleted id:${req.query.id}`);
            res.redirect('/storage/');
        } else {
            console.log(err);
        }
    });
});

router.get('/', (req, res) => {
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
    const recievedreplenishValue = parseFloat(req.body.quantity);
    if (!recievedreplenishValue || recievedreplenishValue < 0) {
        req.flash('error', `Некоректне значення для поповнення`);
        return res.redirect('/storage');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) {
            console.log(error);
            req.flash('error', 'Помилка при поповненні товару');
            return res.redirect('/storage');
        }
        product.quantity += recievedreplenishValue;
        product.save((err) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Помилка при поповненні товару');
                return res.redirect('/storage')
            }
            let newTransaction = new Transaction({
                productId: product._id,
                productName: product.title,
                productCategory: product.category,
                type: "replenishment",
                quantity: recievedreplenishValue,
                previousQuantity: product.quantity - recievedreplenishValue,
                price: product.price,
                cost: product.cost,
                provider: req.body.provider
            })
            newTransaction.save((err) => {
                if (!err) {
                    req.flash('success', `Успішно додано ${recievedreplenishValue.toFixed(2)} до кількості товару "${product.title}"`)
                    return res.redirect(`/storage`);
                }
                console.log(err);
                req.flash('warning', `Не вдалось зберегти операцію, однак успішно додано ${recievedreplenishValue.toFixed(2)} до кількості товару "${product.title}".`);
                res.redirect(`/storage`);
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
    const recievedRason = (req.body.reason) ? req.body.reason : null;
    if (!recievedWriteOffValue || recievedWriteOffValue < 0) {
        res.flash('error', 'Некоректна кількість до списання');
        return res.redirect('/storage');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) {
            console.log(`Error writing-off product with id ${req.query.id}: ${err}`);
            return res.redirect('/storage');
        }
        product.quantity -= recievedWriteOffValue;
        product.save((err) => {
            if (err) console.log(err);
            //creating transaction document
            let newTransaction = new Transaction({
                productId: product._id,
                productName: product.title,
                productCategory: product.category,
                price: product.price,
                cost: product.cost,
                type: "write-off",
                quantity: recievedWriteOffValue,
                previousQuantity: product.quantity + recievedWriteOffValue,
                reason: recievedRason
            })
            newTransaction.save((err) => {
                if (err) {
                    console.log(err)
                    req.flash('warning', 'Помилка збереження операції');
                    return res.redirect('/storage');
                }
                req.flash('success', `Успішно списано ${recievedWriteOffValue.toFixed(2)} з кількості товару "${product.title}"`)
                res.redirect('/storage');
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
        if (err) {
            req.flash('error', `Помилка при пошуку товару для редагування.`);
            return res.redirect('/storage')
        }
        Category.find({}, (err, categories) => {
            if (err) {
                req.flash('error', `Помилка при пошуку списку категорій.`);
                return res.redirect('/storage')
            }
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
        if (err) {
            req.flash('error', `Помилка при пошуку товару до редагування`);
            return res.redirect('/storage')
        }
        product.title = (req.body.title) ? req.body.title : product.title;
        product.price = parseFloat(req.body.price) ? parseFloat(req.body.price) : product.price;
        product.cost = parseFloat(req.body.cost) ? parseFloat(req.body.cost) : product.cost;
        product.category = req.body.category;
        product.save((err) => {
            if (err) {
                req.flash('error', `Помилка при збереженні змін у БД.`);
                return res.redirect('/storage')
            }
            req.flash('success', `Успішно відредаговано товар "${product.title}"`);
            res.redirect('/storage');
        });
    });
});

router.get('/create_product', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    Category.find({}, (err, categories) => {
        if (err) {
            req.flash('error', `Помилка при пошуку списку категорій.`);
            return res.redirect('/storage')
        }
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
        cost: req.body.cost,
        category: req.body.category,
        desс: 'desc',
        quantity: 0
    })

    newProduct.save((err) => {
        if (err) {
            req.flash('error', `Помилка при додаванні нового товару до БД.`);
            return res.redirect('/storage')
        }
        res.redirect('/storage');
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
        if (err) {
            req.flash('error', `Помилка при збереженні нової категорії у БД.`);
        } else {
            req.flash('success', `Успішно збережено категорію "${req.body.title}".`);
        }
        res.redirect('/storage/');
    });
});

router.get('/product', (req, res) => {

    let navClasses = {
        'cas': '',
        'storage': 'active'
    }
    if (!req.query.id) {
        req.flash('error', 'Не вказаний ID товару для перегляду')
        return res.redirect('/storage')
    }
    Product.findById(req.query.id, (err, product) => {
        if (err || !product) {
            console.log(err);
            req.flash('error', 'Помилка при пошуку товару за вказаним ID у БД');
            return res.redirect('/storage')
        }
        Transaction.find({ productId: req.query.id }, (err, _transactions) => {
            if (err) {
                console.log(err);
                req.flash('error', 'Помилка при пошуку операцій по даному товару');
                return res.redirect('/storage');
            }
            _transactions.sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            })
            const pagingSize = 15;
            const pagination = {
                pagingSize: pagingSize,
                pagesCount: Math.ceil(_transactions.length / pagingSize)
            }
            if (!parseInt(req.query.page)) {
                pagination.currPage = 1;
            } else if (parseInt(req.query.page) < 1 || parseInt(req.query.page) > pagination.pagesCount) {
                pagination.currPage = 1;
            } else {
                pagination.currPage = parseInt(req.query.page);
            }
            const trnToSend = _transactions.splice((pagination.currPage - 1) * pagination.pagingSize, pagination.pagingSize)
            res.render('product', {
                moment: moment,
                navClasses: navClasses,
                productInfo: product,
                transactions: trnToSend,
                pagination: pagination
            });
        });
    })
})

router.get('/out-of-product', (req, res) => {
    if (!req.query.id) {
        req.flash('error', 'Помилка. ID не вказаний');
        return res.redirect('/storage');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err || !product) {
            console.log(err);
            req.flash('error', 'Помилка при пошуку товару за вказаним ID');
            return res.redirect('/storage');
        }

        if (!product.timestamps) {
            product.timestamps = [new Date()];
        } else {
            product.timestamps.push(new Date());
        }
        if (product.timestamps.length < 2) {
            let newTrn = new Transaction({
                productId: product._id,
                productName: product.title,
                productCategory: product.category,
                type: "out-of-product",
                quantity: 0,
                previousQuantity: product.quantity
            })
            product.quantity = 0;
            product.save((err) => {
                if (err) {
                    console.log(err);
                    req.flash('error', 'Помилка при збереженні змін по товару у БД.');
                    return res.redirect('/storage');
                }
                newTrn.save((err) => {
                    if (err) {
                        console.log(err);
                        req.flash('error', 'Помилка при збереженні змін по товару у БД.');
                        return res.redirect('/storage');
                    }
                    req.flash('success', `Успішно зафіксовано закінчення товару "${product.title}"`);
                    res.redirect(`/storage/product?id=${product._id}`);
                })
            });
        } else {
            Transaction.find({
                productId: product._id,
                date: {
                    $gt: product.timestamps[product.timestamps.length - 2],
                    $lt: new Date()
                }
            }, (err, transactions) => {
                if (err) {
                    console.log(err);
                    req.flash('error', 'Помилка при пошуку операцій у БД.');
                    return res.redirect('/storage');
                } else {
                    let replenishSum = 0.;
                    let writeOffSum = 0.;
                    let saleSum = 0.;
                    transactions.forEach((trn) => {
                        switch (trn.type) {
                            case "sale":
                                saleSum += trn.quantity;
                                break;
                            case "replenishment":
                                replenishSum += trn.quantity;
                                break;
                            case "write-off":
                                writeOffSum += trn.quantity;
                                break;
                        }
                    });
                    let newTrn = new Transaction({
                        productId: product._id,
                        productName: product.title,
                        productCategory: product.category,
                        type: "out-of-product",
                        quantity: 0,
                        previousQuantity: product.quantity,
                        additional: {
                            dateStarted:  product.timestamps[product.timestamps.length - 2], 
                            saleTotal: saleSum,
                            writeOffTotal: writeOffSum,
                            replenishTotal: replenishSum
                        }
                    })
                    product.quantity = 0;
                    product.save((err) => {
                        if (err) {
                            console.log(err);
                            req.flash('error', 'Помилка при збереженні змін по товару у БД.');
                            return res.redirect('/storage');
                        }
                        newTrn.save((err) => {
                            if (err) {
                                console.log(err);
                                req.flash('error', 'Помилка при збереженні змін по товару у БД.');
                                return res.redirect('/storage');
                            }
                            req.flash('success', `Успішно зафіксовано закінчення товару "${product.title}"`);
                            res.redirect(`/storage/product?id=${product._id}`);
                        })
                    });
                }
            })
        }
    })
});

// Exports
module.exports = router;