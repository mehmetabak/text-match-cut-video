// src/renderer/effects.js
import { t } from '../lib/i18n.js';

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
    const fontFamily = options.fontFamily || "'JetBrains Mono', 'Courier New', monospace";
    const cursorStyle = options.cursorStyle || 'block'; // 'block' | 'line' | 'underscore'
    const typewriterMode = options.typewriterMode || 'classic'; // 'classic' | 'terminal' | 'vintage'
    const isDark = options.darkTheme !== false;
    const isVertical = height > width;

    ctx.save();

    if (typewriterMode === 'vintage') {
        // ==========================================
        // 1. VINTAGE PAPER & TYPEWRITER MANUSCRIPT
        // ==========================================
        const bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.15, width / 2, height / 2, width * 0.85);
        bgGrad.addColorStop(0, '#1E1B18');
        bgGrad.addColorStop(0.6, '#12100E');
        bgGrad.addColorStop(1, '#080706');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const paperWidth = width * (isVertical ? 0.90 : 0.80);
        const paperHeight = height * (isVertical ? 0.86 : 0.80);
        const paperX = (width - paperWidth) / 2;
        const paperY = (height - paperHeight) / 2;

        // Realistic Soft Drop Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 36;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 14;

        // Archival Parchment Paper Sheet
        const paperGrad = ctx.createLinearGradient(paperX, paperY, paperX, paperY + paperHeight);
        paperGrad.addColorStop(0, '#FAF7EF');
        paperGrad.addColorStop(0.6, '#F5F0E4');
        paperGrad.addColorStop(1, '#EDE6D6');
        ctx.fillStyle = paperGrad;

        if (ctx.roundRect) {
            ctx.roundRect(paperX, paperY, paperWidth, paperHeight, 6);
            ctx.fill();
        } else {
            ctx.fillRect(paperX, paperY, paperWidth, paperHeight);
        }
        ctx.shadowColor = 'transparent';

        // Paper Double Micro-Border
        ctx.strokeStyle = '#DBD3C2';
        ctx.lineWidth = 1;
        ctx.strokeRect(paperX + 1, paperY + 1, paperWidth - 2, paperHeight - 2);

        // Vintage Letterhead Header & Stamp
        const stampFontSize = Math.max(10, Math.floor(width / 52));
        ctx.fillStyle = '#7C7365';
        ctx.font = `700 ${stampFontSize}px 'Courier New', Courier, monospace`;
        ctx.fillText("ROYAL IMPERIAL • 1954", paperX + 28, paperY + 28);

        // Dual Ribbon Color Indicators (Red / Black)
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(paperX + paperWidth - 40, paperY + 26, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.arc(paperX + paperWidth - 28, paperY + 26, 4, 0, Math.PI * 2);
        ctx.fill();

        // Header Hairline Rule
        ctx.strokeStyle = 'rgba(124, 115, 101, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(paperX + 28, paperY + 40);
        ctx.lineTo(paperX + paperWidth - 28, paperY + 40);
        ctx.stroke();

        // Calculate Typewriter Text & Progress
        const totalChars = text.length;
        const currentChars = Math.min(totalChars, Math.floor(progress * (totalChars + 4)));
        const visibleText = text.substring(0, currentChars);

        const fontSize = Math.floor(isVertical ? width / 18 : width / 26);
        const lineHeight = fontSize * 1.6;
        const textStartX = paperX + 28;
        const textStartY = paperY + 60;

        ctx.font = `700 ${fontSize}px 'Courier New', Courier, monospace`;
        ctx.textBaseline = 'top';

        const maxTextWidth = paperWidth - 56;
        const paragraphs = visibleText.split('\n');
        const renderedLines = [];

        paragraphs.forEach((para) => {
            const words = para.split(' ');
            let currentLine = '';
            words.forEach((word) => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (ctx.measureText(testLine).width > maxTextWidth) {
                    renderedLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            renderedLines.push(currentLine);
        });

        // Deep carbon typewriter ribbon ink
        ctx.fillStyle = '#1A1816';

        renderedLines.forEach((line, idx) => {
            const lineY = textStartY + (idx * lineHeight);
            if (lineY + lineHeight <= paperY + paperHeight - 16) {
                ctx.fillText(line, textStartX, lineY);

                // Cursor on last line
                if (idx === renderedLines.length - 1) {
                    const isBlink = Math.floor(progress * 24) % 2 === 0 || progress >= 1;
                    if (isBlink) {
                        const lineWidth = ctx.measureText(line).width;
                        const cursorX = textStartX + lineWidth + 4;
                        ctx.fillStyle = '#DC2626'; // Ribbon strike color

                        if (cursorStyle === 'block') {
                            ctx.fillRect(cursorX, lineY + 1, fontSize * 0.52, fontSize);
                        } else if (cursorStyle === 'line') {
                            ctx.fillRect(cursorX, lineY + 1, 3, fontSize);
                        } else {
                            ctx.fillRect(cursorX, lineY + fontSize - 3, fontSize * 0.6, 4);
                        }
                    }
                }
            }
        });

        drawVignette(ctx, width, height, 0.4);

    } else if (typewriterMode === 'terminal') {
        // ==========================================
        // 2. MODERN TERMINAL WINDOW
        // ==========================================
        ctx.fillStyle = '#090A0F';
        ctx.fillRect(0, 0, width, height);

        // Subtle Cyber Grid Lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
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

        const winWidth = width * (isVertical ? 0.92 : 0.84);
        const winHeight = height * (isVertical ? 0.86 : 0.80);
        const winX = (width - winWidth) / 2;
        const winY = (height - winHeight) / 2;

        // Terminal Window Chassis (#10121A)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 36;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 16;
        ctx.fillStyle = '#10121A';
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, winHeight);
        }
        ctx.shadowColor = 'transparent';

        // Glowing Neon Accent Border
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.5;
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.stroke();
        } else {
            ctx.strokeRect(winX, winY, winWidth, winHeight);
        }

        // Window Title Bar
        const titleBarHeight = Math.max(32, Math.floor(winHeight / 12));
        ctx.fillStyle = '#161922';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(winX, winY, winWidth, titleBarHeight, [10, 10, 0, 0]);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, titleBarHeight);
        }

        // macOS Traffic Lights (Red, Yellow, Green)
        const dotRadius = Math.max(4, Math.floor(titleBarHeight / 5.5));
        const dotY = winY + titleBarHeight / 2;
        
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(winX + 18, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(winX + 34, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(winX + 50, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Terminal Title Badge
        ctx.fillStyle = '#94A3B8';
        ctx.font = `600 ${Math.max(11, Math.floor(titleBarHeight / 2.6))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("bash — animationmaker.sh", winX + winWidth / 2, dotY + 4);
        ctx.textAlign = 'left';

        // Calculate Visible Text
        const totalChars = text.length;
        const currentChars = Math.min(totalChars, Math.floor(progress * (totalChars + 4)));
        const visibleText = text.substring(0, currentChars);

        const fontSize = Math.floor(isVertical ? width / 18 : width / 28);
        const lineHeight = fontSize * 1.55;
        const textStartX = winX + (isVertical ? 38 : 52);
        const textStartY = winY + titleBarHeight + 24;

        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        const maxContentWidth = winWidth - (isVertical ? 50 : 70);
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

        renderedLines.forEach((line, idx) => {
            const lineY = textStartY + (idx * lineHeight);
            if (lineY + lineHeight <= winY + winHeight - 16) {
                // Line Number Gutter (01, 02, 03)
                ctx.fillStyle = '#475569';
                ctx.font = `600 ${Math.floor(fontSize * 0.85)}px ${fontFamily}`;
                const lineNumStr = String(idx + 1).padStart(2, '0');
                ctx.fillText(lineNumStr, winX + 16, lineY + 2);

                // Line text in fontColor
                ctx.font = `700 ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = fontColor || '#FFFFFF';
                ctx.fillText(line, textStartX, lineY);

                // Cursor on last line with glowing cyber aura
                if (idx === renderedLines.length - 1) {
                    const isBlink = Math.floor(progress * 24) % 2 === 0 || progress >= 1;
                    if (isBlink) {
                        const lineWidth = ctx.measureText(line).width;
                        const cursorX = textStartX + lineWidth + 3;

                        ctx.shadowColor = '#F5B301';
                        ctx.shadowBlur = 10;
                        ctx.fillStyle = '#F5B301';

                        if (cursorStyle === 'block') {
                            ctx.fillRect(cursorX, lineY + 2, fontSize * 0.55, fontSize);
                        } else if (cursorStyle === 'line') {
                            ctx.fillRect(cursorX, lineY + 2, 3, fontSize);
                        } else {
                            ctx.fillRect(cursorX, lineY + fontSize - 3, fontSize * 0.6, 4);
                        }
                        ctx.shadowColor = 'transparent';
                    }
                }
            }
        });

        drawVignette(ctx, width, height, 0.35);

    } else {
        // ==========================================
        // 3. CLASSIC MINIMAL FULL-FRAME (DEFAULT)
        // ==========================================
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
    }

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

