var mongoose = require('mongoose');

var ProductSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    slug: {
        type: String
    },
    desc: String,   
    category: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number
    }
});

var Product = module.exports = mongoose.model('Product', ProductSchema);

