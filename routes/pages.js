var express = require('express');
var router = express.Router();

// Get Page model
var Page = require('../models/page');


var Product = require('../models/product');
/*
 * GET /
 */
router.get('/', function (req, res) {
    if (typeof req.session.currentOrder === "undefined") {
        req.session.currentOrder = {
            products: [],
            sum: 0
        };
    }
    Product.find({}, (err, products) => {
        if (err) {
            console.log(error);
            res.render('index', { products: [], order: req.session.currentOrder })
        } else {
            res.render('index', {
                products: products,
                order: req.session.currentOrder
            })
        }
    });
});

router.get('/del_product', function (req, res) {
    console.log(`GET [/del] params: id=${req.query.id} [${typeof req.query.id}] quantity=${req.query.quantity} [${typeof req.query.quantity}]`);
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
            let addStr = '0.5';
            if(parseFloat(quantity) == 0.5){
                addStr = '0.5';
            }
            if(parseFloat(quantity) == 1.0){
                addStr = '1.0';
            }
            if(parseFloat(quantity) == 1.5){
                addStr = '1.5';
            }
            if(parseFloat(quantity) == 2.0){
                addStr = '2.0';
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
                    _id: id
                });
                //updating total sum
                req.session.currentOrder.sum += p.price;
                req.session.currentOrder.sum += parseFloat(product.price) * parseFloat(quantity);
                console.log(req.session.currentOrder);
                res.redirect('/');
            });
        } else {
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



// Exports
module.exports = router;


