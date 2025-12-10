const mongoose = require("mongoose");

const StockSchema = new mongoose.Schema({
    pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicineName: { type: String, required: true },
    quantity: { type: Number, required: true },
    batchNo: String,
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Stock", StockSchema);
