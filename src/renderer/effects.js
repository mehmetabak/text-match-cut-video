// src/renderer/effects.js

export function applyCameraShake(ctx, intensity) {
    const dx = (Math.random() - 0.5) * intensity;
    const dy = (Math.random() - 0.5) * intensity;
    ctx.translate(dx, dy);
}

export function drawVignette(ctx, width, height, intensity = 0.5) {
    ctx.save();
    const maxRadius = Math.max(width, height) * 0.75;
    const minRadius = Math.min(width, height) * 0.25;
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, minRadius,
        width / 2, height / 2, maxRadius
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, `rgba(0,0,0,${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

export function getSourceDimensions(source) {
    if (!source) return { width: 1, height: 1 };
    const width = source.naturalWidth || source.videoWidth || source.width || 1;
    const height = source.naturalHeight || source.videoHeight || source.height || 1;
    return { width, height };
}

/**
 * Aspect-Ratio Preserving Cover Drawing with Scale & Pan
 */
export function drawImageCover(ctx, source, dx, dy, dWidth, dHeight, scale = 1, panX = 0, panY = 0) {
    if (!source) return;
    const { width: sW, height: sH } = getSourceDimensions(source);
    const sAspect = sW / sH;
    const dAspect = dWidth / dHeight;

    let renderW, renderH;
    if (sAspect > dAspect) {
        // Source is wider than target
        renderH = dHeight * scale;
        renderW = renderH * sAspect;
    } else {
        // Source is taller than target
        renderW = dWidth * scale;
        renderH = renderW / sAspect;
    }

    const posX = dx + (dWidth - renderW) / 2 + (panX * (renderW - dWidth) * 0.5);
    const posY = dy + (dHeight - renderH) / 2 + (panY * (renderH - dHeight) * 0.5);

    ctx.drawImage(source, posX, posY, renderW, renderH);
}

// 1. KEN BURNS MOTION RENDERER
export function drawKenBurnsFrame(ctx, source, width, height, progress = 0, options = {}) {
    const zoomRate = options.zoomRate ?? 0.04; // 0.01 - 0.10
    const zoomDirection = options.zoomDirection ?? 'in'; // 'in' | 'out'
    const panStyle = options.panStyle ?? 'center'; // 'center', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'

    ctx.save();
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    if (!source) {
        ctx.restore();
        return;
    }

    // Smooth Cosine Easing
    const easeProgress = 0.5 - (Math.cos(progress * Math.PI) / 2);

    // Zoom Calculation
    const maxZoom = 1 + (zoomRate * 4);
    const scale = zoomDirection === 'in'
        ? 1 + ((maxZoom - 1) * easeProgress)
        : maxZoom - ((maxZoom - 1) * easeProgress);

    // Pan Calculation
    let panX = 0;
    let panY = 0;

    if (panStyle === 'left_to_right') {
        panX = -1 + (2 * easeProgress);
    } else if (panStyle === 'right_to_left') {
        panX = 1 - (2 * easeProgress);
    } else if (panStyle === 'top_to_bottom') {
        panY = -1 + (2 * easeProgress);
    } else if (panStyle === 'bottom_to_top') {
        panY = 1 - (2 * easeProgress);
    }

    drawImageCover(ctx, source, 0, 0, width, height, scale, panX, panY);
    drawVignette(ctx, width, height, 0.35);
    ctx.restore();
}

// 2. RETRO VHS TAPE RENDERER
export function drawVhsEffect(ctx, source, width, height, progress = 0, options = {}) {
    const aberrationStrength = options.aberrationStrength ?? 1.2;
    const trackingNoise = options.trackingNoise ?? 'medium'; // 'low' | 'medium' | 'high'
    const scanlineFlicker = options.scanlineFlicker !== false;
    const showTimestamp = options.vhsTimestamp !== false;

    ctx.save();
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    if (!source) {
        ctx.restore();
        return;
    }

    // Base Aspect-Cover Frame
    drawImageCover(ctx, source, 0, 0, width, height, 1.02);

    // 1. Chromatic Aberration RGB Shift
    const shift = Math.floor(width * 0.004 * aberrationStrength);
    if (shift > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.45;

        // Red Shift
        drawImageCover(ctx, source, shift, 0, width, height, 1.02);
        // Cyan / Blue Shift
        drawImageCover(ctx, source, -shift, 0, width, height, 1.02);
        ctx.restore();
    }

    // 2. Scanlines
    ctx.save();
    const flicker = scanlineFlicker ? (Math.sin(progress * 40) * 0.05) : 0;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 + flicker})`;
    for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1.2);
    }
    ctx.restore();

    // 3. VHS Tracking Noise Band
    const noiseLevels = { low: 2, medium: 4, high: 7 };
    const noiseBands = noiseLevels[trackingNoise] || 4;
    const trackY = ((progress * 1.5) % 1) * height;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, trackY, width, 12);
    for (let i = 0; i < noiseBands; i++) {
        const ny = (trackY + (Math.random() - 0.5) * 40 + height) % height;
        const nw = Math.random() * width;
        ctx.fillRect(Math.random() * (width - nw), ny, nw, 2);
    }
    ctx.restore();

    // 4. Retro VCR OSD Timestamp & Status
    if (showTimestamp) {
        ctx.save();
        ctx.fillStyle = '#4ADE80'; // classic green VCR OSD or White
        ctx.font = `700 ${Math.max(14, Math.floor(width / 36))}px 'Courier New', monospace`;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;

        // Top Left
        ctx.fillText("PLAY  \u25B6", 30, 40);
        ctx.fillText("SP", 30, 65);

        // Bottom Left Timecode
        const seconds = Math.floor(progress * 10);
        const secStr = String(seconds % 60).padStart(2, '0');
        const minStr = String(Math.floor(seconds / 60)).padStart(2, '0');
        ctx.fillText(`00:${minStr}:${secStr}`, 30, height - 35);
        ctx.fillText("OCT. 14 1994", width - 170, height - 35);
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.4);
    ctx.restore();
}

