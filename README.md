# ⚖️ LEGAL AI AGENT & O‘QUVCHILAR MONITORING TIZIMI (Node.js + TypeScript)

O‘zbekiston Respublikasi qonunchiligi bo‘yicha **100% to‘liq avtomatlashtirilgan ko‘p kanalli (Multi-channel) AI test agenti va kuchli o‘quvchilar nazorati (monitoring) tizimi**. 

U nafaqat Google Gemini / OpenAI API va rasmiy Lex.uz qonunchiligi asosida testlar yaratib Telegram kanallarga chiqaradi, balki **har bir o‘quvchi/bola testni qachon yechgani, to‘g‘ri yoki xato javob bergani, kimlar hali testni topshirmagani (qoloqlar)ni 100% qat’iy nazorat qiladi** va yechmaganlarga bitta tugma orqali shaxsiy ogohlantirish (eslatma) yubora oladi!

---

## 🛠️ TECH STACK

- **Backend:** Node.js, TypeScript
- **Telegram Bot Framework:** grammY
- **AI Provider:** Google Gemini (`gemini-3.6-flash`, `gemini-2.5-flash`) / OpenAI
- **Ko‘p kanallik:** Bir vaqtning o‘zida istalgancha kanalni boshqarish, qo‘shish, pauza qilish va o‘chirish
- **Database:** SQLite & Prisma ORM (O‘quvchilar, testlar va topshirilgan javoblar to‘liq saqlanadi)
- **Monitoring & Nazorat:** Kim yechdi / kim yechmadi nazorati, ballar, eslatmalar, qoloqlar ro‘yxati
- **Scheduler:** node-cron (Interval, Tungi jimlik 23:00-07:00 va Peak hours 09:00, 13:00, 18:00, 21:00)
- **Keep-Alive:** O‘rnatilgan HTTP Health Server va Render 24/7 avto-ping
- **Logging:** Winston (`logs/app.log`)

---

## 🌟 ASOSIY IMKONIYATLAR:

### 1. 🎓 Kuchli O‘quvchilar Nazorati (Monitoring):
- **Kim yechdi / Kim yechmadi:** Har bir test bo‘yicha to‘liq hisobot (Nechta bola yechdi, nechta bola yechmadi, nechtasi to‘g‘ri, nechtasi xato).
- **✅ Yechganlar ro‘yxati:** Har bir o‘quvchining ismi, sinfi, qaysi variantni belgilagani va yechgan aniq vaqti.
- **❌ Yechmaganlar ro‘yxati:** Testni hali yechmagan o‘quvchilar ro‘yxati.
- **🔔 Bir tugma bilan eslatma yuborish:** Testni yechmagan barcha o‘quvchilarning Telegram shaxsiyiga to‘g‘ridan-to‘g‘ri test bilan birga ogohlantirish yuborish.
- **🏆 Umumiy Reyting (Leaderboard):** Eng ko‘p to‘g‘ri yechgan o‘quvchilar reytingi va aniqlik foizi (%).
- **👤 O‘quvchi shaxsiy kartasi:** O‘quvchini faollashtirish/to‘xtatish, unga to‘g‘ridan-to‘g‘ri xabar yuborish, umumiy baholari.
- **🚫 Aldovdan himoya (Anti-Cheat):** Har bir o‘quvchi bitta testga faqat 1 marta javob bera oladi, qayta bosish bloklanadi.

### 2. 📱 O‘quvchilar uchun shaxsiy qulayliklar:
- Botga kirib `/start` bosganda oson ro‘yxatdan o‘tish (Ism-familiya va sinf/guruh).
- `📝 YECHILMAGAN TESTLAR`: O‘quvchi o‘zi hali yechmagan barcha testlarni bot ichida bevosita yechishi mumkin.
- `📊 MENING NATIJALARIM`: Shaxsiy yechilgan testlar soni, to‘g‘ri/xatolar va o‘zlashtirish foizi.
- `🏆 REYTING`: Guruhdoshlari orasida nechanchi o‘rinda ekanligini ko‘rish.

### 3. 📢 Ko‘p Kanalli Boshqaruv (Multi-Channel):
- Admin xohlagancha kanal qo‘shishi mumkin (`@kanal_nomi` yoki kanal ID).
- Har bir kanalni alohida pauzaga qo‘yish yoki faollashtirish imkoniyati.
- Yangi test yaratilganda barcha faol kanallarga bir vaqtda yoki tanlangan alohida kanalga joylash.

### 4. 🧠 Avtonom AI Pipeline:
- 12 ta huquqiy mavzu bo‘yicha balansli savol tanlash.
- Lex.uz rasmiy qonun kodekslari va moddalariga asoslangan to‘g‘ri javob va batafsil izoh.
- AI Fact-Checker orqali tekshiruv va takrorlanishning oldini oluvchi Duplicate Checker.

---

## 🎛️ TELEGRAM ADMIN BUYRUQLARI

Telegram chatida botingizga `/admin` buyrug‘ini yuboring:

- `➕ YANGI TEST` — Yangi huquqiy test yaratish va preview qilish.
- `🚀 HOZIR JOYLASH` — Darhol kanallarga yangi test chiqarish.
- `📊 MONITORING (KIM YECHDI?)` — Testlar bo‘yicha kim yechgani va kim yechmaganini nazorat qilish.
- `👥 O‘QUVCHILAR NAZORATI` — Barcha o‘quvchilar ro‘yxati, profili va ularga xabar yuborish.
- `🏆 REYTING` — O‘quvchilarning umumiy reytingi (Top-20).
- `📢 KANALLAR` — Ulangan kanallarni ko‘rish, yangi kanal qo‘shish, pauza qilish yoki o‘chirish.
- `⏰ AVTO POST` — Avtomatik posting, interval, Tungi Jimlik va Peak rejimlarini boshqarish.
- `📝 TESTLAR` — Tarixdagi barcha testlar va natijalar.
- `📊 STATISTIKA` — Kanallar va postlar statistikasi.
- `⚙️ SOZLAMALAR` — Boshqaruv paneli.

---

## 🚀 ISHGA TUSHIRISH

```bash
# 1. Bog'liqliklarni o'rnatish:
npm install

# 2. Bazani sinxronlash:
npm run db:push

# 3. Loyihani build qilish:
npm run build

# 4. Ishga tushirish:
npm start
# Yoki ishlab chiqish rejimida:
npm run dev
```
