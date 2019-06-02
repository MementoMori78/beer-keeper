var mongoose = require('mongoose');

// Category Schema
var DayBalanceSchema = mongoose.Schema({
    orders: {
        type: Array
    },
    date: Date,
    totalSum: Number,
    headerStr: String,
    month: Number,
    day: Number,
    year: Number
    
}, { usePushEach: true });

var DayBalance = module.exports = mongoose.model('DayBalance', DayBalanceSchema);

