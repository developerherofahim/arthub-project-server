const express = require("express");
const { getDB } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const router = express.Router();

// GET /analytics/admin
router.get("/admin", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const db = getDB();
    const [totalUsers, totalArtists, totalSold, totalArtworks, transactions] = await Promise.all([
      db.collection("user").countDocuments({}),
      db.collection("user").countDocuments({ role: "artist" }),
      db.collection("transactions").countDocuments({ type: "purchase", status: "completed" }),
      db.collection("artworks").countDocuments({}),
      db.collection("transactions").find({ status: "completed" }).toArray(),
    ]);

    const totalRevenue = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesMap = {};
    months.forEach(m => salesMap[m] = 0);
    transactions.forEach(t => {
      const m = months[new Date(t.createdAt || Date.now()).getMonth()];
      salesMap[m] = (salesMap[m] || 0) + (Number(t.amount) || 0);
    });
    const salesTrend = Object.keys(salesMap).map(m => ({ month: m, sales: salesMap[m] }));

    const categoryAgg = await db.collection("artworks").aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    const categoryDistribution = categoryAgg.map(c => ({ name: c._id || "Other", value: c.count }));

    res.json({
      totalUsers,
      totalArtists,
      totalSold,
      totalArtworks,
      totalRevenue: Math.round(totalRevenue),
      salesTrend,
      categoryDistribution
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin analytics" });
  }
});

// GET /analytics/artist/:email
router.get("/artist/:email", requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.params;
    if (req.auth.role !== "admin" && (req.auth.role !== "artist" || email !== req.auth.email)) {
      return res.status(403).json({ error: "You can only view your own artist analytics." });
    }
    const [totalArtworks, activeListings, sales] = await Promise.all([
      db.collection("artworks").countDocuments({ artistEmail: email }),
      db.collection("artworks").countDocuments({ artistEmail: email, status: "available" }),
      db.collection("transactions").find({ artistEmail: email, type: "purchase", status: "completed" }).toArray(),
    ]);
    const totalEarnings = sales.reduce((sum, s) => sum + (Number(s.amount) || 0) * 0.85, 0);
    res.json({
      totalArtworks,
      activeListings,
      itemsSold: sales.length,
      totalEarnings: Math.round(totalEarnings)
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artist analytics" });
  }
});

module.exports = router;
