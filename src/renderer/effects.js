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

// 1. GLITCH MASTER (RGB Split, Slice Displacement, Digital Noise)
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

    // Base Frame
    ctx.drawImage(source, 0, 0, width, height);

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
            ctx.drawImage(source, sliceDx, 0, width, height);
            ctx.restore();
        }
    }

    // RGB Channel Split
    if (rgbShift > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        // Red Shift
        ctx.globalAlpha = 0.5 * intensity;
        ctx.fillStyle = 'rgba(255, 0, 50, 0.4)';
        ctx.drawImage(source, rgbShift, 0, width, height);

        // Blue / Cyan Shift
        ctx.fillStyle = 'rgba(0, 230, 255, 0.4)';
        ctx.drawImage(source, -rgbShift, 0, width, height);
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
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(0,240,255,0.3)';
            ctx.fillRect(bx, by, bw, bh);
        }
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.3);
    ctx.restore();
}

// 2. KINETIC TYPEWRITER FRAME RENDERER
export function drawTypewriterFrame(ctx, width, height, progress = 0, options = {}) {
    const text = options.text || "Every story begins with a single word.\nAnimationMaker creates the magic.";
    const fontColor = options.fontColor || '#FFFFFF';
    const fontFamily = options.fontFamily || "'Courier New', Courier, monospace";
    const cursorStyle = options.cursorStyle || 'block'; // 'block' | 'line' | 'underscore'
    const isDark = options.darkTheme !== false;

    ctx.save();
    ctx.fillStyle = isDark ? '#0A0A0C' : '#F5F5F0';
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

// 3. SCANLINE CRT MONITOR RENDERER
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

    // Draw base source
    ctx.drawImage(source, 0, 0, width, height);

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
    drawVignette(ctx, width, height, 0.7);
    ctx.restore();
}

// 4. ASCII MATRIX ART RENDERER
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
    offCtx.drawImage(source, 0, 0, sampleCols, sampleRows);

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