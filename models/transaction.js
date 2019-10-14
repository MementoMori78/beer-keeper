var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.Types.ObjectId;

var TransactionSchema = mongoose.Schema({
    productId: {
        type: ObjectId,
        required: true
    },
    orderId: {
        type: ObjectId,
        required: false
    },
    productName: {
        type: String,
        required: false
    },
    type: {
        type: String, // income, write-off, sale
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    quantity: {
        type: Number,
        default: 0,
        required: true
    },
    previousQuantity: {
        type: Number
    },
    price: {
        type: Number,
        default: 0
    },
    cost: {
        type: Number,
        default: 0
    },
    provider: {
        type: String,
        default: 'Постачальник не вказаний'
    },
    reason: {
        type: String,
        default: 'Причина не вказана'
    },
    additional: {
        type: Object
    }
});

var Transaction = module.exports = mongoose.model('Transaction', TransactionSchema);