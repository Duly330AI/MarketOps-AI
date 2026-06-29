import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

async function test() {
  const asset = db.assets[0];
  console.log("Input asset:", asset);
  
  // Call the API endpoint
  const res = await fetch('http://localhost:3000/api/state');
  const data = await res.json();
  console.log("Output asset from API:", data.assets[0]);
}
test();
