var mongoose = require('mongoose');

// Category Schema
var CategorySchema = mongoose.Schema({
   
    title: {
        type: String,
        required: true
    }
});

var Category = module.exports = mongoose.model('Category', CategorySchema);

