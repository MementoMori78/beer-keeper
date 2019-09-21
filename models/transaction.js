var mongoose = require('mongoose');

var ObjectId = mongoose.Schema.Types.ObjectId;

var TransactionSchema = mongoose.Schema({
    productId: {
        type: ObjectId, 
        required: true
    },
    productName: {
        type: String,
        required: false
    },
    type: {
        type: String, // income, write-off
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
    previousQuantitiy: {
        type: Number
    },
    aditional: {
        type: Object,
        requried: false
    }    
});

var Transaction = module.exports = mongoose.model('Transaction', TransactionSchema);