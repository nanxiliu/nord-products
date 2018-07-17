const mongoose = require('mongoose');

let styleIdSchema = new mongoose.Schema({
    styleId: String,
    dateCrawled: Date
});

let StyleId = mongoose.model('styleId', styleIdSchema);

module.exports = StyleId;