// src/renderer/VideoRenderer.js
import { wrapText, getFittedFontSize, requestScreenWakeLock } from '../lib/canvasUtils';
import { applyCameraShake, drawVignette } from './effects';
import { AudioGenerator } from '../lib/audioUtils';
import { createVideoFromFrames } from '../lib/ffmpeg';

export class VideoRenderer {
    constructor(canvas, settings, textData, onProgress) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.settings = settings;
        this.textData = textData;
        this.onProgress = onProgress;

        const resolutions = {
            horizontal: { width: 1920, height: 1080 },
            vertical: { width: 1080, height: 1920 },
        };
        this.resolution = resolutions[settings.format] || resolutions.horizontal;
        this.canvas.width = this.resolution.width;
        this.canvas.height = this.resolution.height;
    }

    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getCutPositions() {
        const available = [...new Set(this.textData.positions || [])];
        if (available.length === 0) return [0];

        const LIMITS = { Short: 8, Medium: 12, Long: 18 };
        const targetCuts = LIMITS[this.settings.videoLength] || 12;
        
        let finalPositions = [...available];

        while (finalPositions.length < targetCuts) {
            finalPositions.push(...this._shuffleArray([...available]));
        }
        
        return finalPositions.slice(0, targetCuts);
    }

    getMetrics() {
        const { width } = this.resolution;
        const divisor = this.settings.format === 'vertical' ? 18 : 26;
        const FONT_SIZE = Math.floor(width / divisor);
        const TITLE_FONT_SIZE = FONT_SIZE * 1.4;
        const LINE_HEIGHT = FONT_SIZE * 1.5;
        const BLUR_MAP = { Low: 2, Medium: 5, High: 9 };
        const BLUR_AMOUNT = BLUR_MAP[this.settings.blurIntensity] || 5;

        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        const wrapWidth = this.settings.format === 'horizontal' ? width * 0.95 : width * 0.9;
        const lines = wrapText(this.ctx, this.textData.fullText || '', wrapWidth);

        return { lines, FONT_SIZE, TITLE_FONT_SIZE, LINE_HEIGHT, BLUR_AMOUNT };
    }

    // ==========================================
    // 1. KLASİK MOD SAHNE ÇİZİMİ (V1)
    // ==========================================
    drawClassicScene({ lineIndex, lineText, metrics, progress }) {
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

        const safeLineText = lineText || '';
        const phraseStartIndex = safeLineText.toLowerCase().indexOf(phrase.toLowerCase());
        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        const textBeforePhrase = safeLineText.substring(0, Math.max(0, phraseStartIndex));
        const prePhraseWidth = this.ctx.measureText(textBeforePhrase).width;
        const phraseWidth = this.ctx.measureText(phrase).width;

        const horizontalOffset = width / 2 - (prePhraseWidth + phraseWidth / 2);
        const verticalOffset = height / 2 - (lineIndex * LINE_HEIGHT);

        if (title) {
            this.ctx.font = `bold ${TITLE_FONT_SIZE}px ${this.settings.fontFamily}`;
            const titleY = verticalOffset - LINE_HEIGHT * 2;
            this.ctx.fillText(title, horizontalOffset, titleY);
            const titleWidth = this.ctx.measureText(title).width;
            this.ctx.fillRect(horizontalOffset, titleY + TITLE_FONT_SIZE / 2 + 5, titleWidth, 2);
        }

        this.ctx.font = `bold ${FONT_SIZE}px ${this.settings.fontFamily}`;
        lines.forEach((line, i) => {
            const y = verticalOffset + i * LINE_HEIGHT;
            this.ctx.fillText(line, horizontalOffset, y);
        });

        this.ctx.filter = 'none';

        const phraseY = height / 2;
        const phraseX = width / 2;
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(phraseX - phraseWidth / 2 - 15, phraseY - FONT_SIZE, phraseWidth + 30, FONT_SIZE * 2);

        if (this.settings.textHighlight) {
            this.ctx.fillStyle = this.settings.darkTheme ? '#EAB308' : 'rgba(255, 238, 0, 0.75)';
            this.ctx.fillRect(phraseX - phraseWidth / 2 - 10, phraseY - (FONT_SIZE * 0.55), phraseWidth + 20, FONT_SIZE * 1.1);
        }
        
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = this.settings.darkTheme ? '#ffffff' : '#000';
        this.ctx.fillText(phrase, phraseX, phraseY);

        if (this.settings.vignetteEffect) {
            drawVignette(this.ctx, width, height, 0.4);
        }

        this.ctx.restore();
    }

    // ==========================================
    // 2. YENİ GAZETE MODU SAHNE ÇİZİMİ (Newspaper / V2 - Kamera Merkezleme & Alan Derinliği)
    // ==========================================
    drawNewspaperScene({ scene, progress, cutIndex }) {
        const { width, height } = this.resolution;
        const isVertical = this.settings.format === 'vertical';
        const isDark = this.settings.darkTheme;
        const fontFamily = this.settings.fontFamily || "'Times New Roman', Times, serif";

        const BLUR_MAP = { Low: 3, Medium: 6, High: 10 };
        const baseBlur = BLUR_MAP[this.settings.blurIntensity] || 6;
        const blurAmount = baseBlur * (1 - Math.sin(progress * Math.PI));

        this.ctx.save();

        // 1. Arka Plan (Gazete Kağıdı Dokusu Rengi)
        const bgColor = isDark ? '#111113' : '#FAF8F5';
        const textColor = isDark ? '#E5E3DC' : '#1A1A1A';
        const mutedColor = isDark ? '#8E8C85' : '#6A6862';
        const ruleColor = isDark ? '#3A3835' : '#D0CDC5';
        const highlightColor = isDark ? '#EAB308' : '#FFEE00';

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, width, height);

        // Kamera Mikro Sarsıntısı
        applyCameraShake(this.ctx, 2);

        const zoom = scene.zoomScale || 1.0;
        const phrase = scene.phrase || this.textData.phrase || '';
        const phraseLower = phrase.toLowerCase();
        const placementType = scene.placementType || 'HEADLINE';

        // HEDEF KELİME HERO BOYUTU:
        // Tüm kesimlerde kelimenin ekranda algılanan büyüklüğünü korumak için
        // kelime boyutu sabit bir "Hero" boyuta kilitlenir, çevreleyen gazete öğeleri ise
        // o kesimin kadrajına (Headline / Macro Paragraph / Byline) göre yakınlaştırılıp uzaklaştırılır.
        const baseHeroSize = Math.floor(isVertical ? width / 12.5 : width / 19);
        const cutVariance = 0.94 + ((cutIndex * 13) % 15) * 0.01; // Hafif doğal ritim (0.94x - 1.08x)
        const targetFontSize = Math.floor(baseHeroSize * cutVariance);

        let targetLine = "";
        let targetFontStyle = "bold";
        let headlineSize = targetFontSize;
        let mastheadSize = Math.floor(targetFontSize * 0.7);
        let bodyFontSize = Math.floor(targetFontSize * 0.36);
        let bylineSize = Math.floor(targetFontSize * 0.38);

        if (placementType === 'HEADLINE' || placementType === 'HEADLINE_MACRO') {
            targetLine = scene.headline || phrase;
            targetFontStyle = "bold";
            headlineSize = targetFontSize;
            mastheadSize = Math.floor(headlineSize * 0.65);
            bylineSize = Math.floor(headlineSize * 0.38);
            bodyFontSize = Math.floor(headlineSize * 0.34);
        } else if (placementType === 'PARAGRAPH') {
            // Paragraf kadrajı: Kamera paragrafa makro-yakınlaşır!
            targetLine = scene.targetText || phrase;
            targetFontStyle = "normal";
            bodyFontSize = targetFontSize; // Paragraf metni hero boyuta yükselir
            headlineSize = Math.floor(bodyFontSize * 2.2); // Üstteki başlık devasa kadraja girer
            mastheadSize = Math.floor(bodyFontSize * 1.5);
            bylineSize = Math.floor(bodyFontSize * 0.85);
        } else if (placementType === 'BYLINE') {
            // Byline kadrajı: Kamera alt başlığa yakınlaşır!
            targetLine = scene.byline || phrase;
            targetFontStyle = "italic";
            bylineSize = targetFontSize; // Byline hero boyuta yükselir
            headlineSize = Math.floor(bylineSize * 2.4);
            mastheadSize = Math.floor(bylineSize * 1.6);
            bodyFontSize = Math.floor(bylineSize * 1.0);
        }

        const targetFont = `${targetFontStyle} ${targetFontSize}px ${fontFamily}`;
        this.ctx.font = targetFont;

        // Hedef kelimenin hedef satır içindeki yerini ölç
        let matchIndex = targetLine.toLowerCase().indexOf(phraseLower);
        if (matchIndex === -1) {
            targetLine = `... ${phrase} ...`;
            matchIndex = targetLine.toLowerCase().indexOf(phraseLower);
        }

        const textBefore = targetLine.substring(0, matchIndex);
        const textMatch = targetLine.substring(matchIndex, matchIndex + phrase.length);
        const textAfter = targetLine.substring(matchIndex + phrase.length);

        const beforeWidth = this.ctx.measureText(textBefore).width;
        const phraseWidth = this.ctx.measureText(textMatch).width;
        const phraseHeight = targetFontSize * 1.15;

        // MATEMATİKSEL KAMERA MERKEZLEME:
        // Hedef kelimenin tam ortası ekranın (width/2, height/2) noktasına denk gelecek!
        const screenCenterX = width / 2;
        const screenCenterY = height / 2;
        const targetLineStartX = screenCenterX - beforeWidth - (phraseWidth / 2);
        const targetLineY = screenCenterY;

        // PASAJ 1: BULANIK ARKA PLAN & GAZETE ÖĞELERİ
        this.ctx.save();
        this.ctx.filter = `blur(${Math.max(2, blurAmount + 3.5)}px)`;
        this.ctx.textBaseline = 'middle';

        const contentWidth = width * (isVertical ? 0.90 : 0.86);
        const leftAlignX = screenCenterX - (contentWidth / 2);
        const lineSpacing = isVertical ? 1.55 : 1.42;

        if (placementType === 'HEADLINE' || placementType === 'HEADLINE_MACRO') {
            const headY = targetLineY;
            const mastheadOffset = isVertical ? mastheadSize * 3.4 : mastheadSize * 2.8;
            const mastheadY = headY - mastheadOffset;
            const dateY = headY - (mastheadOffset * 0.52);
            const bylineY = headY + (headlineSize * (isVertical ? 1.45 : 1.25));

            // 1. Gazete Başlığı (Masthead)
            this.ctx.font = `900 ${mastheadSize}px ${fontFamily}`;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(scene.paperName || 'THE DAILY NONSENSE', screenCenterX, mastheadY);

            // Tarih Satırı
            this.ctx.font = `600 ${Math.floor(mastheadSize * 0.4)}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            this.ctx.fillText(scene.dateLine || 'FRI · JUN 10 2005 · VOL.192 NO.91', screenCenterX, dateY);

            // Ayırıcı Çizgiler
            this.ctx.strokeStyle = ruleColor;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(leftAlignX, dateY + mastheadSize * 0.42);
            this.ctx.lineTo(leftAlignX + contentWidth, dateY + mastheadSize * 0.42);
            this.ctx.stroke();

            // Üst Dolgu Paragrafları (Ekranın üst sınırına kadar doldur)
            this.ctx.font = `normal ${bodyFontSize}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            this.ctx.textAlign = 'left';
            const topLines = wrapText(this.ctx, scene.topParagraph || '', contentWidth);
            const availableTopSlots = Math.floor((mastheadY - mastheadSize * 1.1 + 40) / (bodyFontSize * lineSpacing));
            const renderTopCount = Math.min(topLines.length, Math.max(1, availableTopSlots));

            for (let i = 0; i < renderTopCount; i++) {
                const lineIdx = topLines.length - 1 - i;
                const y = mastheadY - (mastheadSize * 1.1) - (i * bodyFontSize * lineSpacing);
                if (y > -40) {
                    this.ctx.fillText(topLines[lineIdx], leftAlignX, y);
                }
            }

            // Başlığın hedef kelime DIŞINDA kalan kısımları (Bulanık)
            this.ctx.font = targetFont;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(textBefore, targetLineStartX, targetLineY);
            this.ctx.fillText(textAfter, targetLineStartX + beforeWidth + phraseWidth, targetLineY);

            // Alt Başlık (Byline)
            this.ctx.font = `italic ${bylineSize}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            this.ctx.fillText(scene.byline || '— Special Reports Desk', leftAlignX, bylineY);

            // Alt Dolgu Paragrafları (Ekranın en altına kadar dengeli dağıt)
            this.ctx.font = `normal ${bodyFontSize}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            const bottomLines = wrapText(this.ctx, scene.bottomParagraph || '', contentWidth);
            const bottomStartY = bylineY + (bylineSize * (isVertical ? 2.0 : 1.7));

            for (let i = 0; i < bottomLines.length; i++) {
                const y = bottomStartY + (i * bodyFontSize * lineSpacing);
                if (y > height + 40) break;
                this.ctx.fillText(bottomLines[i], leftAlignX, y);
            }

        } else if (placementType === 'PARAGRAPH') {
            // Paragraf içinde kelime odağı (Macro Zoom)
            const lineY = targetLineY;
            const headY = lineY - (headlineSize * (isVertical ? 1.8 : 1.6));
            const mastheadY = headY - (mastheadSize * (isVertical ? 1.8 : 1.5));

            // Gazete Başlığı
            this.ctx.font = `900 ${mastheadSize}px ${fontFamily}`;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'center';
            if (mastheadY > -100) {
                this.ctx.fillText(scene.paperName || 'THE REGIONAL MURMUR', screenCenterX, mastheadY);
            }

            // Büyük Başlık
            this.ctx.font = `bold ${headlineSize}px ${fontFamily}`;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'center';
            if (headY > -100) {
                this.ctx.fillText(scene.headline || 'Celebrity apologizes to everyone', screenCenterX, headY);
            }

            // Paragrafın hedef satırının öncesi ve sonrası
            this.ctx.font = targetFont;
            this.ctx.fillStyle = mutedColor;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(textBefore, targetLineStartX, targetLineY);
            this.ctx.fillText(textAfter, targetLineStartX + beforeWidth + phraseWidth, targetLineY);

            // Üst dolgu satırları
            this.ctx.font = `normal ${bodyFontSize}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            const topLines = wrapText(this.ctx, scene.topParagraph || '', contentWidth);
            for (let i = 0; i < topLines.length; i++) {
                const y = lineY - ((i + 1) * bodyFontSize * lineSpacing);
                if (y < -40) break;
                // Başlık ile çakışmayı engelle
                if (y > headY - headlineSize * 0.4 && y < headY + headlineSize * 0.4) continue;
                this.ctx.fillText(topLines[topLines.length - 1 - i], leftAlignX, y);
            }

            // Alt dolgu satırları (Aşağıya doğru kesintisiz akış)
            const bottomLines = wrapText(this.ctx, scene.bottomParagraph || '', contentWidth);
            for (let i = 0; i < bottomLines.length; i++) {
                const y = lineY + ((i + 1) * bodyFontSize * lineSpacing);
                if (y > height + 40) break;
                this.ctx.fillText(bottomLines[i], leftAlignX, y);
            }

        } else if (placementType === 'BYLINE') {
            const bylineY = targetLineY;
            const headY = bylineY - (headlineSize * (isVertical ? 1.6 : 1.4));
            const mastheadY = headY - (mastheadSize * (isVertical ? 2.0 : 1.7));

            // Gazete Başlığı
            this.ctx.font = `900 ${mastheadSize}px ${fontFamily}`;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'center';
            if (mastheadY > -100) {
                this.ctx.fillText(scene.paperName || 'SAN ANDREAS CHRONICLE', screenCenterX, mastheadY);
            }

            // Başlık
            this.ctx.font = `bold ${headlineSize}px ${fontFamily}`;
            this.ctx.fillStyle = textColor;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(scene.headline || 'Investigation continues across region', screenCenterX, headY);

            // Byline öncesi ve sonrası
            this.ctx.font = targetFont;
            this.ctx.fillStyle = mutedColor;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(textBefore, targetLineStartX, targetLineY);
            this.ctx.fillText(textAfter, targetLineStartX + beforeWidth + phraseWidth, targetLineY);

            // Alt Dolgu Paragrafları (Ekranı dolduracak şekilde)
            this.ctx.font = `normal ${bodyFontSize}px ${fontFamily}`;
            this.ctx.fillStyle = mutedColor;
            const bottomLines = wrapText(this.ctx, scene.bottomParagraph || '', contentWidth);
            const bottomStartY = bylineY + (bylineSize * (isVertical ? 1.8 : 1.5));

            for (let i = 0; i < bottomLines.length; i++) {
                const y = bottomStartY + (i * bodyFontSize * lineSpacing);
                if (y > height + 40) break;
                this.ctx.fillText(bottomLines[i], leftAlignX, y);
            }
        }

        this.ctx.restore(); // Bulanıklık filtresini kaldır

        // PASAJ 2: KESKİN & VURGULU HEDEF KELİME (TAM EKRAN MERKEZİNDE)
        this.ctx.save();
        this.ctx.filter = 'none';
        this.ctx.textBaseline = 'middle';
        this.ctx.textAlign = 'left';

        const highlightX = screenCenterX - (phraseWidth / 2);
        const highlightY = screenCenterY - (phraseHeight / 2);

        // 1. Sarı Vurgu Kutusu
        if (this.settings.textHighlight) {
            this.ctx.fillStyle = highlightColor;
            this.ctx.fillRect(highlightX - 6, highlightY, phraseWidth + 12, phraseHeight);
        }

        // 2. Net Hedef Kelime
        this.ctx.font = targetFont;
        this.ctx.fillStyle = isDark ? '#FFFFFF' : '#111111';
        this.ctx.fillText(textMatch, highlightX, screenCenterY);

        this.ctx.restore();

        // PASAJ 3: SİNEMATİK KARARTMA (VIGNETTE)
        if (this.settings.vignetteEffect) {
            drawVignette(this.ctx, width, height, 0.45);
        }

        this.ctx.restore();
    }

    async renderCut({ pos, metrics, cutIndex, totalCuts, scenes }) {
        const { framesPerCut } = metrics;
        const frameList = [];
        const isNewspaper = (this.settings.renderMode || 'newspaper') === 'newspaper';

        if (isNewspaper && scenes && scenes.length > 0) {
            const scene = scenes[cutIndex % scenes.length];
            for (let f = 0; f < framesPerCut; f++) {
                const p = f / framesPerCut;
                this.drawNewspaperScene({ scene, progress: p, cutIndex });
                const format = this.settings.highQuality && !this.settings.fastRender ? 'image/png' : 'image/jpeg';
                const quality = this.settings.highQuality && !this.settings.fastRender ? 1.0 : (this.settings.fastRender ? 0.86 : 0.95);
                const blob = await new Promise(res => this.canvas.toBlob(res, format, quality));
                const arrayBuffer = await blob.arrayBuffer();
                frameList.push(new Uint8Array(arrayBuffer));
                const currentProgress = ((cutIndex + p) / totalCuts) * 90;
                this.onProgress(currentProgress);
            }
        } else {
            // Klasik mod
            const { lines } = metrics;
            let charCount = 0;
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                const line = lines[lineIdx];
                if (pos >= charCount && pos < charCount + line.length + 1) {
                    for (let f = 0; f < framesPerCut; f++) {
                        const p = f / framesPerCut;
                        this.drawClassicScene({ lineIndex: lineIdx, lineText: line, metrics, progress: p });
                        const format = this.settings.highQuality && !this.settings.fastRender ? 'image/png' : 'image/jpeg';
                        const quality = this.settings.highQuality && !this.settings.fastRender ? 1.0 : (this.settings.fastRender ? 0.86 : 0.95);
                        const blob = await new Promise(res => this.canvas.toBlob(res, format, quality));
                        const arrayBuffer = await blob.arrayBuffer();
                        frameList.push(new Uint8Array(arrayBuffer));
                        const currentProgress = ((cutIndex + p) / totalCuts) * 90;
                        this.onProgress(currentProgress);
                    }
                    break;
                }
                charCount += line.length + 1;
            }
        }

        return frameList;
    }

    async generateVideo() {
        const releaseWakeLock = await requestScreenWakeLock();

        try {
            // 1. Fontların yüklenmesini bekle (İlk frame'lerde fallback font sorununu engeller)
            if (typeof document !== 'undefined' && document.fonts) {
                try {
                    await document.fonts.ready;
                } catch (e) {
                    console.warn("Font loading ready check failed, proceeding anyway", e);
                }
            }

            const fps = 30;
            const speedMultiplier = this.settings.speed ? parseFloat(this.settings.speed) : 2.5;
            const durationPerCut = Math.max(0.1, 0.25 / (speedMultiplier / 2.5 || 1));
            const framesPerCut = Math.max(2, Math.floor(durationPerCut * fps));
            const positions = this.getCutPositions();
            
            if (positions.length === 0) {
                throw new Error(`The phrase "${this.textData.phrase}" could not be used. Please try another one.`);
            }
            
            const metrics = { ...this.getMetrics(), framesPerCut };
            const allFrames = [];
            const scenes = this.textData.scenes || [];
            
            for (let i = 0; i < positions.length; i++) {
                const cutFrames = await this.renderCut({
                    pos: positions[i],
                    metrics,
                    cutIndex: i,
                    totalCuts: positions.length,
                    scenes
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
            const videoUrl = await createVideoFromFrames(allFrames, audioBlob, fps, { highQuality: this.settings.highQuality, fastRender: this.settings.fastRender }, p => this.onProgress(90 + p * 0.1));
            
            // Clean up memory buffer
            allFrames.length = 0;

            return videoUrl;
        } finally {
            releaseWakeLock();
        }
    }
}