// 3. GLITCH MASTER (RGB Split, Slice Displacement, Digital Noise)
export function drawGlitchEffect(ctx, source, width, height, progress = 0, options = {}) {
    const intensity = options.intensity ?? 0.6; // 0.0 - 1.0
    const rgbShift = (options.rgbShift ?? 12) * intensity;
    const sliceCount = Math.floor((options.sliceRate ?? 6) * intensity);
    
    ctx.save();
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    if (!source) {
        ctx.restore();
        return;
    }

    // Base Aspect-Cover Frame
    drawImageCover(ctx, source, 0, 0, width, height, 1.0);

    // Slices
    if (intensity > 0.1 && sliceCount > 0) {
        for (let i = 0; i < sliceCount; i++) {
            const sliceY = Math.floor(Math.random() * height);
            const sliceH = Math.floor(Math.random() * (height / 8)) + 4;
            const sliceDx = (Math.random() - 0.5) * rgbShift * 3;
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, sliceY, width, sliceH);
            ctx.clip();
            drawImageCover(ctx, source, sliceDx, 0, width, height, 1.0);
            ctx.restore();
        }
    }

    // RGB Channel Split
    if (rgbShift > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Red Shift
        ctx.globalAlpha = 0.45 * intensity;
        drawImageCover(ctx, source, rgbShift, 0, width, height, 1.0);

        // Blue / Cyan Shift
        drawImageCover(ctx, source, -rgbShift, 0, width, height, 1.0);
        ctx.restore();
    }

    // Digital Noise Blocks
    if (intensity > 0.3) {
        ctx.save();
        const noiseBlocks = Math.floor(Math.random() * 4 * intensity);
        for (let i = 0; i < noiseBlocks; i++) {
            const bx = Math.random() * width;
            const by = Math.random() * height;
            const bw = Math.random() * 120 + 20;
            const bh = Math.random() * 25 + 5;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(245,179,1,0.25)';
            ctx.fillRect(bx, by, bw, bh);
        }
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.3);
    ctx.restore();
}

