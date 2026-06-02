require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const twilio  = require('twilio');
const db      = require('./database');

const app    = express();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM   = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

app.use(cors());
app.use(express.json());

// ── Health check ────────────────────────────────────────
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── Registra número do usuário ──────────────────────────
app.post('/register', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const normalized = normalizePhone(phone);
  db.registerPhone(normalized);

  console.log(`[REGISTER] ${normalized}`);

  // Manda mensagem de boas-vindas
  sendWhatsApp(normalized,
    `✅ *Assistente Pessoal conectado!*\n\n` +
    `Você receberá lembretes aqui no horário configurado.\n\n` +
    `Responda *PARAR* a qualquer momento para cancelar.`
  ).catch(() => {});

  res.json({ ok: true });
});

// ── Criar / atualizar / deletar lembrete ────────────────
app.post('/reminder', (req, res) => {
  const { action, phone, item } = req.body;
  if (!phone || !item) return res.status(400).json({ error: 'phone and item required' });

  const normalized = normalizePhone(phone);

  if (action === 'delete') {
    db.deleteReminder(normalized, item.id);
    console.log(`[DELETE] ${normalized} — #${item.id}`);
    return res.json({ ok: true });
  }

  if (action === 'create' || action === 'update') {
    if (item.done) {
      db.deleteReminder(normalized, item.id);
    } else {
      db.upsertReminder(normalized, item);
    }
    console.log(`[${action.toUpperCase()}] ${normalized} — ${item.title} — ${item.date} ${item.time}`);
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'invalid action' });
});

// ── Cron: verifica a cada minuto ────────────────────────
cron.schedule('* * * * *', async () => {
  const now   = new Date();
  const date  = toDateStr(now);
  const time  = toTimeStr(now);

  const due = db.getDueReminders(date, time);
  if (!due.length) return;

  console.log(`[CRON] ${time} — ${due.length} lembrete(s) para enviar`);

  for (const r of due) {
    try {
      const msg = buildMessage(r, date);
      await sendWhatsApp(r.phone, msg);
      db.markSent(r.id);
      console.log(`[SENT] → ${r.phone}: ${r.title}`);
    } catch (err) {
      console.error(`[ERRO] ${r.phone}:`, err.message);
    }
  }
});

// ── Helpers ─────────────────────────────────────────────
function buildMessage(r, today) {
  const valor = r.valor ? `\n💰 Valor: R$ ${parseFloat(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
  const note  = r.note  ? `\n📝 ${r.note}` : '';

  const catEmoji = {
    conta: '💳', estudo: '📚', saude: '❤️',
    pessoal: '👤', trabalho: '💼', aniversario: '🎂',
    email: '📧', outro: '📌'
  }[r.cat] || '🔔';

  return (
    `${catEmoji} *Lembrete: ${r.title}*${note}${valor}\n\n` +
    `🕐 Horário: ${r.time}\n` +
    `📅 Data: ${fmtDate(r.date)}${r.date === today ? ' *(HOJE)*' : ''}\n\n` +
    `_Abra o Assistente para marcar como concluído._`
  );
}

function sendWhatsApp(to, body) {
  return client.messages.create({
    from: FROM,
    to:   `whatsapp:${to}`,
    body,
  });
}

function normalizePhone(phone) {
  // garante formato +55... sem espaços
  return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function toTimeStr(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🤖 Servidor rodando na porta ${PORT}`);
  console.log(`   Twilio FROM: ${FROM}`);
});
