const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'storage', 'board.sqlite');
if (!fs.existsSync(DB_PATH)) {
  console.error('board.sqlite not found at', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
const row = db.prepare('SELECT data FROM board_data WHERE id = 1').get();
if (!row || typeof row.data !== 'string') {
  console.error('No board data found.');
  process.exit(1);
}

const boardData = JSON.parse(row.data);
for (const [id, task] of Object.entries(boardData.tasks)) {
  if (task.taskFolderPath) {
    if (task.taskFolderPath.startsWith('/storage/tasks/')) {
      task.taskFolderPath = `项目/${id}`;
    } else if (task.taskFolderPath.startsWith('tasks/')) {
      task.taskFolderPath = `项目/${id}`;
    }
  } else {
    task.taskFolderPath = `项目/${id}`;
  }
}

db.prepare('UPDATE board_data SET data = ? WHERE id = 1').run(
  JSON.stringify(boardData, null, 2)
);

console.log('Migration complete. Updated taskFolderPath values.');