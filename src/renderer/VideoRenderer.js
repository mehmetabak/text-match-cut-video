// src/renderer/VideoRenderer.js
import { wrapText } from '../lib/canvasUtils';
import { applyCameraShake } from './effects';
import { AudioGenerator } from '../lib/audioUtils';
import { createVideoFromFrames } from '../lib/ffmpeg';

export class VideoRenderer {
    constructor(canvas, settings, textData, onProgress) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.textData = textData;
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
        const LIMITS = { Short: 3, Medium: 6, Long: 9 };
        return available.slice(0, LIMITS[this.settings.videoLength]);
    }

    drawScene({ lineIndex, phraseX, metrics, progress }) {
        const { width, height } = this.resolution;
        const { lines, LINE_HEIGHT, FONT_SIZE, BLUR_AMOUNT } = metrics;
        const phrase = this.textData.phrase;
        const blurAmount = BLUR_AMOUNT * (1 - Math.sin(progress * Math.PI));

        this.ctx.save();
        this.ctx.fillStyle = this.settings.darkTheme ? '#111' : '#fff';
        this.ctx.fillRect(0, 0, width, height);
        applyCameraShake(this.ctx, 2);

        this.ctx.filter = `blur(${blurAmount}px)`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.settings.darkTheme ? '#ccc' : '#333';

        const centerY = height / 2 - lineIndex * LINE_HEIGHT;
        lines.forEach((line, i) => {
            const y = centerY + i * LINE_HEIGHT;
            this.ctx.fillText(line, width / 2, y);
        });

        this.ctx.filter = 'none';

        // Highlight
        if (this.settings.textHighlight) {
            const phraseWidth = this.ctx.measureText(phrase).width;
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
            this.ctx.fillRect(phraseX - phraseWidth / 2 - 10, height / 2 - FONT_SIZE, phraseWidth + 20, FONT_SIZE * 1.5);
        }

        // Phrase Text
        this.ctx.fillStyle = this.settings.darkTheme ? '#fefefe' : '#000';
        this.ctx.fillText(phrase, phraseX, height / 2);

        this.ctx.restore();
    }

    async renderCut({ pos, metrics, framesPerCut, cutIndex, totalCuts }) {
        const { lines, LINE_HEIGHT } = metrics;
        const phrase = this.textData.phrase;
        const frameList = [];
        let charCount = 0;

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (pos >= charCount && pos <= charCount + line.length) {
                const phraseX = this.resolution.width / 2;

                for (let f = 0; f < framesPerCut; f++) {
                    const p = f / framesPerCut;
                    this.drawScene({ lineIndex: lineIdx, phraseX, metrics, progress: p });

                    const blob = await new Promise(res => this.canvas.toBlob(res, 'image/png'));
                    const arrayBuffer = await blob.arrayBuffer();
                    frameList.push(new Uint8Array(arrayBuffer));

                    const currentProgress = ((cutIndex + f / framesPerCut) / totalCuts) * 90;
                    this.onProgress(currentProgress);
                }
                break;
            }
            charCount += line.length + 1;
        }

        return frameList;
    }

    async generateVideo() {
        const fps = 24;
        const framesPerCut = Math.floor(2 * fps); // 2 saniye per cut
        const positions = this.getCutPositions();
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

        const audioGen = new AudioGenerator(this.settings.speed);
        const audioBlob = await audioGen.generateAudio(allFrames.length, fps);

        const videoUrl = await createVideoFromFrames(allFrames, audioBlob, fps, p => this.onProgress(90 + p * 0.1));
        return videoUrl;
    }
}
