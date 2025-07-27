const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const STORAGE_DIR = path.join(__dirname, 'storage');
const JSON_PATH = path.join(STORAGE_DIR, 'metadata.json');
const DB_PATH = path.join(STORAGE_DIR, 'board.sqlite');

// Load the old metadata
const raw = fs.readFileSync(JSON_PATH, 'utf-8');
const data = JSON.parse(raw);

// Ensure the database and table exist
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS board_data (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  data TEXT NOT NULL
)`);

db.prepare('INSERT OR REPLACE INTO board_data (id, data) VALUES (1, ?)')
  .run(JSON.stringify(data, null, 2));

console.log('Migration complete.');