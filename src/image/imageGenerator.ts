import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env, GENERATED_IMAGES_DIR } from '../config/env';
import { logger } from '../utils/logger';

export interface QuizCardInput {
  topic: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export class ImageGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = GENERATED_IMAGES_DIR;
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateQuizCard(quiz: QuizCardInput): Promise<string> {
    const filename = `quiz_${crypto.randomBytes(6).toString('hex')}.svg`;
    const filepath = path.join(this.outputDir, filename);

    // Render clean high-res SVG graphic card with Question & Options A, B, C, D
    logger.info(`Rendering Graphic Quiz Card with Options for topic '${quiz.topic}'...`);
    return this.generateSvgQuizCard(quiz, filepath);
  }

  private generateSvgQuizCard(quiz: QuizCardInput, filepath: string): string {
    const wrapText = (text: string, maxCharsPerLine: number = 42): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    const questionLines = wrapText(quiz.question, 45).slice(0, 4);

    const truncateOpt = (opt: string, maxLen: number = 55) =>
      opt.length > maxLen ? opt.substring(0, maxLen - 3) + '...' : opt;

    const optA = truncateOpt(quiz.optionA);
    const optB = truncateOpt(quiz.optionB);
    const optC = truncateOpt(quiz.optionC);
    const optD = truncateOpt(quiz.optionD);

    let qY = 240;
    const qLinesSvg = questionLines
      .map((line) => {
        const lineSvg = `<text x="80" y="${qY}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${this.escapeXml(line)}</text>`;
        qY += 40;
        return lineSvg;
      })
      .join('\n');

    let optY = Math.max(qY + 30, 390);

    const svgContent = `
    <svg width="1280" height="960" viewBox="0 0 1280 960" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1280" height="960" fill="url(#bg)"/>
      <rect x="0" y="0" width="1280" height="16" fill="#d97706"/>
      <rect x="0" y="944" width="1280" height="16" fill="#d97706"/>
      <rect x="30" y="30" width="1220" height="900" rx="20" fill="none" stroke="#d97706" stroke-width="2"/>
      
      <!-- Header -->
      <text x="80" y="100" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#f59e0b">⚖️ HUQUQIY TEST AGENT</text>
      <rect x="80" y="130" width="550" height="45" rx="8" fill="#d97706"/>
      <text x="100" y="162" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Mavzu: ${this.escapeXml(quiz.topic.toUpperCase())}</text>
      
      <!-- Question -->
      ${qLinesSvg}

      <!-- Options Cards -->
      <!-- Option A -->
      <rect x="80" y="${optY}" width="1120" height="75" rx="12" fill="url(#cardGrad)" stroke="#475569" stroke-width="2"/>
      <text x="110" y="${optY + 47}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#f59e0b">🅰️ A)</text>
      <text x="190" y="${optY + 47}" font-family="Arial, sans-serif" font-size="24" fill="#e2e8f0">${this.escapeXml(optA)}</text>

      <!-- Option B -->
      <rect x="80" y="${optY + 95}" width="1120" height="75" rx="12" fill="url(#cardGrad)" stroke="#475569" stroke-width="2"/>
      <text x="110" y="${optY + 142}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#f59e0b">🅱️ B)</text>
      <text x="190" y="${optY + 142}" font-family="Arial, sans-serif" font-size="24" fill="#e2e8f0">${this.escapeXml(optB)}</text>

      <!-- Option C -->
      <rect x="80" y="${optY + 190}" width="1120" height="75" rx="12" fill="url(#cardGrad)" stroke="#475569" stroke-width="2"/>
      <text x="110" y="${optY + 237}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#f59e0b">🆎 C)</text>
      <text x="190" y="${optY + 237}" font-family="Arial, sans-serif" font-size="24" fill="#e2e8f0">${this.escapeXml(optC)}</text>

      <!-- Option D -->
      <rect x="80" y="${optY + 285}" width="1120" height="75" rx="12" fill="url(#cardGrad)" stroke="#475569" stroke-width="2"/>
      <text x="110" y="${optY + 332}" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#f59e0b">🆓 D)</text>
      <text x="190" y="${optY + 332}" font-family="Arial, sans-serif" font-size="24" fill="#e2e8f0">${this.escapeXml(optD)}</text>

      <!-- Footer -->
      <text x="80" y="890" font-family="Arial, sans-serif" font-size="22" fill="#94a3b8">👇 Javobingizni quyidagi Telegram testida belgilang!</text>
    </svg>
    `;

    fs.writeFileSync(filepath, svgContent, 'utf-8');
    return filepath;
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const imageGenerator = new ImageGenerator();
