const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function seed() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "arthub-project-db");
    console.log("Connected for seeding...");

    const count = await db.collection("artworks").countDocuments();
    if (count < 8) {
      const samples = [
        { title: "Solitude in Amber", artistName: "Elena Rostova", artistEmail: "elena@arthub.com", category: "Painting", price: 2400, imageUrl: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Oil on Linen", description: "An evocative study of light and autumnal solitude on Belgian linen.", status: "available", featured: true, createdAt: new Date(Date.now() - 15 * 86400000) },
        { title: "Fluid Dreams", artistName: "Marcus Chen", artistEmail: "marcus@arthub.com", category: "Digital Art", price: 1850, imageUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Generative 3D", description: "Algorithmic fluid motion rendered in ultra-high fidelity.", status: "available", featured: true, createdAt: new Date(Date.now() - 12 * 86400000) },
        { title: "Vessel of Light", artistName: "David Okoro", artistEmail: "david@arthub.com", category: "Sculpture", price: 3600, imageUrl: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=85", year: "2025", medium: "Bronze & Travertine", description: "Sculpted bronze harmonized with natural Italian travertine stone.", status: "available", featured: true, createdAt: new Date(Date.now() - 10 * 86400000) },
        { title: "Whispers of the Horizon", artistName: "Maya Laurent", artistEmail: "maya@arthub.com", category: "Abstract", price: 2900, imageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Acrylic on Raw Canvas", description: "Vast horizons composed of earth pigments and fluid acrylics.", status: "available", featured: true, createdAt: new Date(Date.now() - 8 * 86400000) },
        { title: "Midnight Echo", artistName: "Elias Moreau", artistEmail: "elena@arthub.com", category: "Painting", price: 3100, imageUrl: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1200&q=85", year: "2025", medium: "Oil & Cold Wax", description: "Nocturnal depth achieved through layered wax and pigment.", status: "available", featured: true, createdAt: new Date(Date.now() - 6 * 86400000) },
        { title: "Inner Landscape No. 4", artistName: "Sofia Reed", artistEmail: "marcus@arthub.com", category: "Fine Art", price: 4200, imageUrl: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Mixed Media on Board", description: "Layered Japanese washi paper and natural mineral pigments.", status: "available", featured: true, createdAt: new Date(Date.now() - 4 * 86400000) },
        { title: "Soft Collision", artistName: "Amelia Stone", artistEmail: "david@arthub.com", category: "Contemporary", price: 2750, imageUrl: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Collage & Gouache", description: "A balanced composition of modern textures and organic forms.", status: "available", featured: false, createdAt: new Date(Date.now() - 3 * 86400000) },
        { title: "Forms of Light", artistName: "Arthur Blake", artistEmail: "maya@arthub.com", category: "Minimal", price: 1650, imageUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200&q=85", year: "2025", medium: "Cast Gypsum", description: "Pure geometric form playing with natural architectural light.", status: "available", featured: false, createdAt: new Date(Date.now() - 2 * 86400000) },
        { title: "Ephemeral Bloom", artistName: "Elena Rostova", artistEmail: "elena@arthub.com", category: "Painting", price: 3200, imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=85", year: "2026", medium: "Oil on Canvas", description: "Intricate floral forms bursting with vibrant oil hues.", status: "sold", featured: false, createdAt: new Date(Date.now() - 20 * 86400000) }
      ];
      await db.collection("artworks").insertMany(samples);
      console.log("Artworks seeded!");
    }

    const txnCount = await db.collection("transactions").countDocuments();
    if (txnCount < 2) {
      await db.collection("transactions").insertMany([
        { transactionId: "TXN-894120", type: "purchase", artworkTitle: "Ephemeral Bloom", amount: 3200, buyerEmail: "fahimhasan0867@gmail.com", buyerName: "Fahim Miah", artistName: "Elena Rostova", artistEmail: "elena@arthub.com", status: "completed", createdAt: new Date(Date.now() - 5 * 86400000) },
        { transactionId: "TXN-894121", type: "subscription", tier: "pro", amount: 9.99, buyerEmail: "fahimhasan0867@gmail.com", buyerName: "Fahim Miah", status: "completed", createdAt: new Date(Date.now() - 10 * 86400000) }
      ]);
      console.log("Transactions seeded!");
    }
    console.log("Seeding complete.");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await client.close();
  }
}
seed();
