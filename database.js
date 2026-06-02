const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'assistente.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

// Inicializa tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS phones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reminders (
    id          TEXT    NOT NULL,
    phone       TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    note        TEXT,
    cat         TEXT    DEFAULT 'outro',
    prio        TEXT    DEFAULT 'normal',
    date        TEXT    NOT NULL,
    time        TEXT    NOT NULL,
    valor       REAL,
    sent        INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (id, phone)
  )`);
});

function registerPhone(phone) {
  db.run(`INSERT OR IGNORE INTO phones (phone) VALUES (?)`, [phone]);
}

function upsertReminder(phone, item) {
  db.run(`
    INSERT INTO reminders (id, phone, title, note, cat, prio, date, time, valor, sent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(id, phone) DO UPDATE SET
      title=excluded.title, note=excluded.note, cat=excluded.cat,
      prio=excluded.prio,   date=excluded.date, time=excluded.time,
      valor=excluded.valor, sent=0
  `, [
    String(item.id), phone, item.title, item.note || null,
    item.cat || 'outro', item.prio || 'normal',
    item.date, item.time, item.valor || null
  ]);
}

function deleteReminder(phone, id) {
  db.run(`DELETE FROM reminders WHERE phone=? AND id=?`, [phone, String(id)]);
}

function getDueReminders(date, time) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT rowid, * FROM reminders WHERE date=? AND time=? AND sent=0 ORDER BY phone`,
      [date, time],
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });
}

function markSent(rowId) {
  db.run(`UPDATE reminders SET sent=1 WHERE rowid=?`, [rowId]);
}

module.exports = { registerPhone, upsertReminder, deleteReminder, getDueReminders, markSent };
