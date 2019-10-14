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
    cost: {
        type: Number
    },
    quantity: {
        type: Number
    },
    timestamps: [Date]
}, { usePushEach: true });

var Product = module.exports = mongoose.model('Product', ProductSchema);