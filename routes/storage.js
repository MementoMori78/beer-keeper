var express = require('express');
var router = express.Router();

var Order = require('../models/order');
var Transaction = require('../models/transaction');
var Category = require('../models/category');
var DayBalance = require('../models/dayBalance');
var Product = require('../models/product');

var moment = require('moment');
moment.locale('uk');

router.get('/del_product_from_db', function (req, res) {
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
        return res.redirect('/storage/balance');
    }
    Product.findById(req.query.id, (err, product) => {
        if (err) {
            console.log(error);
            req.flash('error', 'Помилка при поповненні товару');
            return res.redirect('/storage/balance');
        }
        product.quantity += recievedreplenishValue;
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
                quantity: recievedreplenishValue,
                previousQuantitiy: product.quantity - recievedreplenishValue
            })
            newTransaction.save((err) => {
                if (!err) {
                    req.flash('success', `Успішно додано ${recievedreplenishValue.toFixed(2)} до кількості товару "${product.title}"`)
                    return res.redirect(`/balance`);
                }
                console.log(err);
                req.flash('warning', `Не вдалось зберегти операцію, однак успішно додано ${recievedreplenishValue.toFixed(2)} до кількості товару "${product.title}".`);
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
                type: "write-off",
                quantity: recievedWriteOffValue,
                previousQuantitiy: product.quantity + recievedWriteOffValue
            })

            newTransaction.save((err) => {
                if (err) {
                    req.flash('warning', 'Помилка збереження операції');
                    res.redirect('/storage');
                }
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
        product.category = req.body.category;
        product.save((err) => {
            if (err) {
                req.flash('error', `Помилка при збереженні змін у БД.`);
                return res.redirect('/storage')
            }
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
    if(!req.query.id){
        req.flash('error', 'Не вказаний ID товару для перегляду')
        return res.redirect('/storage')
    }
    Product.findById(req.query.id, (err, product) => {
        if(err) {
            console.log(err);
            req.flash('error', 'Помилка при пошуку товару за вказаним ID у БД');
            return res.redirect('/storage') 
        }
        res.render('product', {
            navClasses: navClasses,
            productInfo: product
        })
    })
})

// Exports
module.exports = router;