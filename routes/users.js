const express = require("express");
const { getDB, ObjectId } = require("../db");
const router = express.Router();

// GET /users - All users for admin
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection("user").find({}).sort({ createdAt: -1 }).toArray();
    const clean = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || "user",
      subscriptionTier: u.subscriptionTier || "free",
      image: u.image,
      createdAt: u.createdAt,
    }));
    res.json(clean);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// PATCH /users/:id/role - Update role
router.patch("/:id/role", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { role } = req.body;
    if (!["user", "artist", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role must be user, artist, or admin" });
    }
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    const resUpdate = await db.collection("user").updateOne(query, { $set: { role, updatedAt: new Date() } });
    if (resUpdate.matchedCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

// GET /users/profile - Get profile by email
router.get("/profile", async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = await db.collection("user").findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const purchaseCount = await db.collection("transactions").countDocuments({ buyerEmail: email, status: "completed" });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      subscriptionTier: user.subscriptionTier || "free",
      bio: user.bio || "",
      image: user.image || null,
      purchaseCount,
      wishlist: user.wishlist || []
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /users/profile - Update user profile
router.patch("/profile", async (req, res) => {
  try {
    const db = getDB();
    const { email, name, bio, image } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const update = { updatedAt: new Date() };
    if (name) update.name = name.trim();
    if (bio !== undefined) update.bio = bio.trim();
    if (image) update.image = image;
    await db.collection("user").updateOne({ email }, { $set: update });
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /users/wishlist - Toggle artwork in wishlist
router.post("/wishlist", async (req, res) => {
  try {
    const db = getDB();
    const { email, artworkId } = req.body;
    if (!email || !artworkId) return res.status(400).json({ error: "email and artworkId required" });
    const user = await db.collection("user").findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const wishlist = Array.isArray(user.wishlist) ? user.wishlist : [];
    const exists = wishlist.includes(artworkId);
    const nextWishlist = exists ? wishlist.filter(id => id !== artworkId) : [...wishlist, artworkId];
    await db.collection("user").updateOne({ email }, { $set: { wishlist: nextWishlist } });
    res.json({ success: true, wishlist: nextWishlist, added: !exists });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle wishlist" });
  }
});

// GET /users/wishlist - Get wishlist items
router.get("/wishlist", async (req, res) => {
  try {
    const db = getDB();
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = await db.collection("user").findOne({ email });
    const ids = user?.wishlist || [];
    const objIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const items = await db.collection("artworks").find({
      $or: [{ _id: { $in: objIds } }, { id: { $in: ids } }]
    }).toArray();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

// GET /users/top-artists - 3 artists with most sales for Home Page
router.get("/top-artists", async (req, res) => {
  try {
    const db = getDB();
    const topSales = await db.collection("transactions").aggregate([
      { $match: { type: "purchase", status: "completed", artistEmail: { $exists: true, $ne: "" } } },
      { $group: { _id: "$artistEmail", count: { $sum: 1 }, total: { $sum: "$amount" }, artistName: { $first: "$artistName" } } },
      { $sort: { count: -1, total: -1 } },
      { $limit: 3 }
    ]).toArray();

    let results = [];
    if (topSales.length >= 3) {
      for (const item of topSales) {
        const user = await db.collection("user").findOne({ email: item._id });
        results.push({
          name: item.artistName || user?.name || "Master Artist",
          email: item._id,
          salesCount: item.count,
          revenue: item.total,
          avatar: user?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
          bio: user?.bio || "Internationally acclaimed contemporary creator.",
        });
      }
    } else {
      const artists = await db.collection("user").find({ role: "artist" }).limit(3).toArray();
      results = artists.map((a, i) => ({
        name: a.name || ("Artist " + (i + 1)),
        email: a.email,
        salesCount: 15 + i * 8,
        revenue: (15 + i * 8) * 2200,
        avatar: a.image || [
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"
        ][i % 3],
        bio: a.bio || "Leading modern artist showcasing vibrant canvas and sculptural aesthetics."
      }));
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch top artists" });
  }
});

module.exports = router;
