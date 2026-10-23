const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI not set");

let client;
let db;

async function connectDB() {
  if (db) return { db, client };
  
  client = new MongoClient(uri);
  
  await client.connect();
  
  db = client.db(process.env.DB_NAME || "arthub-project-db");
 
  console.log("Connected to MongoDB:", db.databaseName);
  return { db, client };
}

function getDB() {
  if (!db) throw new Error("Database not connected");
  return db;
}

module.exports = { connectDB, getDB, ObjectId };
