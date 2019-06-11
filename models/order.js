var mongoose = require('mongoose');

// Category Schema
var OrderSchema = mongoose.Schema({

    products: {
        type: Array
    },
    date: Date,
    totalItemsCount: Number,
    totalSum: Number,
    headerStr: String,
    customerMoney: Number,
    discount: Number, 
    discountSum: Number
});

var Order = module.exports = mongoose.model('Order', OrderSchema);

