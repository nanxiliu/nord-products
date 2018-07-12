const mongoose = require('mongoose');

let productSchema = new mongoose.Schema({
    name: String,
    brand: String,
    description: String,
    dateCrawled: Date
});

let Product = mongoose.model('Product', productSchema);

module.exports = Product;