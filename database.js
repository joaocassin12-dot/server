const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
let client, db;

async function connect() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('assistente');
  await db.collection('reminders').createIndex({ date: 1, time: 1, sent: 1 });
  return db;
}

async function registerPhone(phone) {
  const database = await connect();
  await database.collection('phones').updateOne(
    { phone },
    { $set: { phone } },
    { upsert: true }
  );
}

async function upsertReminder(phone, item) {
  const database = await connect();
  const key = `${phone}__${item.id}`;
  await database.collection('reminders').updateOne(
    { _key: key },
    {
      $set: {
        _key:  key,
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
      }
    },
    { upsert: true }
  );
}

async function deleteReminder(phone, id) {
  const database = await connect();
  const key = `${phone}__${id}`;
  await database.collection('reminders').deleteOne({ _key: key });
}

async function getDueReminders(date, time) {
  const database = await connect();
  return database.collection('reminders')
    .find({ date, time, sent: false })
    .toArray();
}

async function markSent(key) {
  const database = await connect();
  await database.collection('reminders').updateOne(
    { _key: key },
    { $set: { sent: true } }
  );
}

module.exports = { registerPhone, upsertReminder, deleteReminder, getDueReminders, markSent };
