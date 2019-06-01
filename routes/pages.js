var express = require('express');
var router = express.Router();

// Get Page model
var Page = require('../models/page');
var Order = require('../models/order');


var Product = require('../models/product');
/*
 * GET /
 */
router.get('/', function (req, res) {
    let navClasses = {
        'cas': 'active',
        'storage':''
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
    }
    res.redirect('/');
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
        if (product.category == "Пиво") {
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
                //adding bottle
                req.session.currentOrder.products.push({
                    name: p.title,
                    price: p.price,
                    quantity: 1,
                    _id: p.id
                });
                //updating total sum
                req.session.currentOrder.sum += p.price;
                req.session.currentOrder.sum += parseFloat(product.price) * parseFloat(quantity);
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
            console.log(req.session.currentOrder);
            res.redirect('/');
        }
    })
});

router.get('/check-out', (req, res) => {
    if (req.session.currentOrder.sum == 0) {
        res.redirect('/');
    } else {
        let customerMoney = (parseFloat(req.query.money))?parseFloat(req.query.money): 0; 

        //Decreasing quantity of all added products
        req.session.currentOrder.products.forEach((el) => {
            Product.findById(el._id, (err, doc) => {
                if(err){console.log(err); return;}
                console.log(doc);
                doc.quantity -= el.quantity;
                doc.save();
            });
        });
        let orderDate = new Date();
        let headline = ('0' + orderDate.getHours()).slice(-2) + ':' +  ('0' + orderDate.getMinutes()).slice(-2) + ' ' + ('0' + orderDate.getDate()).slice(-2) + '.' + ('0' + (orderDate.getMonth()+1)).slice(-2) + '.'  + orderDate.getFullYear();   
        var newOrder = new Order({
            products: req.session.currentOrder.products,
            date: orderDate,
            totalItemsCount: req.session.currentOrder.products.length,
            totalSum: parseInt(req.session.currentOrder.sum),
            headerStr: headline,
            customerMoney: customerMoney
        });
        newOrder.save((err) => {
            if(err){
                console.log(err);
                return res.redirect('/');
            }
            req.session.currentOrder = {
                products: [],
                sum: 0
            };
            res.redirect('/');
        })
    }
});

router.get('/storage', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage':'active'
    }
    Order.find({}, (err, orders) => {
        res.render('storage', {
            orders: orders,
            navClasses: navClasses
        })
    })
    
});

router.get('/checks', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage':'active'
    }
    Order.find({}, (err, orders) => {
        res.render('storage', {
            orders: orders,
            navClasses: navClasses
        })
    })
});

router.get('/balance', (req, res) => {
    let navClasses = {
        'cas': '',
        'storage':'active'
    }
    Product.find({}, (err, products) => {
        res.render('balance', {
            products: products,
            navClasses: navClasses
        })
    })
});


// Exports
module.exports = router;


