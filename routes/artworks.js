const express = require("express");
const { getDB, ObjectId } = require("../db");
const router = express.Router();

// GET /artworks - Search, filter, paginate, sort
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const { search = "", category = "", minPrice, maxPrice, sort = "featured", page = 1, limit = 12, artistEmail, status } = req.query;
    const query = {};
    if (artistEmail) query.artistEmail = artistEmail;
    if (status && status !== "all") query.status = status;
    if (category && category.toLowerCase() !== "all") {
      query.category = { $regex: new RegExp("^" + category.trim() + "$", "i") };
    }
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ title: regex }, { artistName: regex }, { medium: regex }, { description: regex }];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    let sortObj = { createdAt: -1 };
    if (sort === "price-low") sortObj = { price: 1 };
    else if (sort === "price-high") sortObj = { price: -1 };
    else if (sort === "newest") sortObj = { createdAt: -1 };
    else if (sort === "featured") sortObj = { featured: -1, createdAt: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 12);
    const skip = (pageNum - 1) * limitNum;

    const total = await db.collection("artworks").countDocuments(query);
    const artworks = await db.collection("artworks").find(query).sort(sortObj).skip(skip).limit(limitNum).toArray();

    res.json({ artworks, total, totalPages: Math.ceil(total / limitNum) || 1, currentPage: pageNum });
  } catch (err) {
    console.error("Fetch artworks error:", err);
    res.status(500).json({ error: "Failed to fetch artworks" });
  }
});

// GET /artworks/featured - Top 6 featured artworks
router.get("/featured", async (req, res) => {
  try {
    const db = getDB();
    const artworks = await db.collection("artworks").find({ status: { $ne: "draft" } }).sort({ featured: -1, createdAt: -1 }).limit(6).toArray();
    res.json(artworks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch featured artworks" });
  }
});

// GET /artworks/:id - Single artwork with comments
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    let query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
    const artwork = await db.collection("artworks").findOne(query);
    if (!artwork) return res.status(404).json({ error: "Artwork not found" });
    const comments = await db.collection("comments").find({ artworkId: artwork._id.toString() }).sort({ createdAt: -1 }).toArray();
    res.json({ ...artwork, comments });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artwork" });
  }
});

// POST /artworks - Add artwork
router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const { title, description, category, price, imageUrl, artistId, artistName, artistEmail, medium, year, status = "available", featured = false } = req.body;
    if (!title || !price || !imageUrl) return res.status(400).json({ error: "Title, price, and image are required" });
    const doc = {
      title: title.trim(),
      description: (description || "").trim(),
      category: category || "Painting",
      price: Number(price),
      imageUrl,
      artistId: artistId || null,
      artistName: artistName || "Featured Artist",
      artistEmail: artistEmail || "",
      medium: medium || "Mixed Media",
      year: year || new Date().getFullYear().toString(),
      status: status || "available",
      featured: Boolean(featured),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("artworks").insertOne(doc);
    res.status(201).json({ success: true, artwork: { ...doc, _id: result.insertedId } });
  } catch (err) {
    res.status(500).json({ error: "Failed to create artwork" });
  }
});

// PUT /artworks/:id - Edit artwork
router.put("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const { title, description, category, price, imageUrl, status, featured, medium, year } = req.body;
    const updateData = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = Number(price);
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (status !== undefined) updateData.status = status;
    if (featured !== undefined) updateData.featured = Boolean(featured);
    if (medium !== undefined) updateData.medium = medium;
    if (year !== undefined) updateData.year = year;
    const result = await db.collection("artworks").updateOne({ _id: new ObjectId(id) }, { $set: updateData });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Artwork not found" });
    const updated = await db.collection("artworks").findOne({ _id: new ObjectId(id) });
    res.json({ success: true, artwork: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update artwork" });
  }
});

// DELETE /artworks/:id - Delete artwork
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const result = await db.collection("artworks").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Artwork not found" });
    await db.collection("comments").deleteMany({ artworkId: id });
    res.json({ success: true, message: "Artwork deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete artwork" });
  }
});

// POST /artworks/:id/comments - Purchase-verified commenting
router.post("/:id/comments", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { userId, userEmail, userName, userImage, comment } = req.body;
    if (!comment || !comment.trim()) return res.status(400).json({ error: "Comment text required" });
    if (!userEmail) return res.status(401).json({ error: "User authentication required" });

    // Verify purchase
    const purchase = await db.collection("transactions").findOne({
      artworkId: id,
      buyerEmail: userEmail,
      status: "completed"
    });
    const userDoc = await db.collection("user").findOne({ email: userEmail });
    const isAdmin = userDoc?.role === "admin";
    if (!purchase && !isAdmin) {
      return res.status(403).json({ error: "Only buyers of this artwork can leave comments." });
    }
    const newComment = {
      artworkId: id,
      userId: userId || (userDoc ? userDoc._id.toString() : ""),
      userEmail,
      userName: userName || userDoc?.name || "Collector",
      userImage: userImage || userDoc?.image || null,
      comment: comment.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const inserted = await db.collection("comments").insertOne(newComment);
    res.status(201).json({ success: true, comment: { ...newComment, _id: inserted.insertedId } });
  } catch (err) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// PUT /artworks/comments/:id - Edit own comment
router.put("/comments/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { comment, userEmail } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const existing = await db.collection("comments").findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: "Comment not found" });
    if (existing.userEmail !== userEmail) return res.status(403).json({ error: "Unauthorized" });
    await db.collection("comments").updateOne({ _id: new ObjectId(id) }, { $set: { comment: comment.trim(), updatedAt: new Date() } });
    res.json({ success: true, message: "Comment updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to edit comment" });
  }
});

// DELETE /artworks/comments/:id - Delete comment
router.delete("/comments/:id", async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { userEmail } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
    const existing = await db.collection("comments").findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).json({ error: "Comment not found" });
    const userDoc = userEmail ? await db.collection("user").findOne({ email: userEmail }) : null;
    if (existing.userEmail !== userEmail && userDoc?.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" });
    }
    await db.collection("comments").deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

module.exports = router;
