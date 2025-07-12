// src/renderer/VideoRenderer.js
import { wrapText } from '../lib/canvasUtils';
import { applyCameraShake } from './effects';
import { AudioGenerator } from '../lib/audioUtils';
import { createVideoFromFrames } from '../lib/ffmpeg';

// Geçiş süresini ayarlanabilir bir sabit yapalım
const DURATION_PER_CUT_S = 0.3; 

export class VideoRenderer {
    constructor(canvas, settings, textData, onProgress) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.textData = textData; // Artık { fullText, positions, phrase } içeriyor
        this.onProgress = onProgress;

        const resolutions = {
            horizontal: { width: 1920, height: 1080 },
            vertical: { width: 1080, height: 1920 },
        };
        this.resolution = resolutions[settings.format];
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    getMetrics() {
        const { width } = this.resolution;
        const FONT_SIZE = Math.floor(width / 26);
        const LINE_HEIGHT = FONT_SIZE * 1.5;
        const BLUR_MAP = { Low: 2, Medium: 5, High: 9 };
        const BLUR_AMOUNT = BLUR_MAP[this.settings.blurIntensity];

        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        const lines = wrapText(this.ctx, this.textData.fullText, width * 0.9);

        return { lines, FONT_SIZE, LINE_HEIGHT, BLUR_AMOUNT };
    }

    getCutPositions() {
        const available = this.textData.positions || [];
        const LIMITS = { Short: 5, Medium: 10, Long: 15 }; // Daha dinamik olması için sayıları artırdım
        return available.slice(0, LIMITS[this.settings.videoLength]);
    }

    // Çizim fonksiyonu tamamen yenilendi: Artık kelimeyi merkeze alıyor.
    drawScene({ lineIndex, lineText, metrics, progress }) {
        const { width, height } = this.resolution;
        const { FONT_SIZE, LINE_HEIGHT, BLUR_AMOUNT, lines } = metrics;
        const phrase = this.textData.phrase; // Artık `textData`'dan geliyor
        const blurAmount = BLUR_AMOUNT * (1 - Math.sin(progress * Math.PI));

        this.ctx.save();
        this.ctx.fillStyle = this.settings.darkTheme ? '#111' : '#fff';
        this.ctx.fillRect(0, 0, width, height);
        applyCameraShake(this.ctx, 3); // Shake'i biraz artırdım

        // Arka plan metinlerini çiz
        this.ctx.filter = `blur(${blurAmount}px)`;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.settings.darkTheme ? '#ccc' : '#333';
        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;

        // === YENİ MERKEZLEME MANTIĞI ===
        this.ctx.textAlign = 'left'; // Hizalamayı sola alıyoruz ki offset'i doğru hesaplayabilelim
        const phraseStartIndex = lineText.toLowerCase().indexOf(phrase.toLowerCase());
        const textBeforePhrase = lineText.substring(0, phraseStartIndex);
        const prePhraseWidth = this.ctx.measureText(textBeforePhrase).width;
        const phraseWidth = this.ctx.measureText(phrase).width;
        
        // Tüm metin bloğunu, hedef kelime tam merkeze gelecek şekilde kaydır
        const horizontalOffset = width / 2 - (prePhraseWidth + phraseWidth / 2);
        const verticalOffset = height / 2 - (lineIndex * LINE_HEIGHT);
        
        lines.forEach((line, i) => {
            const y = verticalOffset + i * LINE_HEIGHT;
            this.ctx.fillText(line, horizontalOffset, y);
        });
        
        this.ctx.filter = 'none';

        // === ÖNE ÇIKAN KELİME ===
        // Artık metnin geri kalanından ayrı çiziliyor, üst üste binme yok.
        const phraseY = height / 2;
        const phraseX = width / 2;
        
        // Vurgu
        if (this.settings.textHighlight) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
            this.ctx.fillRect(phraseX - phraseWidth / 2 - 10, phraseY - FONT_SIZE / 1.5, phraseWidth + 20, FONT_SIZE * 1.8);
        }

        // Vurgulanan Kelime
        this.ctx.textAlign = 'center'; // Kelimeyi çizmek için tekrar merkeze al
        this.ctx.fillStyle = this.settings.darkTheme ? '#fefefe' : '#000';
        this.ctx.fillText(phrase, phraseX, phraseY);

        this.ctx.restore();
    }

    async renderCut({ pos, metrics, framesPerCut, cutIndex, totalCuts }) {
        const { lines } = metrics;
        const frameList = [];
        let charCount = 0;

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (pos >= charCount && pos <= charCount + line.length) {
                // Bu kesim için render döngüsü
                for (let f = 0; f < framesPerCut; f++) {
                    const p = f / framesPerCut;
                    this.drawScene({ lineIndex: lineIdx, lineText: line, metrics, progress: p });

                    const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
                    const arrayBuffer = await blob.arrayBuffer();
                    frameList.push(new Uint8Array(arrayBuffer));

                    // İlerleme çubuğunu güncelle
                    const currentProgress = ((cutIndex + f / framesPerCut) / totalCuts) * 90;
                    this.onProgress(currentProgress);
                }
                break; // Doğru satırı bulduk, döngüden çık
            }
            charCount += line.length + 1; // +1 for newline character
        }
        return frameList;
    }

    async generateVideo() {
        const fps = 30; // Daha akıcı bir video için FPS'i 30'a çektim
        const framesPerCut = Math.floor(DURATION_PER_CUT_S * fps);
        const positions = this.getCutPositions();
        if (positions.length === 0) {
            throw new Error("No occurrences of the phrase found in the text.");
        }
        const metrics = this.getMetrics();

        const allFrames = [];
        for (let i = 0; i < positions.length; i++) {
            const cutFrames = await this.renderCut({
                pos: positions[i],
                metrics,
                framesPerCut,
                cutIndex: i,
                totalCuts: positions.length,
            });
            allFrames.push(...cutFrames);
        }

        // Yeni AudioGenerator'ı kullanarak whoosh seslerini oluştur
        const audioGen = await AudioGenerator.create('/whoosh.mp3'); // Sesi public klasöründen yükle
        const audioBlob = await audioGen.generateAudio(allFrames.length, fps, framesPerCut);
        
        this.onProgress(90); // Render bitti, FFmpeg başlıyor
        const videoUrl = await createVideoFromFrames(allFrames, audioBlob, fps, p => this.onProgress(90 + p * 0.1));
        return videoUrl;
    }
}