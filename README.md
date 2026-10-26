# ⚖️ LEGAL AI AGENT — O‘zbekiston Huquqi Telegram Content Agenti (Node.js + TypeScript)

O‘zbekiston Respublikasi qonunchiligi bo‘yicha **100% to‘liq avtomatlashtirilgan ko‘p kanalli (Multi-channel) Node.js + TypeScript AI test agenti**. U har soatda (yoki belgilangan peak vaqtlarda) node-cron orqali mustaqil ravishda huquqiy mavzu tanlaydi, Google Gemini / OpenAI API va rasmiy davlat huquqiy manbalari (Lex.uz) asosida test yaratadi, AI Fact-Checker orqali tekshiradi va grammY bot orqali belgilangan barcha Telegram kanallarga avtomatik joylaydi.

---

## 🛠️ TECH STACK

- **Backend:** Node.js, TypeScript
- **Telegram Bot Framework:** grammY
- **AI Provider:** Google Gemini (`gemini-3.6-flash`, `gemini-2.5-flash`) / OpenAI
- **Ko‘p kanallik:** Bir vaqtning o‘zida istalgancha kanalni boshqarish, qo‘shish, pauza qilish va o‘chirish
- **Database:** SQLite & Prisma ORM
- **Scheduler:** node-cron (Tungi jimlik 23:00-07:00 va Peak hours 09:00, 13:00, 18:00, 21:00)
- **Keep-Alive:** O‘rnatilgan HTTP Health Server va Render 24/7 avto-ping
- **Logging:** Winston (`logs/app.log`)

---

## 🌟 ASOSIY IMKONIYATLAR:

1. **📢 Ko‘p Kanalli Boshqaruv (Multi-Channel):**
   - Admin xohlagancha kanal qo‘shishi mumkin (`@kanal_nomi` yoki kanal ID).
   - Har bir kanalni alohida pauzaga qo‘yish yoki faollashtirish imkoniyati.
   - Yangi test yaratilganda barcha faol kanallarga bir vaqtda yoki tanlangan alohida kanalga joylash.
2. **🧠 Avtonom AI Pipeline:**
   - 12 ta huquqiy mavzu bo‘yicha balansli savol tanlash.
   - Lex.uz rasmiy qonun kodekslari va moddalariga asoslangan to‘g‘ri javob va batafsil izoh.
   - AI Fact-Checker orqali tekshiruv va takrorlanishning oldini oluvchi Duplicate Checker.
3. **🌙 Tungi Jimlik Rejimi (Quiet Hours):**
   - Soat 23:00 dan 07:00 gacha obunachilarni bezovta qilmaslik uchun avtomatik to‘xtab turish.
4. **⭐ Peak Activity Hours:**
   - Obunachilar eng faol bo‘lgan vaqtlarda (09:00, 13:00, 18:00, 21:00) avtomatik post chiqarish.

---

## 🚀 QADAM-BA-QADAM O‘RNATISH VA ISHGA TUSHIRISH

### 1. Bog‘liqliklarni o‘rnatish

```bash
npm install
```

### 2. `.env` Faylini to‘ldirish

```env
BOT_TOKEN=7123456789:AAFxxx... (Telegram @BotFather tokeni)
CHANNEL_ID=@Huquq_study        (Boshlang'ich kanal username'i)
ADMIN_ID=123456789            (Sizning Telegram user_id-ingiz)

AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...       (Google AI Studio kaliti)
AI_MODEL=gemini-3.6-flash

POST_INTERVAL_HOURS=1
TIMEZONE=Asia/Tashkent
AUTO_POST=true
ADMIN_APPROVAL=false
DATABASE_URL="file:../data/legal_agent.db"
```

### 3. Ishga tushirish

```bash
# Rivojlantirish rejimi:
npm run dev

# Windows-da bitta bosishda:
start.bat

# Production (Server):
npm run build
npm start
```

---

## 🎛️ TELEGRAM ADMIN PANEL BUYRUQLARI

Telegram chatida botingizga `/admin` buyrug‘ini yuboring:

- `➕ YANGI TEST` — Yangi huquqiy test yaratish va preview qilish.
- `🚀 HOZIR JOYLASH` — Darhol kanallarga test chiqarish.
- `📢 KANALLAR` — Ulangan kanallarni ko‘rish, yangi kanal qo‘shish, pauza qilish yoki o‘chirish.
- `⏰ AVTO POST` — Avtomatik posting, Tungi Jimlik va Peak rejimlarini boshqarish.
- `📚 MAVZULAR` — 12 ta huquqiy mavzu ro‘yxati.
- `📝 TESTLAR` — Tarixdagi barcha testlar va natijalar.
- `📊 STATISTIKA` — Kanallar va postlar statistikasi.
- `⚙️ SOZLAMALAR` — Bot sozlamalari.
