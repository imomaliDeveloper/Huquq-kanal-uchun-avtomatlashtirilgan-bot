import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AIProvider } from './aiProvider';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private primaryModel: string;

  constructor() {
    this.apiKey = (env.GEMINI_API_KEY || env.AI_API_KEY || '').trim();
    this.primaryModel = env.AI_MODEL || 'gemini-3.6-flash';

    if (this.apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
      } catch (err) {
        logger.warn(`Failed to initialize GoogleGenerativeAI SDK: ${(err as Error).message}`);
      }
    }
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
    if (!this.apiKey) {
      logger.warn('No Gemini API Key configured in .env. Returning development fallback legal test sample.');
      return this.getFallbackMockJson(userPrompt) as unknown as T;
    }

    if (!this.apiKey.startsWith('AIzaSy')) {
      logger.warn(`⚠️ GEMINI_API_KEY ('${this.apiKey.substring(0, 8)}...') is an OAuth/quota-restricted key. Recommended: get a free Google AI Studio key starting with 'AIzaSy' from https://aistudio.google.com/app/apikey`);
    }

    const candidateModels = Array.from(new Set([
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      this.primaryModel,
    ].filter(Boolean)));

    for (const modelName of candidateModels) {
      // 1. SDK Attempt
      if (this.genAI) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });

          const result = await model.generateContent(userPrompt);
          const text = result.response.text();
          if (text) {
            logger.info(`Successfully generated JSON using Gemini model '${modelName}'`);
            return JSON.parse(text) as T;
          }
        } catch (error: any) {
          const errMsg = error?.message || String(error);
          if (errMsg.includes('429')) {
            logger.warn(`Gemini 429 Rate Limit hit for model '${modelName}'. Retrying with next model...`);
          } else {
            logger.warn(`Gemini SDK error (Model '${modelName}'): ${errMsg}`);
          }
        }
      }

      // 2. Direct REST API Attempt
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
        const payload = {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        };

        const resp = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        });

        const text = resp.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          logger.info(`Successfully generated JSON via Gemini REST using model '${modelName}'`);
          return JSON.parse(text) as T;
        }
      } catch (error: any) {
        const status = error?.response?.status;
        const errDetail = error?.response?.data?.error?.message || error?.message;
        if (status === 429) {
          logger.warn(`Gemini REST 429 Quota Exceeded for '${modelName}'.`);
        } else {
          logger.error(`Gemini REST API error (Model '${modelName}', Status ${status}): ${errDetail}`);
        }
      }
    }

    logger.warn('Gemini API rate limit or key error encountered. Returning dynamic fallback legal quiz for current topic.');
    return this.getFallbackMockJson(userPrompt) as unknown as T;
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      return 'Professional legal concept background visual';
    }

    const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', this.primaryModel].filter(Boolean);
    for (const modelName of candidateModels) {
      if (this.genAI) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
          });

          const result = await model.generateContent(userPrompt);
          const txt = result.response.text();
          if (txt) return txt;
        } catch (error) {
          // ignore
        }
      }
    }

    return '';
  }

  private getFallbackMockJson(promptText: string = '') {
    // Extract topic if present
    let topic = 'Iste\'molchilar huquqlari';
    const topicMatch = promptText.match(/Mavzu:\s*([^\n]+)/);
    if (topicMatch && topicMatch[1]) {
      topic = topicMatch[1].trim();
    }

    const topicMocks: Record<string, any> = {
      'Iste\'molchilar huquqlari': {
        topic: 'Iste\'molchilar huquqlari',
        question: "Fuqaro do'kondan nuqsonli maishiy texnika sotib oldi. U tovar uchun to'langan pulni qaytarib berishni kafolat muddati davomida talab qilishga haqlimi?",
        options: [
          "Yo'q, faqat bepul ta'mirlashni talab qilishi mumkin.",
          "Ha, nuqsonli tovar uchun to'langan pulni to'liq qaytarib olishga haqli.",
          "Faqat 3 kun ichida murojaat qilsa qaytarib oladi.",
          "Faqat boshqa tovarga almashtirib beriladi."
        ],
        correct_answer: 1,
        explanation: "Iste'molchilarning huquqlarini himoya qilish to'g'risidagi Qonunning 13-moddasiga ko'ra, iste'molchi maqbul sifatli bo'lmagan tovar sotilganda to'langan pul summasini qaytarishni talab qilishga haqli.",
        legal_source: "Iste'molchilarning huquqlarini himoya qilish to'g'risidagi Qonun, 13-modda",
        source_url: "https://lex.uz/docs/-14687"
      },
      'Yo‘l harakati bilan bog‘liq huquqiy masalalar': {
        topic: 'Yo‘l harakati bilan bog‘liq huquqiy masalalar',
        question: "Haydovchi YPX inspektori taklifiga ko'ra alkogolli mastlik tekshiruvidan o'tishdan bo'yin tovlaganda qanday ma'muriy chora qo'llaniladi?",
        options: [
          "Faqat 15 BHM jarima solinadi.",
          "1 yildan 2 yilgacha pravodan mahrum qilinadi.",
          "1.5 yildan 3 yilgacha pravodan mahrum qilinib, 15 BHM jarima solinadi.",
          "10 BHM jarima solinadi."
        ],
        correct_answer: 2,
        explanation: "O'zbekiston Respublikasi MJtK ning 136-moddasiga ko'ra, mastlik holatini aniqlash uchun tekshiruvdan o'tishdan bo'yin tovlash — 1.5 yildan 3 yilgacha pravodan mahrum qilib, 15 BHM jarima solishga sabab bo'ladi.",
        legal_source: "O'zbekiston Respublikasi Ma'muriy javobgarlik to'g'risidagi kodeksi, 136-modda",
        source_url: "https://lex.uz/docs/-97664"
      }
    };

    return topicMocks[topic] || {
      topic: topic,
      question: `${topic} bo'yicha fuqaro o'z huquqlarini himoya qilish uchun birinchi navbatda qayerga murojaat qilishi kerak?`,
      options: [
        "Tegishli davlat organi yoki sudga",
        "Faqat tuman hokimligiga",
        "Faqat mahalla fuqarolar yig'iniga",
        "Hech qayerga murojaat qila olmaydi"
      ],
      correct_answer: 0,
      explanation: "O'zbekiston Respublikasi Konstitutsiyasiga ko'ra, har bir shaxsga o'z huquq va erkinliklarini sud orqali himoya qilish hamda davlat organlariga murojaat qilish kafolatlanadi.",
      legal_source: "O'zbekiston Respublikasi Konstitutsiyasi, 55-modda",
      source_url: "https://lex.uz/docs/-6445145"
    };
  }
}

export const geminiProvider = new GeminiProvider();
