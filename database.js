const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'assistente.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS phones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
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
  );
`);

function registerPhone(phone) {
  db.prepare(`INSERT OR IGNORE INTO phones (phone) VALUES (?)`).run(phone);
}

function upsertReminder(phone, item) {
  db.prepare(`
    INSERT INTO reminders (id, phone, title, note, cat, prio, date, time, valor, sent)
    VALUES (@id, @phone, @title, @note, @cat, @prio, @date, @time, @valor, 0)
    ON CONFLICT(id, phone) DO UPDATE SET
      title=excluded.title, note=excluded.note, cat=excluded.cat,
      prio=excluded.prio,   date=excluded.date, time=excluded.time,
      valor=excluded.valor, sent=0
  `).run({
    id:    String(item.id),
    phone,
    title: item.title,
    note:  item.note  || null,
    cat:   item.cat   || 'outro',
    prio:  item.prio  || 'normal',
    date:  item.date,
    time:  item.time,
    valor: item.valor || null,
  });
}

function deleteReminder(phone, id) {
  db.prepare(`DELETE FROM reminders WHERE phone=? AND id=?`).run(phone, String(id));
}

// Retorna lembretes que devem ser enviados agora (date + time == agora, ainda não enviados)
function getDueReminders(date, time) {
  return db.prepare(`
    SELECT * FROM reminders
    WHERE date=? AND time=? AND sent=0
    ORDER BY phone
  `).all(date, time);
}

function markSent(rowId) {
  db.prepare(`UPDATE reminders SET sent=1 WHERE rowid=?`).run(rowId);
}

module.exports = { registerPhone, upsertReminder, deleteReminder, getDueReminders, markSent };