// 7. GOOGLE SEARCH CINEMATIC ANIMATOR (100% I18N & PROPORTIONATE RESPONSIVE UI)
export function drawGoogleSearchEffect(ctx, source, width, height, progress = 0, options = {}) {
    const lang = options.lang || 'tr';
    const query = options.query || t('gsearchQueryDefault', lang);
    const headline = options.headline || t('gsearchHeadlineDefault', lang);
    const snippet = options.snippet || t('gsearchSnippetDefault', lang);
    const displayUrl = options.url || "https://animationmaker.m0s.space › effects";
    const isDark = options.theme !== 'light';

    ctx.save();

    // Theme Colors
    const bg = isDark ? '#202124' : '#FFFFFF';
    const textMain = isDark ? '#E8EAED' : '#202124';
    const textMuted = isDark ? '#9AA0A6' : '#70757A';
    const barBg = isDark ? '#303134' : '#FFFFFF';
    const barBorder = isDark ? '#5F6368' : '#DFE1E5';
    const linkBlue = isDark ? '#8AB4F8' : '#1A0DAB';
    const cardBg = isDark ? '#303134' : '#F8F9FA';
    const dividerCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const isVertical = height > width;
    const mScale = isVertical ? (width / 390) : (width / 1280);

    // Helper: Rounded Rectangle
    function roundRect(context, x, y, w, h, radius) {
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + w - radius, y);
        context.quadraticCurveTo(x + w, y, x + w, y + radius);
        context.lineTo(x + w, y + h - radius);
        context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        context.lineTo(x + radius, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
    }

    // Helper: Draw Google Logo Letters (Sleek Product Sans / Google Sans weight)
    function drawGoogleLogo(context, x, y, size) {
        const letters = [
            { char: 'G', color: '#4285F4' },
            { char: 'o', color: '#EA4335' },
            { char: 'o', color: '#FBBC05' },
            { char: 'g', color: '#4285F4' },
            { char: 'l', color: '#34A853' },
            { char: 'e', color: '#EA4335' }
        ];
        context.save();
        context.font = `500 ${size}px "Product Sans", "Google Sans", "Outfit", "Inter", -apple-system, sans-serif`;
        context.textBaseline = 'middle';
        let currentX = x;
        letters.forEach((l) => {
            context.fillStyle = l.color;
            context.fillText(l.char, currentX, y);
            currentX += context.measureText(l.char).width + (size * 0.025);
        });
        context.restore();
    }

    // Helper: Vector Magnifying Glass
    function drawMagnifier(context, cx, cy, size, color) {
        context.save();
        context.strokeStyle = color;
        context.lineWidth = Math.max(1.8, size * 0.14);
        context.lineCap = 'round';
        const r = size * 0.35;
        context.beginPath();
        context.arc(cx - (size * 0.1), cy - (size * 0.1), r, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(cx + (size * 0.15), cy + (size * 0.15));
        context.lineTo(cx + (size * 0.42), cy + (size * 0.42));
        context.stroke();
        context.restore();
    }

    // Helper: Vector Microphone (Modern Minimalist Google Style)
    function drawMic(context, cx, cy, size) {
        context.save();
        const scale = size / 20;
        const baseColor = isDark ? '#9AA0A6' : '#5F6368';
        context.lineWidth = 1.6 * scale;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // Capsule (Google Blue accent)
        context.fillStyle = '#4285F4';
        roundRect(context, cx - (3.2 * scale), cy - (8 * scale), 6.4 * scale, 10.5 * scale, 3.2 * scale);
        context.fill();

        // Stand arc
        context.strokeStyle = baseColor;
        context.beginPath();
        context.arc(cx, cy - (1.5 * scale), 5.8 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
        context.stroke();

        // Stand base
        context.beginPath();
        context.moveTo(cx, cy + (4.3 * scale));
        context.lineTo(cx, cy + (7.5 * scale));
        context.stroke();
        context.restore();
    }

    // Helper: Vector Google Lens Camera (Modern Clean Minimalist Style)
    function drawCameraLens(context, cx, cy, size) {
        context.save();
        const scale = size / 20;
        const frameColor = isDark ? '#9AA0A6' : '#5F6368';
        context.lineWidth = 1.6 * scale;
        context.lineCap = 'round';
        context.lineJoin = 'round';

        // Camera frame / viewfinder
        context.strokeStyle = frameColor;
        roundRect(context, cx - (7.5 * scale), cy - (6 * scale), 15 * scale, 12.5 * scale, 3.5 * scale);
        context.stroke();

        // Center lens circle (Google Blue accent)
        context.strokeStyle = '#4285F4';
        context.beginPath();
        context.arc(cx, cy + (0.3 * scale), 3.2 * scale, 0, Math.PI * 2);
        context.stroke();

        // Sensor / flash dot (Google Red accent)
        context.fillStyle = '#EA4335';
        context.beginPath();
        context.arc(cx + (4.2 * scale), cy - (2.8 * scale), 1.1 * scale, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }

    // Helper: Vector AI Modu Pill Badge
    function drawAiPill(context, x, y, h, isDarkMode) {
        context.save();
        const pillW = Math.round(86 * mScale);
        const pillH = Math.round(h * 0.72);
        const pillY = y + (h - pillH) / 2;
        context.fillStyle = isDarkMode ? '#3C4043' : '#F1F3F4';
        roundRect(context, x, pillY, pillW, pillH, pillH / 2);
        context.fill();

        context.fillStyle = '#8AB4F8';
        context.font = `700 ${Math.round(12 * mScale)}px sans-serif`;
        context.textBaseline = 'middle';
        context.fillText('✨', x + Math.round(8 * mScale), pillY + (pillH / 2));

        context.fillStyle = isDarkMode ? '#E8EAED' : '#202124';
        context.font = `600 ${Math.round(11 * mScale)}px "Inter", sans-serif`;
        context.fillText(t('gsearchAiMode', lang), x + Math.round(26 * mScale), pillY + (pillH / 2));
        context.restore();
    }

    // Helper: 9-dot Google Apps Grid Icon
    function drawGoogleAppsGrid(context, cx, cy, size, color) {
        context.save();
        context.fillStyle = color;
        const dotR = Math.max(1.4, size / 8);
        const step = size / 2.2;
        for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
                context.beginPath();
                context.arc(cx + (c * step), cy + (r * step), dotR, 0, Math.PI * 2);
                context.fill();
            }
        }
        context.restore();
    }

    // Helper: Vector Clock Icon for suggestions
    function drawClockIcon(context, cx, cy, size, color) {
        context.save();
        context.strokeStyle = color;
        context.lineWidth = 1.8;
        context.beginPath();
        context.arc(cx, cy, size / 2, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(cx, cy - (size * 0.3));
        context.lineTo(cx, cy);
        context.lineTo(cx + (size * 0.28), cy);
        context.stroke();
        context.restore();
    }

    // Helper: Draw Text with Wrap and Max Lines inside Clip
    function drawWrappedText(context, text, startX, startY, maxW, lineH, maxLines, fontStyle, fillStyle) {
        context.save();
        context.font = fontStyle;
        context.fillStyle = fillStyle;
        context.textBaseline = 'top';

        const words = (text || '').split(' ');
        let currentLine = '';
        let lineCount = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (context.measureText(testLine).width > maxW && currentLine) {
                context.fillText(currentLine, startX, startY + (lineCount * lineH));
                lineCount++;
                currentLine = word;
                if (lineCount >= maxLines - 1) {
                    let truncateLine = currentLine;
                    while (context.measureText(truncateLine + '...').width > maxW && truncateLine.length > 0) {
                        truncateLine = truncateLine.slice(0, -1);
                    }
                    context.fillText(truncateLine + '...', startX, startY + (lineCount * lineH));
                    lineCount++;
                    break;
                }
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine && lineCount < maxLines) {
            context.fillText(currentLine, startX, startY + (lineCount * lineH));
            lineCount++;
        }
        context.restore();
        return lineCount * lineH;
    }

    // ==========================================
    // STAGE 1: Homepage Search (0% to 48%)
    // ==========================================
    if (progress < 0.48) {
        const totalChars = query.length;
        const typingEndP = 0.36; // Yazım 0.36'da %100 eksiksiz biter
        const typingProgress = Math.min(1, progress / typingEndP);
        const typedCount = Math.min(totalChars, Math.floor(typingProgress * totalChars));
        const currentTypedText = query.substring(0, typedCount);
        const isTypingDone = typedCount >= totalChars;

        // Stage 1 Top Navigation Bar (Header)
        const topNavY = Math.floor(isVertical ? (20 * mScale) : (24 * mScale));
        const avatarR = Math.floor(isVertical ? (14 * mScale) : (16 * mScale));
        const avatarX = width - Math.floor(isVertical ? (22 * mScale) : (32 * mScale));

        // User Avatar Circle (Right)
        ctx.fillStyle = '#1A73E8';
        ctx.beginPath();
        ctx.arc(avatarX, topNavY, avatarR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${Math.floor(isVertical ? 11 * mScale : 13 * mScale)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', avatarX, topNavY);
        ctx.textAlign = 'left';

        // 9-dot Google Apps Grid Icon
        const appsX = avatarX - Math.floor(isVertical ? (28 * mScale) : (38 * mScale));
        drawGoogleAppsGrid(ctx, appsX, topNavY, Math.floor(14 * mScale), textMuted);

        // Desktop Gmail & Images Links
        if (!isVertical) {
            ctx.font = `400 ${Math.floor(13 * mScale)}px "Google Sans", "Inter", sans-serif`;
            ctx.fillStyle = textMain;
            ctx.textBaseline = 'middle';
            const imgText = t('gsearchNavImages', lang);
            const imgW = ctx.measureText(imgText).width;
            const imgX = appsX - imgW - Math.floor(20 * mScale);
            ctx.fillText(imgText, imgX, topNavY);

            const gmailText = t('gsearchNavGmail', lang);
            const gmailW = ctx.measureText(gmailText).width;
            const gmailX = imgX - gmailW - Math.floor(16 * mScale);
            ctx.fillText(gmailText, gmailX, topNavY);
        }

        // Mobile vs Desktop Logo and Bar Dimensions
        const logoSize = Math.floor(isVertical ? (32 * mScale) : (48 * mScale));
        const logoTotalW = logoSize * 3.75;
        const logoX = (width - logoTotalW) / 2;
        const logoY = isVertical ? (height * 0.30) : (height * 0.26);

        drawGoogleLogo(ctx, logoX, logoY, logoSize);

        // Search Bar (92% width on vertical mobile)
        const barW = isVertical ? Math.floor(width * 0.92) : Math.min(width * 0.65, Math.floor(680 * mScale));
        const barH = Math.floor(52 * mScale);
        const barX = (width - barW) / 2;
        const barY = logoY + (logoSize * 1.30);

        // Search Bar Outer Shadow
        ctx.save();
        if (!isDark) {
            ctx.shadowColor = 'rgba(32,33,36,0.18)';
            ctx.shadowBlur = 14 * mScale;
            ctx.shadowOffsetY = 4 * mScale;
        }
        ctx.fillStyle = barBg;
        roundRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.fill();
        ctx.restore();

        // Search Bar Border
        ctx.strokeStyle = barBorder;
        ctx.lineWidth = 1.4;
        roundRect(ctx, barX, barY, barW, barH, barH / 2);
        ctx.stroke();

        // Left Magnifier Icon
        const iconSize = Math.floor(18 * mScale);
        drawMagnifier(ctx, barX + Math.floor(22 * mScale), barY + (barH / 2), iconSize, textMuted);

        // Right Icons Cluster
        const showAiPill = !isVertical && barW > 540 * mScale;
        const rightClusterW = showAiPill ? Math.floor(150 * mScale) : Math.floor(75 * mScale);
        const rightStartX = barX + barW - rightClusterW;

        if (showAiPill) {
            drawAiPill(ctx, rightStartX, barY, barH, isDark);
            drawMic(ctx, rightStartX + Math.floor(96 * mScale), barY + (barH / 2), iconSize);
            drawCameraLens(ctx, rightStartX + Math.floor(124 * mScale), barY + (barH / 2), iconSize);
        } else {
            drawMic(ctx, barX + barW - Math.floor(46 * mScale), barY + (barH / 2), iconSize);
            drawCameraLens(ctx, barX + barW - Math.floor(20 * mScale), barY + (barH / 2), iconSize);
        }

        // Search Query Text (Strictly Clipped)
        const textLeftOffset = Math.floor(48 * mScale);
        const textStartX = barX + textLeftOffset;
        const maxTextW = barW - textLeftOffset - rightClusterW - Math.floor(12 * mScale);
        const fontSize = Math.floor(16 * mScale);

        ctx.save();
        ctx.beginPath();
        ctx.rect(textStartX, barY, maxTextW, barH);
        ctx.clip();

        ctx.font = `500 ${fontSize}px "Google Sans", "Inter", -apple-system, sans-serif`;
        ctx.textBaseline = 'middle';

        if (!currentTypedText) {
            ctx.fillStyle = textMuted;
            ctx.fillText(t('gsearchPlaceholder', lang), textStartX, barY + (barH / 2));
        } else {
            ctx.fillStyle = textMain;
            const fullW = ctx.measureText(currentTypedText).width;
            let drawX = textStartX;
            if (fullW > maxTextW) {
                drawX = textStartX - (fullW - maxTextW);
            }
            ctx.fillText(currentTypedText, drawX, barY + (barH / 2));

            // Blinking Cursor
            if (Math.floor(progress * 22) % 2 === 0 || isTypingDone) {
                ctx.fillStyle = '#4285F4';
                ctx.fillRect(drawX + fullW + Math.floor(2 * mScale), barY + (barH * 0.22), Math.floor(2.4 * mScale), barH * 0.56);
            }
        }
        ctx.restore();

        // Autocomplete Dropdown Suggestions Card
        if (typedCount > 2) {
            const dropY = barY + barH + Math.floor(8 * mScale);
            const dropRowH = Math.floor(44 * mScale);
            const suggestions = [
                currentTypedText,
                `${currentTypedText} tutorial`,
                `${currentTypedText} online free`
            ];
            const dropH = (suggestions.length * dropRowH) + Math.floor(12 * mScale);

            ctx.fillStyle = barBg;
            roundRect(ctx, barX, dropY, barW, dropH, Math.floor(16 * mScale));
            ctx.fill();
            ctx.strokeStyle = barBorder;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            suggestions.forEach((sug, sIdx) => {
                const sugY = dropY + Math.floor(6 * mScale) + (sIdx * dropRowH) + (dropRowH / 2);
                const isSelected = (sIdx === 0 && isTypingDone && progress >= 0.40);

                if (isSelected) {
                    ctx.fillStyle = isDark ? '#3C4043' : '#F1F3F4';
                    roundRect(ctx, barX + 3, dropY + Math.floor(6 * mScale) + (sIdx * dropRowH), barW - 6, dropRowH, Math.floor(10 * mScale));
                    ctx.fill();
                }

                drawClockIcon(ctx, barX + Math.floor(22 * mScale), sugY, Math.floor(16 * mScale), isSelected ? linkBlue : textMuted);

                ctx.save();
                ctx.beginPath();
                ctx.rect(barX + Math.floor(46 * mScale), sugY - (dropRowH / 2), barW - Math.floor(80 * mScale), dropRowH);
                ctx.clip();
                ctx.fillStyle = isSelected ? linkBlue : textMain;
                ctx.font = `${isSelected ? '600' : '500'} ${Math.floor(15 * mScale)}px "Google Sans", "Inter", sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillText(sug, barX + Math.floor(46 * mScale), sugY);
                ctx.restore();

                if (isSelected) {
                    ctx.fillStyle = linkBlue;
                    ctx.font = `600 ${Math.floor(13 * mScale)}px sans-serif`;
                    ctx.textBaseline = 'middle';
                    ctx.fillText('↵', barX + barW - Math.floor(28 * mScale), sugY);
                }

                if (sIdx < suggestions.length - 1) {
                    ctx.strokeStyle = dividerCol;
                    ctx.beginPath();
                    ctx.moveTo(barX + Math.floor(16 * mScale), dropY + Math.floor(6 * mScale) + ((sIdx + 1) * dropRowH));
                    ctx.lineTo(barX + barW - Math.floor(16 * mScale), dropY + Math.floor(6 * mScale) + ((sIdx + 1) * dropRowH));
                    ctx.stroke();
                }
            });
        } else if (!isVertical) {
            // Desktop Action Buttons below Search Bar
            const btnRowY = barY + barH + Math.floor(24 * mScale);
            const btn1Text = t('gsearchBtnSearch', lang);
            const btn2Text = t('gsearchBtnLucky', lang);
            ctx.font = `500 ${Math.floor(13 * mScale)}px "Google Sans", "Inter", sans-serif`;

            const b1W = ctx.measureText(btn1Text).width + Math.floor(28 * mScale);
            const b2W = ctx.measureText(btn2Text).width + Math.floor(28 * mScale);
            const totalBtnsW = b1W + b2W + Math.floor(14 * mScale);
            const btn1X = (width - totalBtnsW) / 2;
            const btn2X = btn1X + b1W + Math.floor(14 * mScale);
            const btnH = Math.floor(34 * mScale);

            [
                { x: btn1X, w: b1W, label: btn1Text },
                { x: btn2X, w: b2W, label: btn2Text }
            ].forEach(btn => {
                ctx.fillStyle = isDark ? '#303134' : '#F8F9FA';
                roundRect(ctx, btn.x, btnRowY, btn.w, btnH, Math.floor(6 * mScale));
                ctx.fill();
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                ctx.stroke();

                ctx.fillStyle = textMain;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(btn.label, btn.x + (btn.w / 2), btnRowY + (btnH / 2));
                ctx.textAlign = 'left';
            });
        } else if (isVertical) {
            // Mobile Shortcuts Grid Below (fills lower half naturally!)
            const shortcutsY = barY + barH + Math.floor(36 * mScale);
            const shortcuts = [
                { name: 'YouTube', col: '#EA4335', icon: '▶' },
                { name: 'Wikipedia', col: '#5F6368', icon: 'W' },
                { name: 'Instagram', col: '#E1306C', icon: '📷' },
                { name: 'X / Twitter', col: '#1DA1F2', icon: '𝕏' }
            ];
            const scSpacing = barW / 4;
            shortcuts.forEach((sc, scIdx) => {
                const scX = barX + (scSpacing * scIdx) + (scSpacing / 2);
                const scR = Math.floor(22 * mScale);

                ctx.fillStyle = isDark ? '#303134' : '#F1F3F4';
                ctx.beginPath();
                ctx.arc(scX, shortcutsY + scR, scR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = sc.col;
                ctx.font = `700 ${Math.floor(14 * mScale)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(sc.icon, scX, shortcutsY + scR);

                ctx.fillStyle = textMuted;
                ctx.font = `500 ${Math.floor(11 * mScale)}px "Google Sans", sans-serif`;
                ctx.fillText(sc.name, scX, shortcutsY + (scR * 2) + Math.floor(10 * mScale));
                ctx.textAlign = 'left';
            });
        }
    }
    // ==========================================
    // STAGE 2: Search Results Page (48% to 100%)
    // ==========================================
    else {
        // TOP HEADER BAR
        const topBarH = Math.floor(60 * mScale);

        ctx.fillStyle = isDark ? '#303134' : '#FFFFFF';
        ctx.fillRect(0, 0, width, topBarH);
        ctx.strokeStyle = dividerCol;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topBarH);
        ctx.lineTo(width, topBarH);
        ctx.stroke();

        // Animated Top Blue Loading Bar during transition (Fast instant burst: 48% to 51.5%)
        if (progress >= 0.48 && progress < 0.515) {
            const rawP = (progress - 0.48) / 0.03;
            const loadP = Math.min(1, rawP * 1.25);
            ctx.fillStyle = '#4285F4';
            ctx.fillRect(0, 0, width * loadP, Math.floor(3.5 * mScale));
        }

        // Google Logo Left
        const logoSize = Math.floor(20 * mScale);
        drawGoogleLogo(ctx, Math.floor(isVertical ? 14 * mScale : 28 * mScale), topBarH / 2, logoSize);

        // Header Search Bar Pill
        const miniBarX = Math.floor(isVertical ? 86 * mScale : 175 * mScale);
        const miniBarW = isVertical ? width - miniBarX - Math.floor(52 * mScale) : Math.min(Math.floor(width * 0.52), Math.floor(600 * mScale));
        const miniBarH = Math.floor(38 * mScale);
        const miniBarY = (topBarH - miniBarH) / 2;

        ctx.fillStyle = isDark ? '#202124' : '#F1F3F4';
        roundRect(ctx, miniBarX, miniBarY, miniBarW, miniBarH, miniBarH / 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.rect(miniBarX + Math.floor(12 * mScale), miniBarY, miniBarW - Math.floor(24 * mScale), miniBarH);
        ctx.clip();
        ctx.fillStyle = textMain;
        ctx.font = `500 ${Math.floor(14 * mScale)}px "Google Sans", "Inter", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(query, miniBarX + Math.floor(12 * mScale), topBarH / 2);
        ctx.restore();

        // User Avatar Circle (Right)
        const avatarX = width - Math.floor(isVertical ? 24 * mScale : 34 * mScale);
        const avatarY = topBarH / 2;
        const avatarR = Math.floor(15 * mScale);
        ctx.fillStyle = '#1A73E8';
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${Math.floor(13 * mScale)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', avatarX, avatarY);
        ctx.textAlign = 'left';

        // Apps 9-dot grid icon (Desktop)
        if (!isVertical) {
            drawGoogleAppsGrid(ctx, avatarX - Math.floor(36 * mScale), avatarY, Math.floor(14 * mScale), textMuted);
        }

        // FILTER TABS
        const tabY = topBarH + Math.floor(14 * mScale);
        const tabs = [
            { name: t('gsearchTabAll', lang), active: true },
            { name: t('gsearchTabVideos', lang), active: false },
            { name: t('gsearchTabImages', lang), active: false },
            { name: t('gsearchTabNews', lang), active: false }
        ];

        let tabX = Math.floor(isVertical ? 14 * mScale : 175 * mScale);
        tabs.forEach((tab) => {
            ctx.font = `600 ${Math.floor(13 * mScale)}px "Google Sans", "Inter", sans-serif`;
            const tabTextW = ctx.measureText(tab.name).width;

            if (isVertical) {
                const pillPad = Math.floor(12 * mScale);
                const pillW = tabTextW + (pillPad * 2);
                if (tab.active) {
                    ctx.fillStyle = isDark ? '#3C4043' : '#E8F0FE';
                    roundRect(ctx, tabX, tabY - Math.floor(8 * mScale), pillW, Math.floor(30 * mScale), Math.floor(15 * mScale));
                    ctx.fill();
                    ctx.fillStyle = linkBlue;
                } else {
                    ctx.strokeStyle = dividerCol;
                    roundRect(ctx, tabX, tabY - Math.floor(8 * mScale), pillW, Math.floor(30 * mScale), Math.floor(15 * mScale));
                    ctx.stroke();
                    ctx.fillStyle = textMuted;
                }
                ctx.fillText(tab.name, tabX + pillPad, tabY + Math.floor(7 * mScale));
                tabX += pillW + Math.floor(8 * mScale);
            } else {
                if (tab.active) {
                    ctx.fillStyle = linkBlue;
                    ctx.fillText(tab.name, tabX, tabY);
                    ctx.fillRect(tabX, tabY + Math.floor(6 * mScale), tabTextW, Math.floor(3 * mScale));
                } else {
                    ctx.fillStyle = textMuted;
                    ctx.fillText(tab.name, tabX, tabY);
                }
                tabX += tabTextW + Math.floor(26 * mScale);
            }
        });

        // Content Bounds
        const contentX = Math.floor(isVertical ? 14 * mScale : 175 * mScale);
        const contentW = isVertical ? width - (contentX * 2) : Math.min(Math.floor(width * 0.52), Math.floor(640 * mScale));
        let currentCardY = tabY + Math.floor(isVertical ? 34 * mScale : 26 * mScale);

        if (!isVertical) {
            ctx.font = `400 ${Math.floor(12 * mScale)}px "Inter", sans-serif`;
            ctx.fillStyle = textMuted;
            ctx.fillText('About 1,840,000,000 results (0.28 seconds)', contentX, currentCardY);
            currentCardY += Math.floor(16 * mScale);
        }

        // ==========================================
        // #1 FEATURED KNOWLEDGE / ORGANIC RESULT CARD
        // ==========================================
        if (source) {
            if (isVertical) {
                // Mobile 9:16 Banner Card
                const bannerH = Math.floor(contentW * 0.52);
                const textPad = Math.floor(16 * mScale);
                const cardH = bannerH + Math.floor(160 * mScale);

                ctx.fillStyle = cardBg;
                roundRect(ctx, contentX, currentCardY, contentW, cardH, Math.floor(18 * mScale));
                ctx.fill();
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // 16:9 Banner Preview
                ctx.save();
                roundRect(ctx, contentX + 4, currentCardY + 4, contentW - 8, bannerH, Math.floor(15 * mScale));
                ctx.clip();
                drawImageCover(ctx, source, contentX + 4, currentCardY + 4, contentW - 8, bannerH, 1.05);
                ctx.restore();

                // URL & Favicon
                const textStartY = currentCardY + bannerH + Math.floor(14 * mScale);
                ctx.fillStyle = '#FBBC05';
                ctx.beginPath();
                ctx.arc(contentX + textPad + Math.floor(8 * mScale), textStartY + Math.floor(6 * mScale), Math.floor(7 * mScale), 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = textMuted;
                ctx.font = `600 ${Math.floor(12 * mScale)}px "Google Sans", monospace`;
                ctx.fillText(displayUrl, contentX + textPad + Math.floor(20 * mScale), textStartY + Math.floor(6 * mScale));

                // Headline
                const headlineH = drawWrappedText(
                    ctx, headline, contentX + textPad, textStartY + Math.floor(22 * mScale),
                    contentW - (textPad * 2), Math.floor(24 * mScale), 2,
                    `700 ${Math.floor(18 * mScale)}px "Google Sans", "Inter", sans-serif`, linkBlue
                );

                // Snippet
                drawWrappedText(
                    ctx, snippet, contentX + textPad, textStartY + Math.floor(24 * mScale) + headlineH,
                    contentW - (textPad * 2), Math.floor(18 * mScale), 2,
                    `400 ${Math.floor(13 * mScale)}px "Inter", sans-serif`, textMain
                );

                currentCardY += cardH + Math.floor(16 * mScale);
            } else {
                // Desktop 16:9 2-Column Card
                const thumbW = Math.min(Math.floor(220 * mScale), Math.floor(contentW * 0.34));
                const thumbH = Math.floor(150 * mScale);
                const cardH = Math.floor(176 * mScale);

                ctx.fillStyle = cardBg;
                roundRect(ctx, contentX, currentCardY, contentW, cardH, Math.floor(16 * mScale));
                ctx.fill();
                ctx.strokeStyle = dividerCol;
                ctx.stroke();

                const textColW = contentW - thumbW - Math.floor(36 * mScale);

                ctx.fillStyle = '#FBBC05';
                ctx.beginPath();
                ctx.arc(contentX + Math.floor(22 * mScale), currentCardY + Math.floor(22 * mScale), Math.floor(7 * mScale), 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = textMuted;
                ctx.font = `500 ${Math.floor(12 * mScale)}px monospace`;
                ctx.fillText(displayUrl, contentX + Math.floor(36 * mScale), currentCardY + Math.floor(22 * mScale));

                const headlineH = drawWrappedText(
                    ctx, headline, contentX + Math.floor(16 * mScale), currentCardY + Math.floor(38 * mScale),
                    textColW, Math.floor(24 * mScale), 2,
                    `700 ${Math.floor(18 * mScale)}px "Google Sans", "Inter", sans-serif`, linkBlue
                );

                drawWrappedText(
                    ctx, snippet, contentX + Math.floor(16 * mScale), currentCardY + Math.floor(40 * mScale) + headlineH,
                    textColW, Math.floor(18 * mScale), 3,
                    `400 ${Math.floor(13 * mScale)}px "Inter", sans-serif`, textMain
                );

                const thumbX = contentX + contentW - thumbW - Math.floor(14 * mScale);
                const thumbY = currentCardY + (cardH - thumbH) / 2;

                ctx.save();
                roundRect(ctx, thumbX, thumbY, thumbW, thumbH, Math.floor(12 * mScale));
                ctx.clip();
                drawImageCover(ctx, source, thumbX, thumbY, thumbW, thumbH, 1.05);
                ctx.restore();

                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
                roundRect(ctx, thumbX, thumbY, thumbW, thumbH, Math.floor(12 * mScale));
                ctx.stroke();

                currentCardY += cardH + Math.floor(14 * mScale);
            }
        } else {
            // Clean Card No Media
            const cardH = Math.floor(130 * mScale);
            ctx.fillStyle = cardBg;
            roundRect(ctx, contentX, currentCardY, contentW, cardH, Math.floor(16 * mScale));
            ctx.fill();
            ctx.strokeStyle = dividerCol;
            ctx.stroke();

            ctx.fillStyle = '#FBBC05';
            ctx.beginPath();
            ctx.arc(contentX + Math.floor(22 * mScale), currentCardY + Math.floor(20 * mScale), Math.floor(7 * mScale), 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = textMuted;
            ctx.font = `500 ${Math.floor(12 * mScale)}px monospace`;
            ctx.fillText(displayUrl, contentX + Math.floor(36 * mScale), currentCardY + Math.floor(20 * mScale));

            const headlineH = drawWrappedText(
                ctx, headline, contentX + Math.floor(16 * mScale), currentCardY + Math.floor(36 * mScale),
                contentW - Math.floor(32 * mScale), Math.floor(24 * mScale), 2,
                `700 ${Math.floor(18 * mScale)}px "Google Sans", "Inter", sans-serif`, linkBlue
            );

            drawWrappedText(
                ctx, snippet, contentX + Math.floor(16 * mScale), currentCardY + Math.floor(38 * mScale) + headlineH,
                contentW - Math.floor(32 * mScale), Math.floor(18 * mScale), 2,
                `400 ${Math.floor(13 * mScale)}px "Inter", sans-serif`, textMain
            );

            currentCardY += cardH + Math.floor(16 * mScale);
        }

        // ==========================================
        // "PEOPLE ALSO ASK" (Kullanıcılar Şunları da Sordu)
        // ==========================================
        if (isVertical && currentCardY < height - Math.floor(180 * mScale)) {
            const paaCardH = Math.floor(100 * mScale);
            ctx.fillStyle = cardBg;
            roundRect(ctx, contentX, currentCardY, contentW, paaCardH, Math.floor(16 * mScale));
            ctx.fill();
            ctx.strokeStyle = dividerCol;
            ctx.stroke();

            ctx.fillStyle = textMain;
            ctx.font = `700 ${Math.floor(14 * mScale)}px "Google Sans", "Inter", sans-serif`;
            ctx.fillText(t('gsearchPeopleAlsoAsk', lang), contentX + Math.floor(16 * mScale), currentCardY + Math.floor(18 * mScale));

            const questions = [t('gsearchFaqQ1', lang), t('gsearchFaqQ2', lang)];
            questions.forEach((q, qIdx) => {
                const qY = currentCardY + Math.floor(34 * mScale) + (qIdx * Math.floor(32 * mScale));
                ctx.strokeStyle = dividerCol;
                ctx.beginPath();
                ctx.moveTo(contentX + Math.floor(16 * mScale), qY);
                ctx.lineTo(contentX + contentW - Math.floor(16 * mScale), qY);
                ctx.stroke();

                ctx.fillStyle = textMain;
                ctx.font = `500 ${Math.floor(13 * mScale)}px "Inter", sans-serif`;
                ctx.fillText(q, contentX + Math.floor(16 * mScale), qY + Math.floor(16 * mScale));

                ctx.strokeStyle = textMuted;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(contentX + contentW - Math.floor(22 * mScale), qY + Math.floor(10 * mScale));
                ctx.lineTo(contentX + contentW - Math.floor(18 * mScale), qY + Math.floor(14 * mScale));
                ctx.lineTo(contentX + contentW - Math.floor(22 * mScale), qY + Math.floor(18 * mScale));
                ctx.stroke();
            });

            currentCardY += paaCardH + Math.floor(16 * mScale);
        }

        // ==========================================
        // ADDITIONAL RICH ORGANIC SEARCH RESULTS
        // ==========================================
        const extraResults = [
            {
                url: 'https://m0s.space › blog › viral-content-creation',
                title: t('gsearchExtraTitle1', lang),
                desc: t('gsearchExtraDesc1', lang),
                sitelinks: ['Match Cut', 'Typography', 'HD Export']
            },
            {
                url: 'https://youtube.com › watch?v=animation-maker',
                title: t('gsearchExtraTitle2', lang),
                desc: t('gsearchExtraDesc2', lang),
                isYoutube: true
            },
            {
                url: 'https://animationmaker.m0s.space › tools',
                title: t('gsearchExtraTitle3', lang),
                desc: t('gsearchExtraDesc3', lang)
            },
            {
                url: 'https://reddit.com › r › videoediting › viral-tools',
                title: t('gsearchExtraTitle4', lang),
                desc: t('gsearchExtraDesc4', lang)
            },
            {
                url: 'https://github.com › tools › web-video-renderer',
                title: t('gsearchExtraTitle5', lang),
                desc: t('gsearchExtraDesc5', lang)
            }
        ];

        extraResults.forEach((res, rIdx) => {
            if (currentCardY < height - Math.floor(45 * mScale)) {
                const favColor = res.isYoutube ? '#EA4335' : (rIdx === 0 ? '#34A853' : (rIdx === 2 ? '#4285F4' : (rIdx === 4 ? '#24292E' : '#FF4500')));
                ctx.fillStyle = favColor;
                ctx.beginPath();
                ctx.arc(contentX + Math.floor(10 * mScale), currentCardY + Math.floor(8 * mScale), Math.floor(6 * mScale), 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = textMuted;
                ctx.font = `500 ${Math.floor(11.5 * mScale)}px monospace`;
                ctx.textBaseline = 'middle';
                ctx.fillText(res.url, contentX + Math.floor(22 * mScale), currentCardY + Math.floor(8 * mScale));

                const titleH = drawWrappedText(
                    ctx, res.title, contentX, currentCardY + Math.floor(20 * mScale),
                    contentW, Math.floor(20 * mScale), 2,
                    `600 ${Math.floor(16 * mScale)}px "Google Sans", "Inter", sans-serif`, linkBlue
                );

                const snippetH = drawWrappedText(
                    ctx, res.desc, contentX, currentCardY + Math.floor(20 * mScale) + titleH + Math.floor(3 * mScale),
                    contentW, Math.floor(16 * mScale), 2,
                    `400 ${Math.floor(12.5 * mScale)}px "Inter", sans-serif`, textMuted
                );

                let extraH = 0;
                if (!isVertical && res.sitelinks && currentCardY + Math.floor(20 * mScale) + titleH + snippetH + Math.floor(28 * mScale) < height - Math.floor(30 * mScale)) {
                    let stX = contentX;
                    const stY = currentCardY + Math.floor(20 * mScale) + titleH + snippetH + Math.floor(8 * mScale);
                    res.sitelinks.forEach((st) => {
                        ctx.font = `500 ${Math.floor(11 * mScale)}px "Google Sans", "Inter", sans-serif`;
                        const stW = ctx.measureText(st).width + Math.floor(16 * mScale);
                        ctx.fillStyle = isDark ? '#3C4043' : '#F1F3F4';
                        roundRect(ctx, stX, stY, stW, Math.floor(22 * mScale), Math.floor(11 * mScale));
                        ctx.fill();
                        ctx.fillStyle = linkBlue;
                        ctx.textBaseline = 'middle';
                        ctx.fillText(st, stX + Math.floor(8 * mScale), stY + Math.floor(11 * mScale));
                        stX += stW + Math.floor(8 * mScale);
                    });
                    extraH = Math.floor(26 * mScale);
                }

                currentCardY += Math.floor(20 * mScale) + titleH + snippetH + extraH + Math.floor(14 * mScale);
            }
        });

        // ==========================================
        // 16:9 DESKTOP "RELATED SEARCHES" (İLGİLİ ARAMALAR) GRID
        // ==========================================
        if (!isVertical && currentCardY < height - Math.floor(90 * mScale)) {
            ctx.fillStyle = textMain;
            ctx.font = `700 ${Math.floor(14 * mScale)}px "Google Sans", "Inter", sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillText(`🔍 ${t('gsearchRelatedHeading', lang)}`, contentX, currentCardY);

            const relatedPills = [
                t('gsearchRelatedPill1', lang),
                t('gsearchRelatedPill2', lang),
                t('gsearchRelatedPill3', lang),
                t('gsearchRelatedPill4', lang)
            ];

            const gridY = currentCardY + Math.floor(24 * mScale);
            const colW = (contentW - Math.floor(12 * mScale)) / 2;
            const rowH = Math.floor(32 * mScale);

            relatedPills.forEach((rp, rpIdx) => {
                const rCol = rpIdx % 2;
                const rRow = Math.floor(rpIdx / 2);
                const pillX = contentX + (rCol * (colW + Math.floor(12 * mScale)));
                const pillY = gridY + (rRow * (rowH + Math.floor(8 * mScale)));

                if (pillY + rowH < height - Math.floor(15 * mScale)) {
                    ctx.fillStyle = cardBg;
                    roundRect(ctx, pillX, pillY, colW, rowH, Math.floor(16 * mScale));
                    ctx.fill();
                    ctx.strokeStyle = dividerCol;
                    ctx.stroke();

                    ctx.fillStyle = linkBlue;
                    ctx.font = `500 ${Math.floor(12 * mScale)}px "Google Sans", "Inter", sans-serif`;
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`🔎  ${rp}`, pillX + Math.floor(12 * mScale), pillY + (rowH / 2));
                }
            });
        }

        // ==========================================
        // 16:9 DESKTOP KNOWLEDGE PANEL (RIGHT SIDEBAR)
        // ==========================================
        if (!isVertical && width >= 960) {
            const kpX = contentX + contentW + Math.floor(36 * mScale);
            const kpW = Math.min(Math.floor(340 * mScale), width - kpX - Math.floor(30 * mScale));
            const kpY = tabY + Math.floor(26 * mScale);
            const kpH = Math.min(Math.floor(460 * mScale), height - kpY - Math.floor(30 * mScale));

            if (kpW > 200 && kpH > 240) {
                ctx.fillStyle = cardBg;
                roundRect(ctx, kpX, kpY, kpW, kpH, Math.floor(16 * mScale));
                ctx.fill();
                ctx.strokeStyle = dividerCol;
                ctx.lineWidth = 1;
                ctx.stroke();

                let kpInnerY = kpY;

                if (source) {
                    const kpMediaH = Math.floor(135 * mScale);
                    ctx.save();
                    roundRect(ctx, kpX + 1, kpY + 1, kpW - 2, kpMediaH, Math.floor(15 * mScale));
                    ctx.clip();
                    drawImageCover(ctx, source, kpX + 1, kpY + 1, kpW - 2, kpMediaH, 1.05);
                    ctx.restore();
                    kpInnerY += kpMediaH + Math.floor(14 * mScale);
                } else {
                    kpInnerY += Math.floor(16 * mScale);
                }

                const titleText = headline.length > 26 ? headline.substring(0, 24) + '...' : headline;
                ctx.fillStyle = textMain;
                ctx.font = `700 ${Math.floor(18 * mScale)}px "Google Sans", "Inter", sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(titleText, kpX + Math.floor(16 * mScale), kpInnerY);

                const titleW = ctx.measureText(titleText).width;
                const badgeX = kpX + Math.floor(22 * mScale) + titleW;
                if (badgeX < kpX + kpW - Math.floor(18 * mScale)) {
                    ctx.fillStyle = '#1A73E8';
                    ctx.beginPath();
                    ctx.arc(badgeX, kpInnerY + Math.floor(10 * mScale), Math.floor(7 * mScale), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = `700 ${Math.floor(9 * mScale)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('✓', badgeX, kpInnerY + Math.floor(10 * mScale));
                    ctx.textAlign = 'left';
                }

                ctx.fillStyle = textMuted;
                ctx.font = `500 ${Math.floor(12 * mScale)}px "Inter", sans-serif`;
                ctx.fillText(t('gsearchKpType', lang), kpX + Math.floor(16 * mScale), kpInnerY + Math.floor(24 * mScale));

                ctx.strokeStyle = dividerCol;
                ctx.beginPath();
                ctx.moveTo(kpX + Math.floor(16 * mScale), kpInnerY + Math.floor(44 * mScale));
                ctx.lineTo(kpX + kpW - Math.floor(16 * mScale), kpInnerY + Math.floor(44 * mScale));
                ctx.stroke();

                const facts = [
                    { label: t('gsearchKpDev', lang), val: 'AnimationMaker' },
                    { label: t('gsearchKpPlatform', lang), val: 'Web (WASM + Canvas)' },
                    { label: t('gsearchKpLicense', lang), val: t('gsearchKpFree', lang) },
                    { label: t('gsearchKpRating', lang), val: '⭐ 4.9/5.0 (2,840)' }
                ];

                facts.forEach((f, fIdx) => {
                    const rowY = kpInnerY + Math.floor(54 * mScale) + (fIdx * Math.floor(24 * mScale));
                    if (rowY < kpY + kpH - Math.floor(40 * mScale)) {
                        ctx.font = `600 ${Math.floor(11 * mScale)}px "Inter", sans-serif`;
                        ctx.fillStyle = textMuted;
                        ctx.fillText(f.label, kpX + Math.floor(16 * mScale), rowY);
                        ctx.fillStyle = textMain;
                        ctx.font = `500 ${Math.floor(11 * mScale)}px "Inter", sans-serif`;
                        ctx.fillText(f.val, kpX + Math.floor(105 * mScale), rowY);
                    }
                });

                const btnY = kpY + kpH - Math.floor(42 * mScale);
                if (btnY > kpInnerY + Math.floor(140 * mScale)) {
                    ctx.fillStyle = isDark ? '#3C4043' : '#E8F0FE';
                    roundRect(ctx, kpX + Math.floor(16 * mScale), btnY, kpW - Math.floor(32 * mScale), Math.floor(30 * mScale), Math.floor(8 * mScale));
                    ctx.fill();
                    ctx.fillStyle = linkBlue;
                    ctx.font = `600 ${Math.floor(12 * mScale)}px "Google Sans", "Inter", sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(t('gsearchKpVisit', lang), kpX + (kpW / 2), btnY + Math.floor(15 * mScale));
                    ctx.textAlign = 'left';
                }
            }
        }
    }

    drawVignette(ctx, width, height, 0.25);
    ctx.restore();
}