// 4. KINETIC TYPEWRITER FRAME RENDERER
export function drawTypewriterFrame(ctx, width, height, progress = 0, options = {}) {
    const text = options.text || "Every story begins with a single word.\nAnimationMaker creates the magic.";
    const fontColor = options.fontColor || '#FFFFFF';
    const fontFamily = options.fontFamily || "'Courier New', Courier, monospace";
    const cursorStyle = options.cursorStyle || 'block'; // 'block' | 'line' | 'underscore'
    const isDark = options.darkTheme !== false;

    ctx.save();
    ctx.fillStyle = isDark ? '#0F1015' : '#F5F5F0';
    ctx.fillRect(0, 0, width, height);

    // Subtle background grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const totalChars = text.length;
    const currentChars = Math.min(totalChars, Math.floor(progress * (totalChars + 4)));
    const visibleText = text.substring(0, currentChars);

    const isVertical = height > width;
    const fontSize = Math.floor(isVertical ? width / 18 : width / 28);
    const lineHeight = fontSize * 1.5;
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';

    const maxContentWidth = width * 0.82;
    const startX = (width - maxContentWidth) / 2;

    // Wrap text lines
    const paragraphs = visibleText.split('\n');
    const renderedLines = [];

    paragraphs.forEach((para) => {
        const words = para.split(' ');
        let currentLine = '';
        words.forEach((word) => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(testLine).width > maxContentWidth) {
                renderedLines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        renderedLines.push(currentLine);
    });

    const totalBlockHeight = renderedLines.length * lineHeight;
    const startY = Math.max(60, (height - totalBlockHeight) / 2);

    ctx.fillStyle = fontColor;
    renderedLines.forEach((line, idx) => {
        const lineY = startY + (idx * lineHeight);
        ctx.fillText(line, startX, lineY);

        // Draw cursor at the end of the last line
        if (idx === renderedLines.length - 1) {
            const isCursorBlink = Math.floor(progress * 24) % 2 === 0 || progress >= 1;
            if (isCursorBlink) {
                const lineWidth = ctx.measureText(line).width;
                const cursorX = startX + lineWidth + 4;
                ctx.fillStyle = '#F5B301';

                if (cursorStyle === 'block') {
                    ctx.fillRect(cursorX, lineY + 2, fontSize * 0.55, fontSize);
                } else if (cursorStyle === 'line') {
                    ctx.fillRect(cursorX, lineY + 2, 3, fontSize);
                } else {
                    ctx.fillRect(cursorX, lineY + fontSize - 4, fontSize * 0.6, 4);
                }
            }
        }
    });

    drawVignette(ctx, width, height, 0.35);
    ctx.restore();
}

// 5. SCANLINE CRT MONITOR RENDERER
export function drawScanlineEffect(ctx, source, width, height, progress = 0, options = {}) {
    const density = options.density ?? 4; // Scanline spacing (px)
    const glow = options.glow ?? 0.6;
    const flicker = (Math.sin(progress * 50) * 0.05);

    ctx.save();
    ctx.fillStyle = '#050709';
    ctx.fillRect(0, 0, width, height);

    if (!source) {
        ctx.restore();
        return;
    }

    // Draw base source with Aspect Cover
    drawImageCover(ctx, source, 0, 0, width, height, 1.0);

    // Phosphor Glow / Tint
    if (glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = 'rgba(0, 255, 180, 0.15)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    // Scanlines
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 + flicker})`;
    for (let y = 0; y < height; y += density) {
        ctx.fillRect(0, y, width, 1.5);
    }
    ctx.restore();

    // Moving CRT Beam Sweep
    const sweepY = (progress * height * 1.5) % height;
    const beamGradient = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
    beamGradient.addColorStop(0, 'rgba(255,255,255,0)');
    beamGradient.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    beamGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = beamGradient;
    ctx.fillRect(0, sweepY - 30, width, 60);

    // CRT Curved Screen Vignette
    drawVignette(ctx, width, height, 0.6);
    ctx.restore();
}

// 6. ASCII MATRIX ART RENDERER
export function drawAsciiEffect(ctx, source, width, height, progress = 0, options = {}) {
    const theme = options.theme || 'matrixGreen'; // 'matrixGreen' | 'cyberNeon' | 'retroAmber' | 'trueColor'
    const charResolution = options.resolution || 12; // cell size (px)
    const CHAR_MAP = "@%#*+=-:. ";

    ctx.save();
    ctx.fillStyle = '#020402';
    ctx.fillRect(0, 0, width, height);

    if (!source) {
        ctx.restore();
        return;
    }

    // Offscreen small sample canvas
    const sampleCols = Math.floor(width / charResolution);
    const sampleRows = Math.floor(height / charResolution);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = sampleCols;
    offCanvas.height = sampleRows;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    
    // Draw source scaled onto sample canvas with aspect cover
    drawImageCover(offCtx, source, 0, 0, sampleCols, sampleRows, 1.0);

    const imgData = offCtx.getImageData(0, 0, sampleCols, sampleRows);
    const pixels = imgData.data;

    ctx.font = `900 ${charResolution}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < sampleRows; r++) {
        for (let c = 0; c < sampleCols; c++) {
            const idx = (r * sampleCols + c) * 4;
            const red = pixels[idx];
            const green = pixels[idx + 1];
            const blue = pixels[idx + 2];
            const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;

            if (brightness > 0.08) {
                const charIdx = Math.floor((1 - brightness) * (CHAR_MAP.length - 1));
                const char = CHAR_MAP[charIdx] || ' ';
                const posX = (c * charResolution) + charResolution / 2;
                const posY = (r * charResolution) + charResolution / 2;

                if (theme === 'matrixGreen') {
                    ctx.fillStyle = `rgba(0, ${Math.floor(brightness * 255 + 50)}, 70, ${Math.min(1, brightness * 1.2)})`;
                } else if (theme === 'cyberNeon') {
                    ctx.fillStyle = `rgba(${Math.floor(brightness * 255)}, 0, ${Math.floor(brightness * 255 + 100)}, 1)`;
                } else if (theme === 'retroAmber') {
                    ctx.fillStyle = `rgba(255, ${Math.floor(brightness * 180 + 30)}, 0, 1)`;
                } else {
                    ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
                }

                ctx.fillText(char, posX, posY);
            }
        }
    }

    drawVignette(ctx, width, height, 0.5);
    ctx.restore();
}
