// backend/routes/cart.js

const express = require("express");
const router = express.Router();

const Cart = require("../models/Cart");
const Stock = require("../models/Stock");
const auth = require("../middleware/auth");

const { getJSON, setJSON } = require("../redis");
const { CACHE_TTLS } = require("../config");

// Key helpers
function cartKey(userId) {
  return `cart:user:${userId}`;
}

function medicineKey(name) {
  return `stock:medicine:${name.toLowerCase()}`;
}

/* ============================
   ADD TO CART
============================ */
router.post("/add", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineName, quantity } = req.body;

    if (!medicineName) {
      return res.json({ error: "Medicine name is required" });
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;

    // ✅ 1) Try to get stock (pharmacyId) from Redis
    let stockDoc = await getJSON(medicineKey(medicineName));

    // ✅ 2) If not in Redis, go to Mongo and then cache it
    if (!stockDoc) {
      const mongoStock = await Stock.findOne({ medicineName });

      if (!mongoStock) {
        return res.json({ error: "Medicine not found in stock" });
      }

      stockDoc = mongoStock.toObject();
      await setJSON(medicineKey(medicineName), stockDoc, CACHE_TTLS.MEDICINE);
    }

    let cart = await Cart.findOne({ userId });

    const item = {
      medicineName,
      quantity: qty,
      pharmacyId: stockDoc.pharmacyId
    };

    if (!cart) {
      cart = await Cart.create({ userId, items: [item] });
    } else {
      cart.items.push(item);
      await cart.save();
    }

    const plainItems = cart.items.map(i => ({
      medicineName: i.medicineName,
      quantity: i.quantity,
      pharmacyId: i.pharmacyId
    }));

    // ✅ 3) Write-through: update Redis cart
    await setJSON(cartKey(userId), plainItems, CACHE_TTLS.CART);

    res.json({ message: "Added to cart", cart: plainItems });

  } catch (err) {
    console.error("Cart add error:", err);
    res.status(500).json({ error: "Failed to add to cart" });
  }
});


/* ============================
   GET CART ITEMS
============================ */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const key = cartKey(userId);

    // ✅ 1) Try Redis first
    const cached = await getJSON(key);
    if (cached && Array.isArray(cached)) {
      return res.json(cached);
    }

    // ✅ 2) Fallback to Mongo
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.json([]);
    }

    const plainItems = cart.items.map(i => ({
      medicineName: i.medicineName,
      quantity: i.quantity,
      pharmacyId: i.pharmacyId
    }));

    // ✅ 3) Save into Redis for next time
    await setJSON(key, plainItems, CACHE_TTLS.CART);

    res.json(plainItems);

  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).json({ error: "Failed to load cart" });
  }
});

module.exports = router;
