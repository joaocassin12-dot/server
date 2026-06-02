const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {
    return { phones: [], reminders: [] };
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function registerPhone(phone) {
  const db = readDB();
  if (!db.phones.includes(phone)) {
    db.phones.push(phone);
    writeDB(db);
  }
}

function upsertReminder(phone, item) {
  const db = readDB();
  const key = `${phone}__${item.id}`;
  const idx = db.reminders.findIndex(r => r._key === key);
  const record = {
    _key: key,
    id:    String(item.id),
    phone,
    title: item.title,
    note:  item.note  || null,
    cat:   item.cat   || 'outro',
    prio:  item.prio  || 'normal',
    date:  item.date,
    time:  item.time,
    valor: item.valor || null,
    sent:  false,
  };
  if (idx >= 0) db.reminders[idx] = record;
  else db.reminders.push(record);
  writeDB(db);
}

function deleteReminder(phone, id) {
  const db = readDB();
  const key = `${phone}__${id}`;
  db.reminders = db.reminders.filter(r => r._key !== key);
  writeDB(db);
}

function getDueReminders(date, time) {
  const db = readDB();
  return db.reminders.filter(r => r.date === date && r.time === time && !r.sent);
}

function markSent(key) {
  const db = readDB();
  const r = db.reminders.find(r => r._key === key);
  if (r) { r.sent = true; writeDB(db); }
}

module.exports = { registerPhone, upsertReminder, deleteReminder, getDueReminders, markSent };
