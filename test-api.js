const dns = require(" node:dns\);
dns.setServers([\8.8.8.8\, \8.8.4.4\]);
require(\dotenv\).config();
const { connectDB, getDB } = require(\./db\);

async function testBackend() {
 console.log(\Running backend verification tests...\);
 const { db, client } = await connectDB();
 
 // Test 1: Artworks
 const artworks = await db.collection(\artworks\).find({}).limit(5).toArray();
 console.log(\? Artworks found in DB:\, artworks.length);

 // Test 2: Users
 const admin = await db.collection(\user\).findOne({ email: \admin@arthub.com\ });
 console.log(\? Admin user verified:\, admin ? admin.email : \missing\);

 // Test 3: Transactions
 const txns = await db.collection(\transactions\).find({}).limit(2).toArray();
 console.log(\? Transactions found:\, txns.length);

 console.log(\All backend smoke tests passed!\);
 await client.close();
}

testBackend().catch(console.error);
