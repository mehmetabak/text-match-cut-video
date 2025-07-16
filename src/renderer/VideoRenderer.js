// src/renderer/VideoRenderer.js
import { wrapText } from '../lib/canvasUtils';
import { applyCameraShake } from './effects';
import { AudioGenerator } from '../lib/audioUtils';
import { createVideoFromFrames } from '../lib/ffmpeg';

const DURATION_PER_CUT_S = 0.25; // TO-DO: Her kesim için 0.25 saniye, kullanıcı bildirimine göre değiştirilecek

export class VideoRenderer {
    constructor(canvas, settings, textData, onProgress) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.textData = textData; // Artık {title, fullText, ...} içeriyor
        this.onProgress = onProgress;

        const resolutions = {
            horizontal: { width: 1920, height: 1080 },
            vertical: { width: 1080, height: 1920 },
        };
        this.resolution = resolutions[settings.format];
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    // Basit bir Fisher-Yates karıştırma algoritması
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getCutPositions() {
        const available = [...new Set(this.textData.positions || [])]; // Tekrarları en baştan kaldır
        if (available.length === 0) return [];

        const LIMITS = { Short: 8, Medium: 12, Long: 18 };
        const targetCuts = LIMITS[this.settings.videoLength];
        
        let finalPositions = [...available];

        // GÜNCELLENDİ: Tekrar hissini önlemek için karıştırarak ekleme yap
        while (finalPositions.length < targetCuts) {
            finalPositions.push(...this._shuffleArray([...available]));
        }
        
        return finalPositions.slice(0, targetCuts);
    }

    getMetrics() {
        const { width } = this.resolution;
        const divisor = this.settings.format === 'vertical' ? 18 : 26;
        const FONT_SIZE = Math.floor(width / divisor);
        const TITLE_FONT_SIZE = FONT_SIZE * 1.4; // Başlık için daha büyük font
        const LINE_HEIGHT = FONT_SIZE * 1.5;
        const BLUR_MAP = { Low: 2, Medium: 5, High: 9 };
        const BLUR_AMOUNT = BLUR_MAP[this.settings.blurIntensity];

        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        const wrapWidth = this.settings.format === 'horizontal' ? width * 0.95 : width * 0.9;
        const lines = wrapText(this.ctx, this.textData.fullText, wrapWidth);

        return { lines, FONT_SIZE, TITLE_FONT_SIZE, LINE_HEIGHT, BLUR_AMOUNT };
    }

    drawScene({ lineIndex, lineText, metrics, progress }) {
        const { width, height } = this.resolution;
        const { FONT_SIZE, TITLE_FONT_SIZE, LINE_HEIGHT, BLUR_AMOUNT, lines } = metrics;
        const { phrase, title } = this.textData;
        const blurAmount = BLUR_AMOUNT * (1 - Math.sin(progress * Math.PI));

        this.ctx.save();
        const bgColor = this.settings.darkTheme ? '#111' : '#fff';
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, width, height);
        applyCameraShake(this.ctx, 3);

        this.ctx.filter = `blur(${blurAmount}px)`;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.settings.darkTheme ? '#ccc' : '#333';
        this.ctx.textAlign = 'left';

        const phraseStartIndex = lineText.toLowerCase().indexOf(phrase.toLowerCase());
        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        const textBeforePhrase = lineText.substring(0, phraseStartIndex);
        const prePhraseWidth = this.ctx.measureText(textBeforePhrase).width;
        const phraseWidth = this.ctx.measureText(phrase).width;

        const horizontalOffset = width / 2 - (prePhraseWidth + phraseWidth / 2);
        const verticalOffset = height / 2 - (lineIndex * LINE_HEIGHT);

        // YENİ: Başlığı çiz
        this.ctx.font = `bold ${TITLE_FONT_SIZE}px ${this.settings.fontFamily}`;
        const titleY = verticalOffset - LINE_HEIGHT * 2; // Ana metnin üstüne yerleştir
        this.ctx.fillText(title, horizontalOffset, titleY);
        // Başlık altına ince bir çizgi ekle
        const titleWidth = this.ctx.measureText(title).width;
        this.ctx.fillRect(horizontalOffset, titleY + TITLE_FONT_SIZE / 2 + 5, titleWidth, 2);

        // Ana metni çiz
        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        lines.forEach((line, i) => {
            const y = verticalOffset + i * LINE_HEIGHT;
            this.ctx.fillText(line, horizontalOffset, y);
        });

        this.ctx.filter = 'none';

        // Öne çıkan kelimeyi çiz (arkasını temizleyerek)
        const phraseY = height / 2;
        const phraseX = width / 2;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(phraseX - phraseWidth / 2 - 15, phraseY - FONT_SIZE, phraseWidth + 30, FONT_SIZE * 2);

        if (this.settings.textHighlight) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
            this.ctx.fillRect(phraseX - phraseWidth / 2 - 10, phraseY - FONT_SIZE / 1.5, phraseWidth + 20, FONT_SIZE * 1.8);
        }
        
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = this.settings.darkTheme ? '#fefefe' : '#000';
        this.ctx.fillText(phrase, phraseX, phraseY);

        this.ctx.restore();
    }

    async renderCut({ pos, metrics, cutIndex, totalCuts }) {
        const { lines, framesPerCut } = metrics;
        const frameList = [];
        let charCount = 0;
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (pos >= charCount && pos < charCount + line.length + 1) {
                for (let f = 0; f < framesPerCut; f++) {
                    const p = f / framesPerCut;
                    this.drawScene({ lineIndex: lineIdx, lineText: line, metrics, progress: p });
                    const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
                    const arrayBuffer = await blob.arrayBuffer();
                    frameList.push(new Uint8Array(arrayBuffer));
                    const currentProgress = ((cutIndex + p) / totalCuts) * 90;
                    this.onProgress(currentProgress);
                }
                break;
            }
            charCount += line.length + 1;
        }
        return frameList;
    }

    async generateVideo() {
        const fps = 30;
        const framesPerCut = Math.floor(DURATION_PER_CUT_S * fps);
        const positions = this.getCutPositions();
        
        if (positions.length === 0) {
            throw new Error(`The phrase "${this.textData.phrase}" could not be used. Please try another one.`);
        }
        
        const metrics = { ...this.getMetrics(), framesPerCut };
        const allFrames = [];
        
        for (let i = 0; i < positions.length; i++) {
            const cutFrames = await this.renderCut({
                pos: positions[i],
                metrics,
                cutIndex: i,
                totalCuts: positions.length,
            });
            allFrames.push(...cutFrames);
        }
        
        if (allFrames.length > 0) {
            allFrames.push(new Uint8Array(allFrames[allFrames.length - 1]));
        }

        const audioGen = await AudioGenerator.create('/whoosh.mp3');
        const totalDuration = allFrames.length / fps;
        const audioBlob = await audioGen.generateAudio(positions.length, totalDuration);
        
        this.onProgress(90);
        const videoUrl = await createVideoFromFrames(allFrames, audioBlob, fps, p => this.onProgress(90 + p * 0.1));
        return videoUrl;
    }
}