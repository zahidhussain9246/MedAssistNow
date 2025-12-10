const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

router.post("/update-location", auth, async (req, res) => {
  if (req.user.role !== "delivery")
    return res.status(403).json({ error: "Only delivery staff" });

  const { lat, lon } = req.body;
  if (!lat || !lon)
    return res.status(400).json({ error: "Missing lat/lon" });

  await User.findByIdAndUpdate(req.user.id, {
    location: { lat, lon }
  });

  return res.json({ success: true });
});

module.exports = router;
