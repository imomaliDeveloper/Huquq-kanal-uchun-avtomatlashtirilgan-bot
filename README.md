# ⚖️ LEGAL AI AGENT — O‘zbekiston Huquqi Telegram Content Agenti (Node.js + TypeScript)

O‘zbekiston Respublikasi qonunchiligi bo‘yicha **100% to‘liq avtomatlashtirilgan Node.js + TypeScript AI test agenti**. U har soatda (yoki belgilangan intervalda) node-cron orqali mustaqil ravishda huquqiy mavzu tanlaydi, OpenAI API va rasmiy davlat huquqiy manbalari asosida test yaratadi, AI Fact-Checker orqali tekshiradi, professional muqova rasmini generatsiya qiladi va grammY bot orqali Telegram kanalga avtomatik joylaydi.

---

## 🛠️ TECH STACK

- **Backend:** Node.js, TypeScript
- **Telegram Bot Framework:** grammY
- **AI Provider:** OpenAI API (gpt-4o-mini / gpt-4)
- **Image Generation:** Pollinations AI (bepul) / OpenAI DALL-E / SVG graphic card fallback
- **Database:** SQLite & Prisma ORM
- **Scheduler:** node-cron
- **Validation:** Zod
- **Logging:** Winston (`logs/app.log`)

---

## 🚀 QADAM-BA-QADAM O‘RNATISH VA ISHGA TUSHIRISH

### 1. Node.js o'rnatilganini tekshirish
Kompyuteringizda Node.js 18+ va npm o'rnatilgan bo'lishi kerak.

```bash
node -v
npm -v
```

### 2. NPM paketlarini o'rnatish

```bash
npm install
```

### 3. `.env` Faylini to'ldirish

Loyiha katalogidagi `.env.example` faylidan `.env` yaratib to'ldiring:

```env
BOT_TOKEN=7123456789:AAFxxx... (Telegram @BotFather tokeni)
CHANNEL_ID=-1001234567890     (Kanal ID-si)
ADMIN_ID=123456789            (Sizning Telegram user_id-ingiz)

AI_PROVIDER=openai
AI_API_KEY=sk-proj-...        (OpenAI API kalitingiz)
AI_MODEL=gpt-4o-mini

IMAGE_PROVIDER=pollinations   (pollinations, openai)
POST_INTERVAL_HOURS=1
TIMEZONE=Asia/Tashkent
AUTO_POST=true
ADMIN_APPROVAL=false
DATABASE_URL="file:../data/legal_agent.db"
```

### 4. Prisma Ma'lumotlar Bazasini Yaratish

```bash
npx prisma db push
```

### 5. Botni Ishga Tushirish

**Rivojlantirish (Dev) rejimi:**
```bash
npm run dev
```

**Bitta bosishda ishga tushirish (Windows batch):**
`start.bat` faylini ikki marta bosing.

**Build va Production rejimi:**
```bash
npm run build
npm start
```

---

## 🎛️ ADMIN PANEL BUYRUQLARI

Telegram chatida botingizga `/admin` buyrug'ini yuboring:

- `/admin` — Interaktiv boshqaruv paneli dashboardi.
- `/newtest` — Yangi test yaratish menyusi (Mavzu tanlash).
- `/post` — **DARHOL KANALGA TEST CHIQARISH** (Intervalni kutmasdan).
- `/auto` — Avtomatik postingni yoqish/o'chirish va intervalni sozlash (30m, 1h, 2h, 3h, 6h, 12h, 24h).
- `/stats` — Posting va AI generatsiyasi statistikasi dashboardi.
- `/history` — Tarixdagi testlar logi.
- `/stop` — Avtomatik postingni to'xtatish.
- `/resume` — Avtomatik postingni qayta tiklash.
