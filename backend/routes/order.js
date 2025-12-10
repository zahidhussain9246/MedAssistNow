// backend/routes/order.js
const { publishEvent } = require("../rabbitmq"); // 🐇 NEW

const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Stock = require("../models/Stock");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const auth = require("../middleware/auth");
const { delKey } = require("../redis");   // 🟢 ADD THIS AT TOP

// Earning + ETA constants
const BASE_EARNING_PER_ORDER = 30;    // ₹30 base
const PER_KM_EARNING = 5;             // ₹5 per km
const AVERAGE_SPEED_KMPH = 25;        // 25 km/h assumed for ETA


// 🔔 Socket helpers
const {
  notifyPharmacyOrdersChanged,
  notifyDeliveryReadyOrdersChanged,
  notifyUserOrdersChanged
} = require("../socket");

function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const toRad = (x) => (x * Math.PI) / 180;

  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
// =====================================
// PLACE ORDER
// POST /api/order/place
// =====================================
router.post("/place", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { location } = req.body; // may be undefined

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.json({ error: "Cart is empty" });
    }

    const user = await User.findById(userId);
    const userLocation = location || user.location || null;

    // 1) FIND NEAREST PHARMACY (using userLocation)
    let pharmacyId = cart.items[0].pharmacyId;

    if (userLocation) {
      const ids = [
        ...new Set(
          cart.items
            .map((i) => i.pharmacyId && i.pharmacyId.toString())
            .filter(Boolean)
        )
      ];

      if (ids.length > 0) {
        const pharmacies = await User.find({
          _id: { $in: ids },
          role: "pharmacist",
          "location.lat": { $ne: null }
        });

        if (pharmacies.length > 0) {
          let best = pharmacies[0];
          let bestDist = distanceKm(userLocation, best.location);

          for (let i = 1; i < pharmacies.length; i++) {
            const d = distanceKm(userLocation, pharmacies[i].location);
            if (d < bestDist) {
              best = pharmacies[i];
              bestDist = d;
            }
          }

          pharmacyId = best._id;
        }
      }
    }

    // 2) CREATE INITIAL ORDER (status = pending, NO deliveryId)
    let order = await Order.create({
      userId,
      pharmacyId,
      userAddress: user.address,
      userLocation: userLocation,
      status: "pending",
      orderedAt: new Date(),
      items: cart.items
    });

    // 3) DECREASE STOCK
    for (const item of cart.items) {
      await Stock.findOneAndUpdate(
        { pharmacyId: item.pharmacyId, medicineName: item.medicineName },
        { $inc: { quantity: -item.quantity } }
      );
    }

    // 4) CLEAR CART (Mongo + Redis)
    cart.items = [];
    await cart.save();
    await delKey(`cart:user:${userId}`);

    // 5) REAL-TIME
    notifyPharmacyOrdersChanged();   // pharmacy sees new pending order
    notifyUserOrdersChanged(userId); // user sees order in history

    // 6) RABBITMQ EVENT
    publishEvent("order.created", {
      orderId: order._id.toString(),
      userId,
      pharmacyId,
      deliveryId: order.deliveryId || null, // should be null here
      status: order.status,
      items: order.items,
      createdAt: order.orderedAt
    });

    return res.json({
      message: "Order placed (waiting for pharmacy to confirm)",
      order
    });

  } catch (err) {
    console.error("Order error:", err);
    return res.status(500).json({ error: "Failed to place order" });
  }
});




// =====================================
// GET ORDERS FOR PHARMACY
// =====================================
router.get("/pharmacy", auth, async (req, res) => {
  try {
    const pharmacyId = req.user.id;

    const orders = await Order.find({ pharmacyId }).sort({ orderedAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Order fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/delivery/ready", auth, async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ["ready", "out-for-delivery"] }
    }).sort({ orderedAt: -1 });

    const enriched = [];

    for (const o of orders) {
      const order = o.toObject();

      let pharmacyToUserKm = 0;
      let expectedEarning = BASE_EARNING_PER_ORDER;

      try {
        const pharmacy = await User.findById(order.pharmacyId);

        if (
          pharmacy &&
          pharmacy.location &&
          order.userLocation &&
          typeof order.userLocation.lat === "number" &&
          typeof order.userLocation.lon === "number"
        ) {
          pharmacyToUserKm = distanceKm(
            pharmacy.location,
            order.userLocation
          );
        }
      } catch (e) {
        console.error("Error computing pharmacy → user distance:", e);
      }

      // Earning preview must match /delivery/delivered logic
      expectedEarning =
        BASE_EARNING_PER_ORDER + pharmacyToUserKm * PER_KM_EARNING;

      order.distancePharmacyToUserKm = pharmacyToUserKm;
      order.expectedEarning = expectedEarning;

      enriched.push(order);
    }

    return res.json(enriched);
  } catch (err) {
    console.error("Delivery ready error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});





// =====================================
// UPDATE ORDER STATUS (pharmacy)
// =====================================
// UPDATE ORDER STATUS (pharmacy)
router.put("/status/:id", auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // CAN'T MODIFY DELIVERED ORDER
    if (order.status === "delivered") {
      return res.json({ error: "Cannot update a delivered order" });
    }

    // CAN'T MODIFY ONCE DELIVERY PARTNER PICKED IT
    if (order.status === "out-for-delivery") {
      return res.json({ error: "Order already picked by delivery partner" });
    }

    order.status = status;
    await order.save();

    // REAL-TIME
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);

    if (status === "ready") {
      notifyDeliveryReadyOrdersChanged(); // delivery sees it in ready list
    }

    // RabbitMQ
    publishEvent("order.status.updated", {
      orderId: order._id.toString(),
      status: order.status,
      userId: order.userId,
      pharmacyId: order.pharmacyId
    });

    res.json({ message: "Status updated", order });

  } catch (err) {
    console.error("Order status update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =====================================
// GET READY + OUT FOR DELIVERY ORDERS
// =====================================


// =====================================
// DELIVERY ACCEPT ORDER
// =====================================
// =====================================
// DELIVERY ACCEPT ORDER
// =====================================
router.put("/delivery/accept/:id", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // Only ready orders can be accepted
    if (order.status !== "ready") {
      return res.json({ error: "Only ready orders can be accepted" });
    }

    order.status = "out-for-delivery";
    order.deliveryId = deliveryId;
    order.pickedUp = false;
    order.pickedUpAt = null;

    await order.save();

    // get pharmacy location for navigation
    const pharmacy = await User.findById(order.pharmacyId);
    const pharmacyLocation = pharmacy && pharmacy.location ? pharmacy.location : null;

    // 🔔 REAL-TIME
    notifyDeliveryReadyOrdersChanged();
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);

    // 🐇 RabbitMQ event: delivery accepted
    publishEvent("order.delivery.accepted", {
      orderId: order._id.toString(),
      deliveryId,
      userId: order.userId,
      pharmacyId: order.pharmacyId
    });

    return res.json({
      message: "Order accepted. Navigate to pharmacy.",
      order,
      pharmacyLocation,             // for Google Maps to pharmacy
      userLocation: order.userLocation || null  // kept for later if needed
    });

  } catch (err) {
    console.error("Delivery accept error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// =====================================
// DELIVERY PICKUP ORDER (AT PHARMACY)
router.put("/delivery/pickup/:id", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    if (!order.deliveryId || order.deliveryId.toString() !== deliveryId) {
      return res.status(403).json({ error: "This order is not assigned to you" });
    }

    if (order.status !== "out-for-delivery") {
      return res.json({ error: "Order is not out for delivery" });
    }

    if (order.pickedUp) {
      // already picked up, just return user location again
      return res.json({
        message: "Order already picked up. Navigate to user.",
        order,
        userLocation: order.userLocation || null,
        userAddress: order.userAddress || null
      });
    }

    order.pickedUp = true;
    order.pickedUpAt = new Date();
    await order.save();

    notifyDeliveryReadyOrdersChanged();
    notifyPharmacyOrdersChanged();
    notifyUserOrdersChanged(order.userId);

    publishEvent("order.delivery.picked-up", {
      orderId: order._id.toString(),
      deliveryId,
      userId: order.userId,
      pharmacyId: order.pharmacyId
    });

    return res.json({
      message: "Order picked up. Navigate to user.",
      order,
      userLocation: order.userLocation || null,
      userAddress: order.userAddress || null
    });

  } catch (err) {
    console.error("Delivery pickup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});





// =====================================
// DELIVERY COMPLETES ORDER
// =====================================
// =====================================
// DELIVERY COMPLETES ORDER + HYBRID EARNING
// =====================================
router.put("/delivery/delivered/:id", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) return res.json({ error: "Order not found" });

    // Prevent double-delivery
    if (order.status === "delivered") {
      return res.json({ message: "Order already delivered", order });
    }

    // 1) Mark as delivered
    order.status = "delivered";
    order.deliveredAt = new Date();

    // 2) Compute distance pharmacy → user (for earnings)
    let distance = 0;

    try {
      const pharmacy = await User.findById(order.pharmacyId);
      const userLocation = order.userLocation;

      if (pharmacy && pharmacy.location && userLocation && typeof userLocation.lat === "number" && typeof userLocation.lon === "number") {
        distance = distanceKm(pharmacy.location, userLocation);
      }
    } catch (e) {
      console.error("Error computing distance for earnings:", e);
      distance = 0;
    }

    // 3) Hybrid earning calculation
    const baseEarning = BASE_EARNING_PER_ORDER;
    const distanceEarning = distance * PER_KM_EARNING;
    const totalEarning = baseEarning + distanceEarning;

    // 4) Store on order
    order.distanceKm = distance;
    order.baseEarning = baseEarning;
    order.distanceEarning = distanceEarning;
    order.totalEarning = totalEarning;

    await order.save();

    // 5) REAL-TIME UPDATES
    notifyDeliveryReadyOrdersChanged();     // remove from ready list
    notifyPharmacyOrdersChanged();         // pharmacy history updates
    notifyUserOrdersChanged(order.userId); // user sees delivered

    // 6) 🐇 RabbitMQ event: delivered + earnings
    publishEvent("order.delivered", {
      orderId: order._id.toString(),
      userId: order.userId,
      deliveryId: order.deliveryId,
      pharmacyId: order.pharmacyId,
      deliveredAt: order.deliveredAt,
      distanceKm: order.distanceKm,
      baseEarning: order.baseEarning,
      distanceEarning: order.distanceEarning,
      totalEarning: order.totalEarning
    });

    return res.json({
      message: "Order delivered and earnings calculated",
      order
    });

  } catch (err) {
    console.error("Delivery complete error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


// =====================================
// ORDER HISTORY — USER
// =====================================
// =====================================
// ORDER HISTORY — USER (with ETA)
// =====================================
router.get("/history/user", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId }).sort({ orderedAt: -1 });

    // For each order that is out-for-delivery, compute ETA from driver → user
    const enriched = [];
    for (const o of orders) {
      const order = o.toObject();

      if (order.status === "out-for-delivery" && order.deliveryId && order.userLocation) {
        try {
          const driver = await User.findById(order.deliveryId);

          if (
            driver &&
            driver.location &&
            typeof driver.location.lat === "number" &&
            typeof driver.location.lon === "number" &&
            typeof order.userLocation.lat === "number" &&
            typeof order.userLocation.lon === "number"
          ) {
            const dist = distanceKm(driver.location, order.userLocation); // in km

            // ETA in minutes
            const etaMinutes = (dist / AVERAGE_SPEED_KMPH) * 60;

            // Rounded ETA for UI
            order.etaMinutes = Math.max(1, Math.round(etaMinutes));
          }
        } catch (e) {
          console.error("Failed to compute ETA for order", order._id, e);
        }
      }

      enriched.push(order);
    }

    return res.json(enriched);
  } catch (err) {
    console.error("User history error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});



// =====================================
// ORDER HISTORY — PHARMACY
// =====================================
router.get("/history/pharmacy", auth, async (req, res) => {
  try {
    const pharmacyId = req.user.id;

    const orders = await Order.find({ pharmacyId }).sort({ orderedAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Pharmacy history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =====================================
// ORDER HISTORY — DELIVERY
// =====================================
// ORDER HISTORY — DELIVERY
router.get("/history/delivery", auth, async (req, res) => {
  try {
    const deliveryId = req.user.id;

    const orders = await Order.find({ deliveryId }).sort({ deliveredAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Delivery history error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
