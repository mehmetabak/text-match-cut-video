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

import Prism from 'prismjs';

const PRISM_THEME = {
    keyword: '#F38BA8',      // Coral Pink (const, let, function, return, import, etc.)
    string: '#A6E3A1',       // Soft Emerald Green ("...", '...', `...`)
    comment: '#6C7086',      // Muted Slate Gray (// ..., /* ... */, # ...)
    function: '#89B4FA',     // Sky Blue (function names, method calls)
    number: '#FAB387',       // Warm Peach / Orange (123, 0.5, 0xFF)
    boolean: '#FAB387',      // Warm Peach (true, false, null, undefined)
    operator: '#89DCEB',     // Cyan (+, -, =, =>, &&, ||)
    punctuation: '#9399B2',  // Lavender Gray ({, }, (, ), [, ], ;, ,)
    'class-name': '#F9E2AF', // Warm Yellow
    property: '#CBA6F7',     // Mauve / Violet
    builtin: '#F9E2AF',      // Gold
    regex: '#F5C2E7',        // Pink
    variable: '#CDD6F4',     // Light Slate
    default: '#CDD6F4'       // Light Slate White
};

function tokenizeCodeWithPrism(line) {
    if (!line) return [];
    try {
        const grammar = Prism.languages.javascript;
        const rawTokens = Prism.tokenize(line, grammar);
        const tokens = [];

        function walk(tok, parentType) {
            if (typeof tok === 'string') {
                tokens.push({
                    text: tok,
                    color: PRISM_THEME[parentType] || PRISM_THEME.default
                });
            } else if (Array.isArray(tok.content)) {
                tok.content.forEach(sub => walk(sub, tok.type || parentType));
            } else {
                tokens.push({
                    text: typeof tok.content === 'string' ? tok.content : String(tok.content),
                    color: PRISM_THEME[tok.type] || PRISM_THEME[parentType] || PRISM_THEME.default
                });
            }
        }

        rawTokens.forEach(t => walk(t, null));
        return tokens;
    } catch (e) {
        return [{ text: line, color: '#CDD6F4' }];
    }
}

// Helper to convert font size option to multiplier scale
function getTypewriterFontScale(sizeOption) {
    if (typeof sizeOption === 'number') return sizeOption;
    if (sizeOption === 'small') return 0.82;
    if (sizeOption === 'large') return 1.25;
    if (sizeOption === 'xlarge') return 1.5;
    return 1.0; // medium
}

// 4. KINETIC TYPEWRITER FRAME RENDERER
export function drawTypewriterFrame(ctx, width, height, progress = 0, options = {}) {
    const text = options.text || "Every story begins with a single word.\nAnimationMaker creates the magic.";
    const fontColor = options.fontColor || '#FFFFFF';
    const fontFamily = options.fontFamily || "'JetBrains Mono', 'Courier New', monospace";
    const cursorStyle = options.cursorStyle || 'block'; // 'block' | 'line' | 'underscore'
    const typewriterMode = options.typewriterMode || 'classic'; // 'classic' | 'terminal' | 'code' | 'vintage'
    const paperSize = options.paperSize || 'normal'; // 'normal' | 'large'
    const fontSizeScale = getTypewriterFontScale(options.typewriterFontSize || options.fontSize);
    const codeFileName = (options.codeFileName || 'main.js').trim() || 'main.js';
    const isDark = options.darkTheme !== false;
    const isVertical = height > width;
    const isLarge = paperSize === 'large';

    ctx.save();

    if (typewriterMode === 'code') {
        // ========================================================
        // 1. MODERN CODE EDITOR (VS CODE STYLE WITH PRISM SYNTAX HIGHLIGHT)
        // ========================================================
        ctx.fillStyle = '#0F1117';
        ctx.fillRect(0, 0, width, height);

        // Subtle Ambient Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
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

        const winWidth = width * (isLarge ? (isVertical ? 0.98 : 0.94) : (isVertical ? 0.94 : 0.86));
        const winHeight = height * (isLarge ? (isVertical ? 0.95 : 0.92) : (isVertical ? 0.88 : 0.82));
        const winX = (width - winWidth) / 2;
        const winY = (height - winHeight) / 2;

        // Window Chassis Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 18;

        // Editor Canvas Chassis (#181825)
        ctx.fillStyle = '#181825';
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, winHeight);
        }
        ctx.shadowColor = 'transparent';

        // Editor Accent Border
        ctx.strokeStyle = 'rgba(137, 180, 250, 0.2)';
        ctx.lineWidth = 1.5;
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.stroke();
        } else {
            ctx.strokeRect(winX, winY, winWidth, winHeight);
        }

        // Window Title & Tab Bar
        const titleBarHeight = Math.max(34, Math.floor(winHeight / 11));
        ctx.fillStyle = '#11111B';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(winX, winY, winWidth, titleBarHeight, [10, 10, 0, 0]);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, titleBarHeight);
        }

        // macOS Traffic Lights (🔴 🟡 🟢)
        const dotRadius = Math.max(5, Math.min(8, Math.floor(titleBarHeight / 5.2)));
        const dotSpacing = Math.max(18, Math.floor(dotRadius * 3.0));
        const dotStartX = winX + Math.max(20, Math.floor(winWidth * 0.035));
        const dotY = winY + titleBarHeight / 2;
        
        ctx.fillStyle = '#FF5F56';
        ctx.beginPath();
        ctx.arc(dotStartX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFBD2E';
        ctx.beginPath();
        ctx.arc(dotStartX + dotSpacing, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#27C93F';
        ctx.beginPath();
        ctx.arc(dotStartX + dotSpacing * 2, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Active File Tab (📄 codeFileName)
        const tabFont = `600 ${Math.max(11, Math.floor(titleBarHeight / 2.6))}px 'JetBrains Mono', monospace`;
        ctx.font = tabFont;
        const tabTextWidth = ctx.measureText(codeFileName).width;
        const tabWidth = Math.min(Math.floor(winWidth * 0.45), Math.max(90, tabTextWidth + 36));
        const tabX = dotStartX + dotSpacing * 2 + dotRadius + 20;
        ctx.fillStyle = '#181825';
        ctx.fillRect(tabX, winY, tabWidth, titleBarHeight);
        
        // Active Tab Top Blue Indicator Line
        ctx.fillStyle = '#89B4FA';
        ctx.fillRect(tabX, winY, tabWidth, 2);

        // Tab Text
        ctx.fillStyle = '#CDD6F4';
        ctx.font = tabFont;
        ctx.textAlign = 'left';
        ctx.fillText(codeFileName, tabX + 14, dotY + 4);

        // Title Bar Bottom Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX, winY + titleBarHeight);
        ctx.lineTo(winX + winWidth, winY + titleBarHeight);
        ctx.stroke();

        // Calculate Visible Text
        const totalChars = text.length;
        const currentChars = Math.min(totalChars, Math.floor(progress * (totalChars + 4)));
        const visibleText = text.substring(0, currentChars);

        const baseFontSize = Math.floor(isVertical ? width / 20 : width / 30);
        const fontSize = Math.max(11, Math.floor(baseFontSize * fontSizeScale));
        const lineHeight = Math.floor(fontSize * 1.6);
        const gutterWidth = Math.max(42, fontSize * 2.2);
        const textStartX = winX + gutterWidth + 16;
        const textStartY = winY + titleBarHeight + 20;

        ctx.font = `600 ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        const maxContentWidth = winWidth - gutterWidth - 36;
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

        // Auto-Scroll Calculation (Smooth Code Editor Viewport Scroll)
        const availableContentHeight = winHeight - titleBarHeight - 32;
        const maxVisibleLines = Math.max(4, Math.floor(availableContentHeight / lineHeight));
        const overflowLines = Math.max(0, renderedLines.length - maxVisibleLines);
        const scrollY = overflowLines * lineHeight;

        // Clip Content Area
        ctx.save();
        ctx.beginPath();
        ctx.rect(winX, winY + titleBarHeight, winWidth, winHeight - titleBarHeight);
        ctx.clip();

        // Gutter Vertical Separator Rule
        ctx.strokeStyle = '#313244';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX + gutterWidth + 4, winY + titleBarHeight);
        ctx.lineTo(winX + gutterWidth + 4, winY + winHeight);
        ctx.stroke();

        renderedLines.forEach((line, idx) => {
            const lineY = textStartY + (idx * lineHeight) - scrollY;
            if (lineY + lineHeight >= winY + titleBarHeight - 10 && lineY <= winY + winHeight + 10) {
                // Line Number in Gutter (01, 02, 03)
                ctx.fillStyle = '#6C7086';
                ctx.font = `600 ${Math.floor(fontSize * 0.85)}px ${fontFamily}`;
                const lineNumStr = String(idx + 1).padStart(2, '0');
                ctx.fillText(lineNumStr, winX + 12, lineY + 2);

                // Render Prism-Highlighted Tokens for this line
                ctx.font = `600 ${fontSize}px ${fontFamily}`;
                const tokens = tokenizeCodeWithPrism(line);
                let currentX = textStartX;

                tokens.forEach((tok) => {
                    ctx.fillStyle = tok.color;
                    ctx.fillText(tok.text, currentX, lineY);
                    currentX += ctx.measureText(tok.text).width;
                });

                // Glowing Cyan/Purple Cursor on last line
                if (idx === renderedLines.length - 1) {
                    const isBlink = Math.floor(progress * 24) % 2 === 0 || progress >= 1;
                    if (isBlink) {
                        const cursorX = currentX + 3;
                        ctx.shadowColor = '#89B4FA';
                        ctx.shadowBlur = 10;
                        ctx.fillStyle = '#89B4FA';

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

        ctx.restore();
        drawVignette(ctx, width, height, 0.35);

    } else if (typewriterMode === 'terminal') {
        // ========================================================
        // 2. MODERN HACKER / MATRIX GREEN TERMINAL
        // ========================================================
        ctx.fillStyle = '#06080A';
        ctx.fillRect(0, 0, width, height);

        // Subtle Terminal Scanlines
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.03)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const winWidth = width * (isLarge ? (isVertical ? 0.98 : 0.94) : (isVertical ? 0.94 : 0.86));
        const winHeight = height * (isLarge ? (isVertical ? 0.95 : 0.92) : (isVertical ? 0.88 : 0.82));
        const winX = (width - winWidth) / 2;
        const winY = (height - winHeight) / 2;

        // Terminal Window Chassis (#0B0F12)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 18;
        ctx.fillStyle = '#0B0F12';
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, winHeight);
        }
        ctx.shadowColor = 'transparent';

        // Glowing Emerald Accent Border
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.lineWidth = 1.5;
        if (ctx.roundRect) {
            ctx.roundRect(winX, winY, winWidth, winHeight, 10);
            ctx.stroke();
        } else {
            ctx.strokeRect(winX, winY, winWidth, winHeight);
        }

        // Window Title Bar
        const titleBarHeight = Math.max(34, Math.floor(winHeight / 11));
        ctx.fillStyle = '#0F1519';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(winX, winY, winWidth, titleBarHeight, [10, 10, 0, 0]);
            ctx.fill();
        } else {
            ctx.fillRect(winX, winY, winWidth, titleBarHeight);
        }

        // macOS Traffic Lights (🔴 🟡 🟢)
        const dotRadius = Math.max(5, Math.min(8, Math.floor(titleBarHeight / 5.2)));
        const dotSpacing = Math.max(18, Math.floor(dotRadius * 3.0));
        const dotStartX = winX + Math.max(20, Math.floor(winWidth * 0.035));
        const dotY = winY + titleBarHeight / 2;
        
        ctx.fillStyle = '#FF5F56';
        ctx.beginPath();
        ctx.arc(dotStartX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFBD2E';
        ctx.beginPath();
        ctx.arc(dotStartX + dotSpacing, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#27C93F';
        ctx.beginPath();
        ctx.arc(dotStartX + dotSpacing * 2, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Terminal Title Badge
        ctx.fillStyle = '#4ADE80';
        ctx.font = `600 ${Math.max(11, Math.floor(titleBarHeight / 2.6))}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText("zsh — matrix@terminal", winX + winWidth / 2, dotY + 4);
        ctx.textAlign = 'left';

        // Title Bar Divider
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX, winY + titleBarHeight);
        ctx.lineTo(winX + winWidth, winY + titleBarHeight);
        ctx.stroke();

        // Calculate Visible Text
        const totalChars = text.length;
        const currentChars = Math.min(totalChars, Math.floor(progress * (totalChars + 4)));
        const visibleText = text.substring(0, currentChars);

        const baseFontSize = Math.floor(isVertical ? width / 19 : width / 28);
        const fontSize = Math.max(11, Math.floor(baseFontSize * fontSizeScale));
        const lineHeight = Math.floor(fontSize * 1.55);
        const gutterWidth = Math.max(42, fontSize * 2.0);
        const textStartX = winX + gutterWidth + 16;
        const textStartY = winY + titleBarHeight + 22;

        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        const maxContentWidth = winWidth - gutterWidth - 36;
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

        // Auto-Scroll Calculation (Smooth Terminal Buffer Scroll)
        const availableContentHeight = winHeight - titleBarHeight - 32;
        const maxVisibleLines = Math.max(4, Math.floor(availableContentHeight / lineHeight));
        const overflowLines = Math.max(0, renderedLines.length - maxVisibleLines);
        const scrollY = overflowLines * lineHeight;

        // Clip Content Area
        ctx.save();
        ctx.beginPath();
        ctx.rect(winX, winY + titleBarHeight, winWidth, winHeight - titleBarHeight);
        ctx.clip();

        // Gutter Vertical Separator Rule
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX + gutterWidth + 4, winY + titleBarHeight);
        ctx.lineTo(winX + gutterWidth + 4, winY + winHeight);
        ctx.stroke();

        renderedLines.forEach((line, idx) => {
            const lineY = textStartY + (idx * lineHeight) - scrollY;
            if (lineY + lineHeight >= winY + titleBarHeight - 10 && lineY <= winY + winHeight + 10) {
                // Line Number Gutter (01, 02, 03 in muted emerald green)
                ctx.fillStyle = '#15803D';
                ctx.font = `700 ${Math.floor(fontSize * 0.85)}px ${fontFamily}`;
                const lineNumStr = String(idx + 1).padStart(2, '0');
                ctx.fillText(lineNumStr, winX + 12, lineY + 2);

                // Line text in Vibrant Hacker Matrix Green
                ctx.font = `700 ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = '#4ADE80';
                ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
                ctx.shadowBlur = 6;
                ctx.fillText(line, textStartX, lineY);
                ctx.shadowColor = 'transparent';

                // Cursor on last line with glowing green aura
                if (idx === renderedLines.length - 1) {
                    const isBlink = Math.floor(progress * 24) % 2 === 0 || progress >= 1;
                    if (isBlink) {
                        const lineWidth = ctx.measureText(line).width;
                        const cursorX = textStartX + lineWidth + 3;

                        ctx.shadowColor = '#22C55E';
                        ctx.shadowBlur = 12;
                        ctx.fillStyle = '#22C55E';

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

        ctx.restore();
        drawVignette(ctx, width, height, 0.4);

    } else if (typewriterMode === 'vintage') {
        // ==========================================
        // 3. VINTAGE PAPER & TYPEWRITER MANUSCRIPT
        // ==========================================
        const bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.15, width / 2, height / 2, width * 0.85);
        bgGrad.addColorStop(0, '#1E1B18');
        bgGrad.addColorStop(0.6, '#12100E');
        bgGrad.addColorStop(1, '#080706');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        const paperWidth = width * (isLarge ? (isVertical ? 0.96 : 0.92) : (isVertical ? 0.90 : 0.80));
        const paperHeight = height * (isLarge ? (isVertical ? 0.94 : 0.92) : (isVertical ? 0.86 : 0.80));
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

        const baseFontSize = Math.floor(isVertical ? width / 18 : width / 26);
        const fontSize = Math.max(11, Math.floor(baseFontSize * fontSizeScale));
        const lineHeight = Math.floor(fontSize * 1.6);
        const textStartX = paperX + (isLarge ? 32 : 28);
        const textStartY = paperY + 60;

        ctx.font = `700 ${fontSize}px 'Courier New', Courier, monospace`;
        ctx.textBaseline = 'top';

        const maxTextWidth = paperWidth - (isLarge ? 64 : 56);
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

        // Daktilo Platen Feed / Carriage Scroll
        const availablePaperHeight = paperHeight - 80;
        const maxVisibleLines = Math.max(4, Math.floor(availablePaperHeight / lineHeight));
        const overflowLines = Math.max(0, renderedLines.length - maxVisibleLines);
        const scrollY = overflowLines * lineHeight;

        // Clip to paper text zone
        ctx.save();
        ctx.beginPath();
        ctx.rect(paperX + 2, paperY + 44, paperWidth - 4, paperHeight - 48);
        ctx.clip();

        // Deep carbon typewriter ribbon ink
        ctx.fillStyle = '#1A1816';

        renderedLines.forEach((line, idx) => {
            const lineY = textStartY + (idx * lineHeight) - scrollY;
            if (lineY + lineHeight >= paperY + 40 && lineY <= paperY + paperHeight + 10) {
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

        ctx.restore();
        drawVignette(ctx, width, height, 0.4);

    } else {
        // ========================================================
        // 4. CLASSIC MINIMAL FULL-FRAME (DEFAULT DAKTILO)
        // ========================================================
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

        const baseFontSize = Math.floor(isVertical ? width / 18 : width / 28);
        const fontSize = Math.max(12, Math.floor(baseFontSize * fontSizeScale));
        const lineHeight = Math.floor(fontSize * 1.55);
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';

        const maxContentWidth = width * (isLarge ? 0.92 : 0.82);
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

        // Daktilo Line-Feed / Carriage Scroll
        const availableHeight = height * 0.72;
        const maxVisibleLines = Math.max(4, Math.floor(availableHeight / lineHeight));
        const overflowLines = Math.max(0, renderedLines.length - maxVisibleLines);
        const scrollY = overflowLines * lineHeight;
        const baseStartY = Math.max(50, (height - (Math.min(renderedLines.length, maxVisibleLines) * lineHeight)) / 2);

        // Clip viewport
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 30, width, height - 60);
        ctx.clip();

        ctx.fillStyle = fontColor;
        renderedLines.forEach((line, idx) => {
            const lineY = baseStartY + (idx * lineHeight) - scrollY;
            if (lineY + lineHeight >= 20 && lineY <= height - 20) {
                ctx.font = `700 ${fontSize}px ${fontFamily}`;
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
            }
        });

        ctx.restore();
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

// =========================================================================
// 9. DOCUMENT & ARTICLE SPOTLIGHT FRAME RENDERER (VOX & JOHNNY HARRIS STYLE)
// =========================================================================
export function drawSpotlightFrame(ctx, width, height, progress = 0, options = {}) {
    const sourceName = (options.sourceName || "NATURE • Research Article").toUpperCase();
    const articleDate = (options.articleDate || "OCTOBER 2024 • ISSUE 8192").toUpperCase();
    const headline = options.headline || "Quantum Coherence Discovered in Room Temperature Macromolecules";
    const snippet = options.snippet || "Recent laboratory experiments demonstrate macroscopic quantum coherence sustained under ambient room temperatures. This fundamental discovery transforms our understanding of biological energy transfer and next-generation quantum computing.";
    const highlightKeywords = options.highlightKeywords || "macroscopic quantum coherence sustained under ambient room temperatures";
    const highlightColor = options.highlightColor || "yellow"; // 'yellow' | 'cyan' | 'green' | 'pink'
    const documentTheme = options.documentTheme || "archival"; // 'archival' | 'modern' | 'dark'
    const paperFormat = options.paperFormat || "standard"; // 'standard' | 'a4' | 'expanded'
    const fontSizeOpt = options.fontSize || "medium"; // 'small' | 'medium' | 'large' | 'xlarge'
    const isVertical = height > width;

    ctx.save();

    // 1. Color Palette Configuration
    let bgGrad, cardBg, cardBorder, textHeadlineCol, textBodyCol, textMetaCol, badgeBg, badgeText, paperShadowCol;
    if (documentTheme === 'modern') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(1, '#020617');
        cardBg = '#FFFFFF';
        cardBorder = '#E2E8F0';
        textHeadlineCol = '#0F172A';
        textBodyCol = '#334155';
        textMetaCol = '#64748B';
        badgeBg = '#EFF6FF';
        badgeText = '#1D4ED8';
        paperShadowCol = 'rgba(0, 0, 0, 0.45)';
    } else if (documentTheme === 'dark') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0D1117');
        bgGrad.addColorStop(1, '#010409');
        cardBg = '#161B22';
        cardBorder = 'rgba(56, 189, 248, 0.28)';
        textHeadlineCol = '#F0F6FC';
        textBodyCol = '#C9D1D9';
        textMetaCol = '#8B949E';
        badgeBg = 'rgba(56, 189, 248, 0.15)';
        badgeText = '#38BDF8';
        paperShadowCol = 'rgba(0, 0, 0, 0.75)';
    } else {
        // Archival Paper (Default Vintage Parchment)
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#1C1917');
        bgGrad.addColorStop(0.7, '#12100E');
        bgGrad.addColorStop(1, '#080706');
        cardBg = '#F9F5EC';
        cardBorder = '#E5DAC6';
        textHeadlineCol = '#111827';
        textBodyCol = '#292524';
        textMetaCol = '#78716C';
        badgeBg = '#FEF3C7';
        badgeText = '#92400E';
        paperShadowCol = 'rgba(0, 0, 0, 0.65)';
    }

    // Outer Background
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Ambient Particles/Grid
    ctx.strokeStyle = documentTheme === 'archival' ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    const gSize = 48;
    for (let x = 0; x < width; x += gSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // 2. Paper / Document Geometry Calculation
    let cardW, cardH;
    if (paperFormat === 'a4') {
        // Authentic A4 Aspect Ratio 1:1.414 (Portrait Sheet)
        if (isVertical) {
            cardW = Math.round(width * 0.88);
            cardH = Math.min(Math.round(height * 0.92), Math.round(cardW * 1.414));
        } else {
            cardH = Math.round(height * 0.88);
            cardW = Math.round(cardH / 1.414);
        }
    } else if (paperFormat === 'expanded') {
        // Full Page Expanded Layout
        cardW = Math.round(width * (isVertical ? 0.94 : 0.88));
        cardH = Math.round(height * (isVertical ? 0.92 : 0.88));
    } else {
        // Standard Balanced Card
        cardW = Math.round(width * (isVertical ? 0.92 : 0.80));
        cardH = Math.round(height * (isVertical ? 0.85 : 0.78));
    }

    const cardX = Math.round((width - cardW) / 2);
    const cardY = Math.round((height - cardH) / 2);

    // 3. Super-Sampled (2x Retina) Offscreen Document Render (Zero Font Hinting Jitter)
    const dpr = 2;
    let offCanvas = null;
    let offCtx = null;
    if (typeof document !== 'undefined') {
        offCanvas = document.createElement('canvas');
        offCanvas.width = Math.round(cardW * dpr);
        offCanvas.height = Math.round(cardH * dpr);
        offCtx = offCanvas.getContext('2d');
        if (offCtx) {
            offCtx.scale(dpr, dpr);
        }
    }

    // Target context for document drawing (Offscreen if available, else direct canvas)
    const dCtx = offCtx || ctx;
    const originX = offCtx ? 0 : cardX;
    const originY = offCtx ? 0 : cardY;

    // Paper Card Background
    dCtx.fillStyle = cardBg;
    const cardRadius = paperFormat === 'a4' ? 6 : 14;
    if (dCtx.roundRect) {
        dCtx.beginPath();
        dCtx.roundRect(originX, originY, cardW, cardH, cardRadius);
        dCtx.fill();
    } else {
        dCtx.fillRect(originX, originY, cardW, cardH);
    }

    // Paper Border
    dCtx.strokeStyle = cardBorder;
    dCtx.lineWidth = 1.5;
    if (dCtx.roundRect) {
        dCtx.beginPath();
        dCtx.roundRect(originX, originY, cardW, cardH, cardRadius);
        dCtx.stroke();
    } else {
        dCtx.strokeRect(originX, originY, cardW, cardH);
    }

    // A4 Corner Watermark & Header Margins if in A4 mode
    if (paperFormat === 'a4') {
        dCtx.fillStyle = textMetaCol;
        dCtx.font = `600 ${Math.max(9, Math.round(cardW * 0.02))}px 'Inter', sans-serif`;
        dCtx.textBaseline = 'top';
        dCtx.fillText("ISSN 0028-0836", originX + Math.round(cardW * 0.08), originY + Math.round(cardH * 0.035));
        dCtx.textAlign = 'right';
        dCtx.fillText("Page 1 of 1", originX + cardW - Math.round(cardW * 0.08), originY + cardH - Math.round(cardH * 0.045));
        dCtx.textAlign = 'left';
    }

    const mScale = Math.min(width, height) / 800;
    const padX = Math.round(cardW * 0.08);
    const padY = Math.round(cardH * (paperFormat === 'a4' ? 0.075 : 0.085));

    let curY = originY + padY;

    // Header Badge & Date
    const badgePadX = Math.round(10 * mScale);
    const badgePadY = Math.round(5 * mScale);
    const badgeFontSize = Math.max(10, Math.round(11 * mScale));
    dCtx.font = `700 ${badgeFontSize}px 'Inter', sans-serif`;
    const sourceW = dCtx.measureText(sourceName).width;

    dCtx.fillStyle = badgeBg;
    if (dCtx.roundRect) {
        dCtx.beginPath();
        dCtx.roundRect(originX + padX, curY, Math.round(sourceW + (badgePadX * 2)), Math.round(badgeFontSize + (badgePadY * 2)), 5);
        dCtx.fill();
    } else {
        dCtx.fillRect(originX + padX, curY, Math.round(sourceW + (badgePadX * 2)), Math.round(badgeFontSize + (badgePadY * 2)));
    }

    dCtx.fillStyle = badgeText;
    dCtx.textBaseline = 'middle';
    dCtx.fillText(sourceName, originX + padX + badgePadX, Math.round(curY + (badgeFontSize / 2) + badgePadY));

    // Date / Issue Tag on Right
    dCtx.fillStyle = textMetaCol;
    dCtx.font = `600 ${Math.max(10, Math.round(11 * mScale))}px 'Inter', sans-serif`;
    dCtx.textAlign = 'right';
    dCtx.fillText(articleDate, originX + cardW - padX, Math.round(curY + (badgeFontSize / 2) + badgePadY));
    dCtx.textAlign = 'left';

    curY += badgeFontSize + (badgePadY * 2) + Math.round(16 * mScale);

    // Subtle Divider Rule
    dCtx.strokeStyle = documentTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    dCtx.lineWidth = 1;
    dCtx.beginPath();
    dCtx.moveTo(originX + padX, curY);
    dCtx.lineTo(originX + cardW - padX, curY);
    dCtx.stroke();

    curY += Math.round(18 * mScale);

    // Headline Typography
    let fontMultiplier = 1.0;
    if (typeof fontSizeOpt === 'number') {
        fontMultiplier = Math.max(0.6, Math.min(2.0, fontSizeOpt / 20));
    } else if (fontSizeOpt === 'small') {
        fontMultiplier = 0.82;
    } else if (fontSizeOpt === 'large') {
        fontMultiplier = 1.25;
    } else if (fontSizeOpt === 'xlarge') {
        fontMultiplier = 1.5;
    }
    const baseHeadlineSize = isVertical ? width / 22 : width / 36;
    const headlineFontSize = Math.max(14, Math.round(baseHeadlineSize * fontMultiplier));
    
    dCtx.font = `800 ${headlineFontSize}px ${documentTheme === 'archival' ? "'Georgia', 'Merriweather', serif" : "'Inter', sans-serif"}`;
    dCtx.fillStyle = textHeadlineCol;
    dCtx.textBaseline = 'top';

    const maxTextW = cardW - (padX * 2);
    const headlineWords = headline.split(' ');
    let hLine = '';
    const hLines = [];

    headlineWords.forEach((word) => {
        const testLine = hLine ? `${hLine} ${word}` : word;
        if (dCtx.measureText(testLine).width > maxTextW) {
            hLines.push(hLine);
            hLine = word;
        } else {
            hLine = testLine;
        }
    });
    hLines.push(hLine);

    const hLineH = Math.round(headlineFontSize * 1.32);
    hLines.forEach((line) => {
        dCtx.fillText(line, originX + padX, curY);
        curY += hLineH;
    });

    curY += Math.round(16 * mScale);

    // Paragraph Body & Word Coordinates in Static Offscreen Space
    const baseBodySize = isVertical ? width / 26 : width / 44;
    const bodyFontSize = Math.max(12, Math.round(baseBodySize * fontMultiplier));
    const bodyLineH = Math.round(bodyFontSize * 1.6);
    dCtx.font = `500 ${bodyFontSize}px ${documentTheme === 'archival' ? "'Georgia', serif" : "'Inter', sans-serif"}`;

    const snippetWords = snippet.split(' ');
    const wordLayout = [];
    let curLineY = curY;
    let curLineX = originX + padX;
    let curLineIndex = 0;

    snippetWords.forEach((w) => {
        const wWidth = dCtx.measureText(w + ' ').width;
        if (curLineX + wWidth > originX + padX + maxTextW) {
            curLineIndex++;
            curLineX = originX + padX;
            curLineY += bodyLineH;
        }
        wordLayout.push({
            word: w,
            cleanWord: w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase(),
            x: Math.round(curLineX),
            y: Math.round(curLineY),
            width: Math.round(dCtx.measureText(w).width),
            height: Math.round(bodyFontSize * 1.18),
            lineIndex: curLineIndex
        });
        curLineX += wWidth;
    });

    // Multi-Word Matching & Highlight Box Grouping
    const cleanHighlight = (highlightKeywords || "").toLowerCase().trim();
    const hlTerms = cleanHighlight.split(/\s+/).filter(Boolean);
    const highlightedBoxes = [];

    if (hlTerms.length > 0) {
        for (let i = 0; i <= wordLayout.length - hlTerms.length; i++) {
            let matches = true;
            for (let j = 0; j < hlTerms.length; j++) {
                if (wordLayout[i + j].cleanWord !== hlTerms[j].replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                let currentBox = null;
                for (let k = 0; k < hlTerms.length; k++) {
                    const wl = wordLayout[i + k];
                    if (!currentBox || currentBox.lineIndex !== wl.lineIndex) {
                        if (currentBox) highlightedBoxes.push(currentBox);
                        currentBox = {
                            x: wl.x - 4,
                            y: wl.y - 2,
                            width: wl.width + 8,
                            height: wl.height + 4,
                            lineIndex: wl.lineIndex
                        };
                    } else {
                        currentBox.width = (wl.x + wl.width + 4) - currentBox.x;
                    }
                }
                if (currentBox) highlightedBoxes.push(currentBox);
                break;
            }
        }
    }

    // Smooth Highlighter Sweep Easing
    const rawHlProgress = Math.max(0, Math.min(1, (progress - 0.10) / 0.55));
    const hlProgress = rawHlProgress < 0.5 
        ? 2 * rawHlProgress * rawHlProgress 
        : 1 - Math.pow(-2 * rawHlProgress + 2, 2) / 2;

    // Highlighter Color Selection
    let hlFillStyle, hlGlowCol;
    if (highlightColor === 'cyan') {
        hlFillStyle = 'rgba(6, 182, 212, 0.45)';
        hlGlowCol = '#06B6D4';
    } else if (highlightColor === 'green') {
        hlFillStyle = 'rgba(34, 197, 94, 0.45)';
        hlGlowCol = '#22C55E';
    } else if (highlightColor === 'pink') {
        hlFillStyle = 'rgba(244, 63, 94, 0.45)';
        hlGlowCol = '#F43F5E';
    } else {
        hlFillStyle = 'rgba(250, 204, 21, 0.55)';
        hlGlowCol = '#FACC15';
    }

    // Draw Smooth Rounded Fluorescent Highlighter Sweep on Document Context
    if (highlightedBoxes.length > 0 && hlProgress > 0) {
        dCtx.save();
        dCtx.fillStyle = hlFillStyle;
        dCtx.shadowColor = hlGlowCol;
        dCtx.shadowBlur = 12;

        const totalBoxes = highlightedBoxes.length;
        highlightedBoxes.forEach((box, bIdx) => {
            const boxStart = bIdx / totalBoxes;
            const boxEnd = (bIdx + 1) / totalBoxes;
            const subProg = Math.max(0, Math.min(1, (hlProgress - boxStart) / (boxEnd - boxStart)));

            if (subProg > 0) {
                const animW = Math.max(4, Math.round(box.width * subProg));
                if (dCtx.roundRect) {
                    dCtx.beginPath();
                    dCtx.roundRect(box.x, box.y, animW, box.height, 4);
                    dCtx.fill();
                } else {
                    dCtx.fillRect(box.x, box.y, animW, box.height);
                }
            }
        });
        dCtx.restore();
    }

    // Draw Paragraph Text Crisp on Document Context
    dCtx.fillStyle = textBodyCol;
    dCtx.textBaseline = 'top';
    wordLayout.forEach((wl) => {
        dCtx.fillText(wl.word, wl.x, wl.y);
    });

    // 4. Smooth Hardware-Accelerated Camera Zoom & Pan on the Main Canvas
    if (offCanvas) {
        const smoothT = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        const zoomScale = 1.0 + (smoothT * 0.05);
        const panOffset = (smoothT * 8);

        ctx.save();
        ctx.translate(width / 2, height / 2 + panOffset);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-width / 2, -height / 2);

        // Realistic Sheet Drop Shadow
        ctx.shadowColor = paperShadowCol;
        ctx.shadowBlur = 36;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 14;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, cardX, cardY, cardW, cardH);
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.42);
    ctx.restore();
}

// =========================================================================
// 10. LATEX MATH & SCIENCE FORMULA ANIMATOR (3BLUE1BROWN & SCIENCE ESSAY)
// =========================================================================

// Parse raw LaTeX into semantic math tokens (eliminating temporary / * ^ # flashes)
function parseLatexTokens(rawLatex) {
    const mathSymbols = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε',
        '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ',
        '\\tau': 'τ', '\\phi': 'φ', '\\psi': 'ψ', '\\omega': 'ω', '\\Delta': 'Δ',
        '\\Psi': 'Ψ', '\\Omega': 'Ω', '\\hbar': 'ℏ', '\\int': '∫', '\\iint': '∬',
        '\\sum': '∑', '\\prod': '∏', '\\partial': '∂', '\\nabla': '∇', '\\times': '×',
        '\\cdot': '·', '\\pm': '±', '\\approx': '≈', '\\neq': '≠', '\\leq': '≤',
        '\\geq': '≥', '\\infty': '∞', '\\to': '→', '\\rightarrow': '→', '\\hat{H}': 'Ĥ',
        '\\mathbf{E}': 'E', '\\mathbf{B}': 'B', '\\mathbf{r}': 'r', '\\mathbf{v}': 'v',
        '\\mathcal{L}': 'ℒ'
    };

    let text = rawLatex || "";
    Object.keys(mathSymbols).forEach((sym) => {
        text = text.split(sym).join(mathSymbols[sym]);
    });

    const tokens = [];
    let i = 0;

    while (i < text.length) {
        // 1. Fraction: \frac{A}{B}
        if (text.startsWith('\\frac', i)) {
            const numStart = text.indexOf('{', i);
            const numEnd = text.indexOf('}', numStart);
            const denStart = text.indexOf('{', numEnd);
            const denEnd = text.indexOf('}', denStart);

            if (numStart !== -1 && numEnd !== -1 && denStart !== -1 && denEnd !== -1) {
                const num = text.substring(numStart + 1, numEnd).trim();
                const den = text.substring(denStart + 1, denEnd).trim();
                tokens.push({ type: 'frac', num, den });
                i = denEnd + 1;
                continue;
            }
        }

        // 2. Square root: \sqrt{A}
        if (text.startsWith('\\sqrt', i)) {
            const argStart = text.indexOf('{', i);
            const argEnd = text.indexOf('}', argStart);
            if (argStart !== -1 && argEnd !== -1) {
                const inner = text.substring(argStart + 1, argEnd).trim();
                tokens.push({ type: 'sqrt', inner });
                i = argEnd + 1;
                continue;
            }
        }

        // 3. Superscript / Exponent: ^{...} or ^x
        if (text[i] === '^') {
            if (text[i + 1] === '{') {
                const end = text.indexOf('}', i + 1);
                if (end !== -1) {
                    const sup = text.substring(i + 2, end);
                    tokens.push({ type: 'sup', text: sup });
                    i = end + 1;
                    continue;
                }
            } else if (i + 1 < text.length) {
                tokens.push({ type: 'sup', text: text[i + 1] });
                i += 2;
                continue;
            }
        }

        // 4. Subscript: _{...} or _x
        if (text[i] === '_') {
            if (text[i + 1] === '{') {
                const end = text.indexOf('}', i + 1);
                if (end !== -1) {
                    const sub = text.substring(i + 2, end);
                    tokens.push({ type: 'sub', text: sub });
                    i = end + 1;
                    continue;
                }
            } else if (i + 1 < text.length) {
                tokens.push({ type: 'sub', text: text[i + 1] });
                i += 2;
                continue;
            }
        }

        // 5. Plain character / operator
        tokens.push({ type: 'char', text: text[i] });
        i++;
    }

    return tokens;
}

export function drawFormulaFrame(ctx, width, height, progress = 0, options = {}) {
    const title = (options.title || "EULER'S IDENTITY").toUpperCase();
    const latex = options.latex || "e^{i\\pi} + 1 = 0";
    const description = options.description || "The most beautiful theorem in mathematics";
    const theme = options.theme || "blackboard"; // 'blackboard' | 'blueprint' | 'quantum' | 'clean'
    const glowColor = options.glowColor || "cyan"; // 'cyan' | 'gold' | 'purple' | 'emerald'
    const isVertical = height > width;

    ctx.save();

    // 1. Theme Background & Palette
    let bgFill, gridColor, chalkMain, chalkGlow, textDescCol, badgeBg, badgeText;
    if (theme === 'blueprint') {
        bgFill = '#061A40';
        gridColor = 'rgba(0, 150, 255, 0.15)';
        chalkMain = '#E0F2FE';
        chalkGlow = glowColor === 'gold' ? '#FACC15' : '#38BDF8';
        textDescCol = '#93C5FD';
        badgeBg = 'rgba(0, 150, 255, 0.2)';
        badgeText = '#38BDF8';
    } else if (theme === 'quantum') {
        bgFill = '#090514';
        gridColor = 'rgba(192, 132, 252, 0.12)';
        chalkMain = '#FAF5FF';
        chalkGlow = glowColor === 'emerald' ? '#34D399' : '#C084FC';
        textDescCol = '#D8B4FE';
        badgeBg = 'rgba(192, 132, 252, 0.2)';
        badgeText = '#E879F9';
    } else if (theme === 'clean') {
        bgFill = '#F8FAFC';
        gridColor = 'rgba(0, 0, 0, 0.05)';
        chalkMain = '#0F172A';
        chalkGlow = '#3B82F6';
        textDescCol = '#475569';
        badgeBg = '#E2E8F0';
        badgeText = '#1E293B';
    } else {
        // Blackboard Chalk (Default 3Blue1Brown)
        bgFill = '#0F172A';
        gridColor = 'rgba(255, 255, 255, 0.038)';
        chalkMain = '#F8FAFC';
        chalkGlow = glowColor === 'gold' ? '#FDE047' : (glowColor === 'purple' ? '#C084FC' : (glowColor === 'emerald' ? '#34D399' : '#38BDF8'));
        textDescCol = '#94A3B8';
        badgeBg = 'rgba(56, 189, 248, 0.15)';
        badgeText = '#38BDF8';
    }

    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, width, height);

    // Math Graph Coordinate Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridSize = Math.floor(Math.min(width, height) / 18);
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

    // Coordinate Axes
    if (theme === 'blueprint' || theme === 'blackboard') {
        ctx.strokeStyle = theme === 'blueprint' ? 'rgba(0, 150, 255, 0.35)' : 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(height / 2));
        ctx.lineTo(width, Math.round(height / 2));
        ctx.stroke();
    }

    const mScale = Math.min(width, height) / 800;

    // 2. Formula Category & Step Title Badge
    const badgeY = Math.round(height * 0.12);
    const badgeFontSize = Math.max(12, Math.round(13 * mScale));
    ctx.font = `700 ${badgeFontSize}px 'Inter', sans-serif`;
    const titleW = ctx.measureText(title).width;
    const badgePadX = Math.round(18 * mScale);
    const badgePadY = Math.round(7 * mScale);
    const badgeX = Math.round((width - titleW - (badgePadX * 2)) / 2);

    ctx.fillStyle = badgeBg;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, Math.round(titleW + (badgePadX * 2)), Math.round(badgeFontSize + (badgePadY * 2)), 8);
        ctx.fill();
    } else {
        ctx.fillRect(badgeX, badgeY, Math.round(titleW + (badgePadX * 2)), Math.round(badgeFontSize + (badgePadY * 2)));
    }

    ctx.fillStyle = badgeText;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(title, Math.round(width / 2), Math.round(badgeY + (badgeFontSize / 2) + badgePadY));
    ctx.textAlign = 'left';

    // 3. Parse Semantic LaTeX Tokens
    const tokens = parseLatexTokens(latex);
    let baseFontSize = Math.round(isVertical ? width / 12 : width / 20);

    // Measure total token width with auto-fit scale
    const measureTokenWidth = (tok, fontSz) => {
        if (tok.type === 'sup' || tok.type === 'sub') {
            ctx.font = `700 ${Math.round(fontSz * 0.65)}px 'Cambria Math', 'Times New Roman', serif`;
            return ctx.measureText(tok.text).width;
        } else if (tok.type === 'frac') {
            ctx.font = `700 ${Math.round(fontSz * 0.72)}px 'Cambria Math', 'Times New Roman', serif`;
            const numW = ctx.measureText(tok.num).width;
            const denW = ctx.measureText(tok.den).width;
            return Math.max(numW, denW) + 16;
        } else if (tok.type === 'sqrt') {
            ctx.font = `700 ${fontSz}px 'Cambria Math', 'Times New Roman', serif`;
            return ctx.measureText(`√(${tok.inner})`).width;
        } else {
            ctx.font = `700 ${fontSz}px 'Cambria Math', 'Times New Roman', serif`;
            return ctx.measureText(tok.text).width;
        }
    };

    let totalFormulaWidth = 0;
    tokens.forEach((tok) => {
        totalFormulaWidth += measureTokenWidth(tok, baseFontSize);
    });

    // Auto-Fit Horizontally: Scale down dynamically if the equation is long
    const availableWidth = width * (isVertical ? 0.90 : 0.84);
    if (totalFormulaWidth > availableWidth && totalFormulaWidth > 0) {
        const scaleFactor = availableWidth / totalFormulaWidth;
        baseFontSize = Math.max(14, Math.round(baseFontSize * scaleFactor));
        totalFormulaWidth = 0;
        tokens.forEach((tok) => {
            totalFormulaWidth += measureTokenWidth(tok, baseFontSize);
        });
    }

    const formulaY = Math.round(height * 0.48);
    const startX = Math.round((width - totalFormulaWidth) / 2);

    // Smooth cubic easing for progressive character/token reveal
    const rawProgress = Math.min(1.0, Math.max(0, (progress - 0.04) / 0.68));
    const smoothDrawProgress = rawProgress < 0.5 
        ? 2 * rawProgress * rawProgress 
        : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

    const visibleTokenCount = Math.floor(smoothDrawProgress * tokens.length);
    const partialTokenFraction = (smoothDrawProgress * tokens.length) - visibleTokenCount;

    let curX = startX;
    let tipX = startX;
    let tipY = formulaY;

    ctx.textBaseline = 'middle';

    for (let i = 0; i <= visibleTokenCount && i < tokens.length; i++) {
        const tok = tokens[i];
        const isCurrentActiveToken = (i === visibleTokenCount);

        if (tok.type === 'sup') {
            const fontSz = Math.round(baseFontSize * 0.65);
            ctx.font = `700 ${fontSz}px 'Cambria Math', serif`;
            ctx.fillStyle = chalkGlow;
            const w = ctx.measureText(tok.text).width;

            if (!isCurrentActiveToken || partialTokenFraction > 0.2) {
                ctx.fillText(tok.text, curX, Math.round(formulaY - (baseFontSize * 0.35)));
            }
            curX += w;
            tipX = curX;
            tipY = Math.round(formulaY - (baseFontSize * 0.35));
        } else if (tok.type === 'sub') {
            const fontSz = Math.round(baseFontSize * 0.65);
            ctx.font = `700 ${fontSz}px 'Cambria Math', serif`;
            ctx.fillStyle = chalkGlow;
            const w = ctx.measureText(tok.text).width;

            if (!isCurrentActiveToken || partialTokenFraction > 0.2) {
                ctx.fillText(tok.text, curX, Math.round(formulaY + (baseFontSize * 0.35)));
            }
            curX += w;
            tipX = curX;
            tipY = Math.round(formulaY + (baseFontSize * 0.35));
        } else if (tok.type === 'frac') {
            const fracFontSz = Math.round(baseFontSize * 0.72);
            ctx.font = `700 ${fracFontSz}px 'Cambria Math', serif`;
            const numW = ctx.measureText(tok.num).width;
            const denW = ctx.measureText(tok.den).width;
            const fracW = Math.max(numW, denW) + 16;

            if (!isCurrentActiveToken || partialTokenFraction > 0.3) {
                // Numerator
                ctx.fillStyle = chalkMain;
                ctx.fillText(tok.num, curX + ((fracW - numW) / 2), Math.round(formulaY - (baseFontSize * 0.38)));
                // Denominator
                ctx.fillText(tok.den, curX + ((fracW - denW) / 2), Math.round(formulaY + (baseFontSize * 0.38)));
                // Fraction Bar
                ctx.strokeStyle = chalkGlow;
                ctx.lineWidth = Math.max(1.5, Math.round(baseFontSize * 0.05));
                ctx.beginPath();
                ctx.moveTo(curX + 2, formulaY);
                ctx.lineTo(curX + fracW - 2, formulaY);
                ctx.stroke();
            }
            curX += fracW;
            tipX = curX;
            tipY = formulaY;
        } else if (tok.type === 'sqrt') {
            const fontSz = baseFontSize;
            ctx.font = `700 ${fontSz}px 'Cambria Math', serif`;
            const textToDraw = `√(${tok.inner})`;
            const w = ctx.measureText(textToDraw).width;

            if (!isCurrentActiveToken || partialTokenFraction > 0.2) {
                ctx.fillStyle = chalkMain;
                ctx.shadowColor = chalkGlow;
                ctx.shadowBlur = 12;
                ctx.fillText(textToDraw, curX, formulaY);
                ctx.shadowColor = 'transparent';
            }
            curX += w;
            tipX = curX;
            tipY = formulaY;
        } else {
            // Regular char
            ctx.font = `700 ${baseFontSize}px 'Cambria Math', 'Times New Roman', serif`;
            ctx.fillStyle = chalkMain;
            const w = ctx.measureText(tok.text).width;

            if (!isCurrentActiveToken || partialTokenFraction > 0.1) {
                ctx.shadowColor = chalkGlow;
                ctx.shadowBlur = 14;
                ctx.fillText(tok.text, curX, formulaY);
                ctx.shadowColor = 'transparent';
            }
            curX += w;
            tipX = curX;
            tipY = formulaY;
        }
    }

    // 4. Sleek Kinetic Stylus Beam & Laser Glow (Replaces intrusive round circle)
    if (smoothDrawProgress > 0 && smoothDrawProgress < 0.98) {
        ctx.save();
        const cursorH = Math.round(baseFontSize * 1.05);
        const cursorW = Math.max(2.5, Math.round(baseFontSize * 0.055));
        const cursorTop = tipY - (cursorH / 2);
        const cursorLeft = tipX + 3;

        // Glowing Stylus Vertical Beam Gradient
        const beamGrad = ctx.createLinearGradient(0, cursorTop, 0, cursorTop + cursorH);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        beamGrad.addColorStop(0.2, chalkGlow);
        beamGrad.addColorStop(0.5, '#FFFFFF');
        beamGrad.addColorStop(0.8, chalkGlow);
        beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.shadowColor = chalkGlow;
        ctx.shadowBlur = 18;
        ctx.fillStyle = beamGrad;

        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(cursorLeft, cursorTop, cursorW, cursorH, cursorW / 2);
            ctx.fill();
        } else {
            ctx.fillRect(cursorLeft, cursorTop, cursorW, cursorH);
        }

        // Subtle Optical Flare at Active Writing Tip
        const flareW = Math.round(baseFontSize * 0.35);
        const flareGrad = ctx.createRadialGradient(cursorLeft + (cursorW / 2), tipY, 0, cursorLeft + (cursorW / 2), tipY, flareW);
        flareGrad.addColorStop(0, '#FFFFFF');
        flareGrad.addColorStop(0.3, chalkGlow);
        flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(cursorLeft + (cursorW / 2), tipY, flareW, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // 5. Formula Step Description Footer Card
    if (description && progress > 0.25) {
        const descAlpha = Math.min(1.0, (progress - 0.25) / 0.25);
        ctx.save();
        ctx.globalAlpha = descAlpha;

        const descY = Math.round(height * 0.76);
        const descFontSize = Math.max(13, Math.round(15 * mScale));
        ctx.font = `500 ${descFontSize}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = textDescCol;
        ctx.fillText(`“ ${description} ”`, Math.round(width / 2), descY);
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.40);
    ctx.restore();
}

// =========================================================================
// 11. KINETIC STORYTELLING TIMELINE FRAME RENDERER (VOX & DOCUMENTARY STYLE)
// =========================================================================
export function drawTimelineFrame(ctx, width, height, progress = 0, options = {}) {
    const rawTitle = options.title || "THE CHRONICLES OF MODERN AGE";
    const rawEvents = options.events || "1969 | Moon Landing | Apollo 11 mission succeeded\n1989 | Berlin Wall | End of the Cold War\n2000 | Internet Age | Global digital revolution\n2024 | Artificial Intelligence | Generative AI transformation";
    const theme = options.theme || "cyberDark"; // 'cyberDark' | 'documentary' | 'minimalWhite' | 'emeraldBio'
    const timelineStyle = options.style || "ruler"; // 'ruler' | 'minimal' | 'neonPulse' | 'documentary'
    const cameraZoom = Number(options.zoom) || 1.0;
    const isVertical = height > width;

    // Parse milestone events
    let eventList = [];
    if (Array.isArray(rawEvents)) {
        eventList = rawEvents;
    } else {
        eventList = (rawEvents || "").split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split('|').map(p => p.trim());
                return {
                    year: parts[0] || "YEAR",
                    title: parts[1] || "Event Milestone",
                    desc: parts[2] || "Detailed historical milestone description."
                };
            });
    }

    if (eventList.length === 0) {
        eventList = [
            { year: "1969", title: "Apollo 11", desc: "First humans land on the Moon" },
            { year: "1989", title: "World Wide Web", desc: "Tim Berners-Lee invents the web" },
            { year: "2024", title: "AI Revolution", desc: "Generative AI transforms science" }
        ];
    }

    const totalNodes = eventList.length;
    // Configurable Start and End Milestone Range
    const startIdx = Math.max(0, Math.min(totalNodes - 1, Number(options.startMilestone ?? 0)));
    const endIdx = Math.max(startIdx, Math.min(totalNodes - 1, Number(options.endMilestone ?? (totalNodes - 1))));

    ctx.save();

    // 1. Color Palette Configuration
    let bgGrad, axisColor, axisGlow, cardBg, cardBorder, textTitleCol, textYearCol, textDescCol, activeAccentCol;
    if (theme === 'documentary') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#1C1917');
        bgGrad.addColorStop(1, '#0C0A09');
        axisColor = '#D97706';
        axisGlow = '#F59E0B';
        cardBg = 'rgba(41, 37, 36, 0.90)';
        cardBorder = 'rgba(217, 119, 6, 0.55)';
        textTitleCol = '#FEF3C7';
        textYearCol = '#FBBF24';
        textDescCol = '#D6D3D1';
        activeAccentCol = '#F59E0B';
    } else if (theme === 'minimalWhite') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(1, '#020617');
        axisColor = '#38BDF8';
        axisGlow = '#0284C7';
        cardBg = 'rgba(30, 41, 59, 0.88)';
        cardBorder = 'rgba(56, 189, 248, 0.45)';
        textTitleCol = '#FFFFFF';
        textYearCol = '#38BDF8';
        textDescCol = '#94A3B8';
        activeAccentCol = '#38BDF8';
    } else if (theme === 'emeraldBio') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#042419');
        bgGrad.addColorStop(0.7, '#021810');
        bgGrad.addColorStop(1, '#010E09');
        axisColor = '#10B981';
        axisGlow = '#34D399';
        cardBg = 'rgba(6, 36, 26, 0.90)';
        cardBorder = 'rgba(52, 211, 153, 0.50)';
        textTitleCol = '#ECFDF5';
        textYearCol = '#34D399';
        textDescCol = '#A7F3D0';
        activeAccentCol = '#10B981';
    } else {
        // Cyber Dark (Default)
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(0.7, '#070B14');
        bgGrad.addColorStop(1, '#020617');
        axisColor = '#F5B301';
        axisGlow = '#FACC15';
        cardBg = 'rgba(15, 23, 42, 0.90)';
        cardBorder = 'rgba(245, 179, 1, 0.45)';
        textTitleCol = '#FFFFFF';
        textYearCol = '#F5B301';
        textDescCol = '#94A3B8';
        activeAccentCol = '#F5B301';
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Background Grid
    if (timelineStyle !== 'minimal') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const gSize = 44;
        for (let x = 0; x < width; x += gSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    // Top Header Banner
    const mScale = Math.min(width, height) / 800;
    const headerFontSize = Math.max(14, Math.round(18 * mScale));
    ctx.font = `800 ${headerFontSize}px 'Inter', sans-serif`;
    ctx.fillStyle = textTitleCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(rawTitle.toUpperCase(), width / 2, Math.round(height * 0.07));

    // Smooth Ease-In-Out Progression through selected [startIdx -> endIdx] range
    const safeProgress = Math.max(0, Math.min(1.0, isNaN(progress) ? 0 : Number(progress)));
    const smoothProgress = safeProgress < 0.5 
        ? 2 * safeProgress * safeProgress 
        : 1 - Math.pow(-2 * safeProgress + 2, 2) / 2;

    const activeFloatIndex = startIdx + (smoothProgress * (endIdx - startIdx));

    // Apply Camera Zoom centered
    ctx.save();
    if (cameraZoom !== 1.0) {
        ctx.translate(width / 2, height / 2);
        ctx.scale(cameraZoom, cameraZoom);
        ctx.translate(-width / 2, -height / 2);
    }

    if (!isVertical) {
        // ==========================================
        // 16:9 / HORIZONTAL AUTO-PAN TIMELINE
        // ==========================================
        const axisY = Math.round(height * 0.52);
        const nodeSpacing = Math.max(280, Math.round(width * 0.38));
        const camOffsetX = -activeFloatIndex * nodeSpacing;
        const originX = Math.round((width / 2) + camOffsetX);

        // 1. Draw Axis Background
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = timelineStyle === 'minimal' ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(0, axisY);
        ctx.lineTo(width, axisY);
        ctx.stroke();

        // 2. Draw Active Traveled Glowing Laser Line
        const startActiveX = originX + (startIdx * nodeSpacing);
        const currentHeadX = originX + (activeFloatIndex * nodeSpacing);
        ctx.strokeStyle = axisColor;
        ctx.shadowColor = axisGlow;
        ctx.shadowBlur = timelineStyle === 'neonPulse' ? 24 : 16;
        ctx.lineWidth = timelineStyle === 'minimal' ? 2 : 3.5;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, startActiveX - 60), axisY);
        ctx.lineTo(currentHeadX, axisY);
        ctx.stroke();
        ctx.restore();

        // 3. Ruler Precision Ticks (if ruler style)
        if (timelineStyle === 'ruler') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            for (let tX = originX % 20; tX < width; tX += 20) {
                const isMajor = Math.round(tX - originX) % 100 === 0;
                const tickH = isMajor ? 8 : 4;
                ctx.fillRect(tX, axisY - (tickH / 2), 1.5, tickH);
            }
        }

        // 4. Milestone Nodes & Cards
        eventList.forEach((ev, idx) => {
            const nodeX = Math.round(originX + (idx * nodeSpacing));
            if (nodeX < -300 || nodeX > width + 300) return;

            const distFromFocus = Math.abs(idx - activeFloatIndex);
            const isPassed = idx <= activeFloatIndex;
            const proximityFactor = Math.max(0, 1 - (distFromFocus * 0.8));
            const cardAlpha = Math.max(0.35, Math.min(1.0, 0.35 + (proximityFactor * 0.65)));
            const isTopCard = idx % 2 === 0;

            const cardW = Math.min(270, Math.round(width * 0.26));
            const cardH = Math.round(height * 0.22);
            const cardX = Math.round(nodeX - (cardW / 2));
            const cardY = isTopCard 
                ? axisY - cardH - Math.round(36 * mScale)
                : axisY + Math.round(36 * mScale);

            // Active Pulsating Radar Ring on the Current Active Node
            if (distFromFocus < 0.4) {
                const ringScale = (1 - distFromFocus / 0.4);
                ctx.save();
                ctx.strokeStyle = axisGlow;
                ctx.lineWidth = 2;
                ctx.shadowColor = axisGlow;
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(nodeX, axisY, Math.round(14 * mScale * ringScale) + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Glowing Node Pin on Axis
            ctx.save();
            ctx.fillStyle = isPassed ? axisColor : '#334155';
            ctx.shadowColor = isPassed ? axisGlow : 'transparent';
            ctx.shadowBlur = isPassed ? 18 : 0;
            ctx.beginPath();
            ctx.arc(nodeX, axisY, Math.max(6, Math.round(8 * mScale)), 0, Math.PI * 2);
            ctx.fill();

            // Inner Ring
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(nodeX, axisY, Math.max(2, Math.round(3 * mScale)), 0, Math.PI * 2);
            ctx.fill();

            // Connector Stem to Card
            ctx.strokeStyle = isPassed ? axisColor : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(nodeX, axisY);
            ctx.lineTo(nodeX, isTopCard ? cardY + cardH : cardY);
            ctx.stroke();
            ctx.restore();

            // Card Container
            ctx.save();
            ctx.globalAlpha = cardAlpha;
            ctx.fillStyle = cardBg;
            ctx.shadowColor = isPassed ? 'rgba(0,0,0,0.6)' : 'transparent';
            ctx.shadowBlur = 20;

            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 10);
                ctx.fill();
            } else {
                ctx.fillRect(cardX, cardY, cardW, cardH);
            }

            // Card Border
            ctx.strokeStyle = isPassed ? cardBorder : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = isPassed ? 1.5 : 1;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 10);
                ctx.stroke();
            } else {
                ctx.strokeRect(cardX, cardY, cardW, cardH);
            }

            // Year Pill Tag
            const yearFontSize = Math.max(11, Math.round(12 * mScale));
            ctx.font = `800 ${yearFontSize}px 'Inter', sans-serif`;
            const yearW = ctx.measureText(ev.year).width;
            const yearPadX = 8;
            const yearPadY = 3;

            ctx.fillStyle = isPassed ? activeAccentCol : '#475569';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX + 12, cardY + 12, yearW + (yearPadX * 2), yearFontSize + (yearPadY * 2), 4);
                ctx.fill();
            } else {
                ctx.fillRect(cardX + 12, cardY + 12, yearW + (yearPadX * 2), yearFontSize + (yearPadY * 2));
            }

            ctx.fillStyle = isPassed ? '#000000' : '#FFFFFF';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(ev.year, cardX + 12 + yearPadX, cardY + 12 + (yearFontSize / 2) + yearPadY);

            // Title
            const titleFontSize = Math.max(12, Math.round(14 * mScale));
            ctx.font = `700 ${titleFontSize}px 'Inter', sans-serif`;
            ctx.fillStyle = textTitleCol;
            ctx.textBaseline = 'top';
            ctx.fillText(ev.title, cardX + 12, cardY + 12 + yearFontSize + 10);

            // Description Snippet
            const descFontSize = Math.max(10, Math.round(11 * mScale));
            ctx.font = `400 ${descFontSize}px 'Inter', sans-serif`;
            ctx.fillStyle = textDescCol;
            const words = ev.desc.split(' ');
            let line = '';
            let lineY = cardY + 12 + yearFontSize + titleFontSize + 16;
            const maxDescW = cardW - 24;

            words.forEach(word => {
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width > maxDescW) {
                    ctx.fillText(line, cardX + 12, lineY);
                    line = word;
                    lineY += descFontSize + 4;
                } else {
                    line = test;
                }
            });
            ctx.fillText(line, cardX + 12, lineY);
            ctx.restore();
        });

    } else {
        // ==========================================
        // 9:16 / VERTICAL AUTO-PAN TIMELINE
        // ==========================================
        const axisX = Math.round(width * 0.18);
        const nodeSpacing = Math.max(220, Math.round(height * 0.28));
        const camOffsetY = -activeFloatIndex * nodeSpacing;
        const originY = Math.round((height / 2) + camOffsetY);

        // 1. Draw Vertical Axis
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = timelineStyle === 'minimal' ? 1 : 2;
        ctx.beginPath();
        ctx.moveTo(axisX, 0);
        ctx.lineTo(axisX, height);
        ctx.stroke();

        // 2. Active Glowing Laser Trace
        const startActiveY = originY + (startIdx * nodeSpacing);
        const currentHeadY = originY + (activeFloatIndex * nodeSpacing);
        ctx.strokeStyle = axisColor;
        ctx.shadowColor = axisGlow;
        ctx.shadowBlur = timelineStyle === 'neonPulse' ? 24 : 16;
        ctx.lineWidth = timelineStyle === 'minimal' ? 2 : 3.5;
        ctx.beginPath();
        ctx.moveTo(axisX, Math.max(0, startActiveY - 60));
        ctx.lineTo(axisX, currentHeadY);
        ctx.stroke();
        ctx.restore();

        // 3. Milestone Nodes & Cards
        eventList.forEach((ev, idx) => {
            const nodeY = Math.round(originY + (idx * nodeSpacing));
            if (nodeY < -200 || nodeY > height + 200) return;

            const distFromFocus = Math.abs(idx - activeFloatIndex);
            const isPassed = idx <= activeFloatIndex;
            const proximityFactor = Math.max(0, 1 - (distFromFocus * 0.8));
            const cardAlpha = Math.max(0.35, Math.min(1.0, 0.35 + (proximityFactor * 0.65)));

            const cardX = axisX + Math.round(32 * mScale);
            const cardW = Math.round(width * 0.72);
            const cardH = Math.round(nodeSpacing * 0.75);
            const cardY = Math.round(nodeY - (cardH / 2));

            // Glowing Node Pin
            ctx.save();
            ctx.fillStyle = isPassed ? axisColor : '#334155';
            ctx.shadowColor = isPassed ? axisGlow : 'transparent';
            ctx.shadowBlur = isPassed ? 18 : 0;
            ctx.beginPath();
            ctx.arc(axisX, nodeY, Math.max(6, Math.round(8 * mScale)), 0, Math.PI * 2);
            ctx.fill();

            // Inner Ring
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(axisX, nodeY, Math.max(2, Math.round(3 * mScale)), 0, Math.PI * 2);
            ctx.fill();

            // Horizontal Connector Line
            ctx.strokeStyle = isPassed ? axisColor : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(axisX, nodeY);
            ctx.lineTo(cardX, nodeY);
            ctx.stroke();
            ctx.restore();

            // Card Container
            ctx.save();
            ctx.globalAlpha = cardAlpha;
            ctx.fillStyle = cardBg;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 10);
                ctx.fill();
            } else {
                ctx.fillRect(cardX, cardY, cardW, cardH);
            }

            ctx.strokeStyle = isPassed ? cardBorder : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = isPassed ? 1.5 : 1;
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX, cardY, cardW, cardH, 10);
                ctx.stroke();
            } else {
                ctx.strokeRect(cardX, cardY, cardW, cardH);
            }

            // Year Pill Tag
            const yearFontSize = Math.max(11, Math.round(12 * mScale));
            ctx.font = `800 ${yearFontSize}px 'Inter', sans-serif`;
            const yearW = ctx.measureText(ev.year).width;
            const yearPadX = 8;
            const yearPadY = 3;

            ctx.fillStyle = isPassed ? activeAccentCol : '#475569';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(cardX + 12, cardY + 12, yearW + (yearPadX * 2), yearFontSize + (yearPadY * 2), 4);
                ctx.fill();
            } else {
                ctx.fillRect(cardX + 12, cardY + 12, yearW + (yearPadX * 2), yearFontSize + (yearPadY * 2));
            }

            ctx.fillStyle = isPassed ? '#000000' : '#FFFFFF';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(ev.year, cardX + 12 + yearPadX, cardY + 12 + (yearFontSize / 2) + yearPadY);

            // Title
            const titleFontSize = Math.max(12, Math.round(14 * mScale));
            ctx.font = `700 ${titleFontSize}px 'Inter', sans-serif`;
            ctx.fillStyle = textTitleCol;
            ctx.textBaseline = 'top';
            ctx.fillText(ev.title, cardX + 12, cardY + 12 + yearFontSize + 10);

            // Description Snippet
            const descFontSize = Math.max(10, Math.round(11 * mScale));
            ctx.font = `400 ${descFontSize}px 'Inter', sans-serif`;
            ctx.fillStyle = textDescCol;
            const words = ev.desc.split(' ');
            let line = '';
            let lineY = cardY + 12 + yearFontSize + titleFontSize + 14;
            const maxDescW = cardW - 24;

            words.forEach(word => {
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width > maxDescW) {
                    ctx.fillText(line, cardX + 12, lineY);
                    line = word;
                    lineY += descFontSize + 4;
                } else {
                    line = test;
                }
            });
            ctx.fillText(line, cardX + 12, lineY);
            ctx.restore();
        });
    }

    ctx.restore(); // restore camera zoom
    drawVignette(ctx, width, height, 0.40);
    ctx.restore();
}

// =========================================================================
// 12. VOX & JOHNNY HARRIS STYLE EVENT TREE & CAUSAL GRAPH RENDERER
// (Supports Multi-Root Phases & Smart Auto-Scroll for >4 Branches)
// =========================================================================
export function drawEventTreeFrame(ctx, width, height, progress = 0, options = {}) {
    const defaultRootTitle = options.rootTitle || "INDUSTRIAL REVOLUTION";
    const defaultRootSubtitle = options.rootSubtitle || "KEY TURNING POINT • 18TH CENTURY";
    const theme = options.theme || "voxGold"; // 'voxGold' | 'neonCyber' | 'cleanSlate'
    const connectorStyle = options.connectorStyle || "bezierCurve"; // 'bezierCurve' | 'circuit' | 'straightLaser'
    const isVertical = height > width;

    // Safe input handling for branches
    let branchText = "";
    if (Array.isArray(options.branches)) {
        branchText = options.branches.map(b => typeof b === 'object' ? `${b.title || ''} | ${b.desc || ''} | ${b.metric || ''}` : String(b)).join('\n');
    } else {
        branchText = typeof options.branches === 'string' ? options.branches : "";
    }

    // Multi-Root Parsing
    // Sections delimited by "=== Root Title | Root Subtitle ===" or fallback to single root
    let rootGroups = [];
    const rawLines = branchText.split('\n').map(l => l.trim()).filter(Boolean);
    let currentRoot = null;

    rawLines.forEach(line => {
        if (line.startsWith('===') && line.endsWith('===')) {
            const inner = line.replace(/===/g, '').trim();
            const parts = inner.split('|').map(p => p.trim());
            currentRoot = {
                rootTitle: parts[0] || defaultRootTitle,
                rootSubtitle: parts[1] || defaultRootSubtitle,
                branches: []
            };
            rootGroups.push(currentRoot);
        } else {
            const parts = line.split('|').map(p => p.trim());
            const branchObj = {
                title: parts[0] || "Branch Cause",
                desc: parts[1] || "Detailed downstream impact and consequence.",
                metric: parts[2] || ""
            };

            if (!currentRoot) {
                currentRoot = {
                    rootTitle: defaultRootTitle,
                    rootSubtitle: defaultRootSubtitle,
                    branches: []
                };
                rootGroups.push(currentRoot);
            }
            currentRoot.branches.push(branchObj);
        }
    });

    if (rootGroups.length === 0) {
        rootGroups = [{
            rootTitle: defaultRootTitle,
            rootSubtitle: defaultRootSubtitle,
            branches: [
                { title: "Rapid Automation", desc: "Machines replace manual labor", metric: "85% Efficiency" },
                { title: "Urban Migration", desc: "Populations shift to industrial centers", metric: "+340% Growth" },
                { title: "Global Commerce", desc: "Steam power connects trade networks", metric: "$4.2B Volume" }
            ]
        }];
    }

    // Multi-Root Progress Timeline & Phase Variables
    const totalRoots = Math.max(1, rootGroups.length);
    const safeProgress = Math.max(0, Math.min(1.0, isNaN(progress) ? 0 : Number(progress)));
    
    // Global Smooth Camera Progression across the entire continuous world plane
    const smoothGlobalProgress = safeProgress < 0.5 
        ? 2 * safeProgress * safeProgress 
        : 1 - Math.pow(-2 * safeProgress + 2, 2) / 2;

    const currentRootIndexFloat = safeProgress * totalRoots;
    const activeRootIndex = Math.max(0, Math.min(totalRoots - 1, Math.floor(currentRootIndexFloat)));

    ctx.save();

    // Thematic Root Color Progression for Multi-Root
    const rootAccents = ['#F5B301', '#38BDF8', '#10B981', '#F43F5E', '#A855F7'];
    const activeRootAccent = rootAccents[activeRootIndex % rootAccents.length];

    // Color Palette Configuration
    let bgGrad, rootBg, branchBg, textMain, textMuted, laserGlow;
    if (theme === 'neonCyber') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(1, '#020617');
        rootBg = '#1E293B';
        branchBg = 'rgba(30, 41, 59, 0.92)';
        laserGlow = '#0284C7';
        textMain = '#FFFFFF';
        textMuted = '#94A3B8';
    } else if (theme === 'cleanSlate') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#1E293B');
        bgGrad.addColorStop(1, '#0F172A');
        rootBg = '#0F172A';
        branchBg = 'rgba(15, 23, 42, 0.92)';
        laserGlow = '#3B82F6';
        textMain = '#F8FAFC';
        textMuted = '#94A3B8';
    } else {
        // Vox Gold (Default)
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#18181B');
        bgGrad.addColorStop(0.7, '#0F0F12');
        bgGrad.addColorStop(1, '#08080A');
        rootBg = '#27272A';
        branchBg = 'rgba(39, 39, 42, 0.92)';
        laserGlow = '#FACC15';
        textMain = '#FFFFFF';
        textMuted = '#A1A1AA';
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Canvas Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    const mScale = Math.min(width, height) / 800;

    // =========================================================================
    // CONTINUOUS WORLD CANVAS LAYOUT SETUP
    // =========================================================================
    const stageSpacingX = width * 1.12;
    const stageSpacingY = height * 1.15;

    // Continuous Camera World Offset
    const cameraWorldX = !isVertical ? smoothGlobalProgress * (totalRoots - 1) * stageSpacingX : 0;
    const cameraWorldY = isVertical ? smoothGlobalProgress * (totalRoots - 1) * stageSpacingY : 0;

    // Save context for Camera Viewport Pan
    ctx.save();
    ctx.translate(-cameraWorldX, -cameraWorldY);

    // Track Stage Connection Points for Inter-Stage Bridge Lasers
    const stageConnectionPoints = [];

    // RENDER ALL ROOT STAGES IN UNIFIED WORLD SPACE
    rootGroups.forEach((group, gIdx) => {
        const stageAccent = rootAccents[gIdx % rootAccents.length];
        const stageBorder = stageAccent;
        const stageBranchBorder = stageAccent;

        // Stage Local Progress Window: [gIdx / totalRoots, (gIdx + 1) / totalRoots]
        const stageStartNorm = gIdx / totalRoots;
        const stageEndNorm = (gIdx + 1) / totalRoots;
        const localStageProg = Math.max(0, Math.min(1.0, (safeProgress - stageStartNorm) / (stageEndNorm - stageStartNorm)));

        // Smooth Root & Branch Reveal for this Stage
        const rawRootProg = Math.max(0, Math.min(1.0, localStageProg / 0.22));
        const rootScale = rawRootProg < 0.5 ? 2 * rawRootProg * rawRootProg : 1 - Math.pow(-2 * rawRootProg + 2, 2) / 2;

        const rawBranchProg = Math.max(0, Math.min(1.0, (localStageProg - 0.12) / 0.76));
        const branchCurveProg = rawBranchProg < 0.5 ? 2 * rawBranchProg * rawBranchProg : 1 - Math.pow(-2 * rawBranchProg + 2, 2) / 2;

        const stageBranches = (group.branches && group.branches.length > 0) ? group.branches : [
            { title: "Rapid Automation", desc: "Machines replace manual labor", metric: "85% Efficiency" }
        ];
        const branchCount = stageBranches.length;
        const activeBranchFocusFloat = Math.min(branchCount - 1, branchCurveProg * (branchCount - 1));

        if (!isVertical) {
            // =========================================================
            // 16:9 HORIZONTAL STAGE WORLD COORDINATES
            // =========================================================
            const stageWorldStartX = gIdx * stageSpacingX;
            const rootW = Math.round(width * 0.28);
            const rootH = Math.round(height * 0.28);
            const rootX = Math.round(stageWorldStartX + (width * 0.08));
            const rootY = Math.round((height - rootH) / 2);
            const rootInX = rootX;
            const rootInY = rootY + (rootH / 2);
            const rootOutX = rootX + rootW;
            const rootOutY = rootY + (rootH / 2);

            const branchW = Math.round(width * 0.38);
            const branchH = Math.round(height * 0.18);
            const branchX = Math.round(stageWorldStartX + (width * 0.52));
            const branchSpacing = branchH + 18;

            let stageScrollY = 0;
            if (branchCount > 4) {
                const focusCenterY = activeBranchFocusFloat * branchSpacing + (branchH / 2);
                stageScrollY = (height / 2) - focusCenterY;
            } else {
                const totalH = branchCount * branchH + (branchCount - 1) * 18;
                stageScrollY = (height - totalH) / 2;
            }

            const lastBranchCenterY = Math.round(stageScrollY + ((branchCount - 1) * branchSpacing) + (branchH / 2));
            const lastBranchOutX = branchX + branchW;

            // Store connection points for bridging lasers
            stageConnectionPoints.push({
                gIdx,
                rootInX,
                rootInY,
                lastBranchOutX,
                lastBranchCenterY,
                stageAccent
            });

            // 1. Draw Root Card (Only if unlocked or ignited)
            if (rootScale > 0.01) {
                ctx.save();
                ctx.translate(rootX + (rootW / 2), rootY + (rootH / 2));
                ctx.scale(rootScale, rootScale);
                ctx.translate(-(rootX + (rootW / 2)), -(rootY + (rootH / 2)));

                ctx.fillStyle = rootBg;
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 24;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(rootX, rootY, rootW, rootH, 12);
                    ctx.fill();
                } else {
                    ctx.fillRect(rootX, rootY, rootW, rootH);
                }

                ctx.strokeStyle = stageBorder;
                ctx.lineWidth = 2.5;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(rootX, rootY, rootW, rootH, 12);
                    ctx.stroke();
                } else {
                    ctx.strokeRect(rootX, rootY, rootW, rootH);
                }

                // Left Ingestion Pin with Smooth Energy Dissipation Animation
                if (gIdx > 0) {
                    const pinAlpha = Math.max(0, 1 - (localStageProg / 0.35));
                    if (pinAlpha > 0.01) {
                        ctx.save();
                        ctx.globalAlpha = pinAlpha;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.shadowColor = stageAccent;
                        ctx.shadowBlur = 20;
                        ctx.beginPath();
                        ctx.arc(rootInX, rootInY, Math.max(3, Math.round(5 * mScale)) * (1 + (1 - pinAlpha) * 0.6), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }

                // Right Output Port
                ctx.fillStyle = stageAccent;
                ctx.shadowColor = laserGlow;
                ctx.shadowBlur = 18;
                ctx.beginPath();
                ctx.arc(rootOutX, rootOutY, Math.max(5, Math.round(6 * mScale)), 0, Math.PI * 2);
                ctx.fill();

                // Root Badge
                const rootBadgeFontSize = Math.max(10, Math.round(11 * mScale));
                ctx.font = `800 ${rootBadgeFontSize}px 'Inter', sans-serif`;
                ctx.fillStyle = stageAccent;
                ctx.textBaseline = 'top';
                ctx.fillText(totalRoots > 1 ? `PHASE ${gIdx + 1}/${totalRoots} • CAUSAL ROOT` : "ROOT EVENT", rootX + 16, rootY + 16);

                // Root Title
                const rootTitleFontSize = Math.max(14, Math.round(18 * mScale));
                ctx.font = `800 ${rootTitleFontSize}px 'Inter', sans-serif`;
                ctx.fillStyle = textMain;
                ctx.fillText(group.rootTitle, rootX + 16, rootY + 16 + rootBadgeFontSize + 8);

                // Root Subtitle
                const rootSubFontSize = Math.max(11, Math.round(12 * mScale));
                ctx.font = `500 ${rootSubFontSize}px 'Inter', sans-serif`;
                ctx.fillStyle = textMuted;
                ctx.fillText(group.rootSubtitle, rootX + 16, rootY + 16 + rootBadgeFontSize + rootTitleFontSize + 16);
                ctx.restore();
            }

            // 2. Inter-Branch Domino Energy Rail (Vertical guide)
            if (branchCount > 1 && branchCurveProg > 0.05) {
                ctx.save();
                ctx.strokeStyle = stageAccent;
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = Math.min(1.0, branchCurveProg * 0.7);
                ctx.beginPath();
                const firstBY = Math.round(stageScrollY + (branchH / 2));
                const lastBY = Math.round(stageScrollY + ((branchCount - 1) * branchSpacing) + (branchH / 2));
                ctx.moveTo(branchX + branchW - 6, firstBY);
                ctx.lineTo(branchX + branchW - 6, lastBY);
                ctx.stroke();
                ctx.restore();
            }

            // 3. Draw Branches & Sequential Connectors
            stageBranches.forEach((br, bIdx) => {
                const bY = Math.round(stageScrollY + (bIdx * branchSpacing));
                const bInX = branchX;
                const bInY = bY + (branchH / 2);

                const stepUnlockProg = Math.max(0, Math.min(1.0, (branchCurveProg - (bIdx * 0.16)) / 0.45));

                if (stepUnlockProg > 0) {
                    const distFromFocus = Math.abs(bIdx - activeBranchFocusFloat);
                    const branchAlpha = branchCount > 4 ? Math.max(0.2, 1 - (distFromFocus * 0.35)) : 1.0;

                    // Connector Laser
                    ctx.save();
                    ctx.globalAlpha = stepUnlockProg * branchAlpha;
                    ctx.strokeStyle = stageAccent;
                    ctx.shadowColor = stageAccent;
                    ctx.shadowBlur = 14;
                    ctx.lineWidth = 2.5;

                    if (connectorStyle === 'circuit') {
                        const midX = rootOutX + Math.round((bInX - rootOutX) * 0.45);
                        ctx.beginPath();
                        ctx.moveTo(rootOutX, rootOutY);
                        ctx.lineTo(midX, rootOutY);
                        ctx.lineTo(midX, bInY);
                        ctx.lineTo(bInX, bInY);
                        ctx.stroke();
                    } else if (connectorStyle === 'straightLaser') {
                        ctx.beginPath();
                        ctx.moveTo(rootOutX, rootOutY);
                        ctx.lineTo(bInX, bInY);
                        ctx.stroke();
                    } else {
                        // Fluid Bezier
                        const cX1 = rootOutX + Math.round((bInX - rootOutX) * 0.5);
                        const cY1 = rootOutY;
                        const cX2 = rootOutX + Math.round((bInX - rootOutX) * 0.5);
                        const cY2 = bInY;

                        ctx.beginPath();
                        ctx.moveTo(rootOutX, rootOutY);
                        ctx.bezierCurveTo(cX1, cY1, cX2, cY2, bInX, bInY);
                        ctx.stroke();

                        // Continuous Traveling Laser Photon
                        const pulseT = (safeProgress * 4.0 + (bIdx * 0.25) + (gIdx * 0.5)) % 1.0;
                        const omt = 1 - pulseT;
                        const px = (omt*omt*omt * rootOutX) + (3*omt*omt*pulseT * cX1) + (3*omt*pulseT*pulseT * cX2) + (pulseT*pulseT*pulseT * bInX);
                        const py = (omt*omt*omt * rootOutY) + (3*omt*omt*pulseT * cY1) + (3*omt*pulseT*pulseT * cY2) + (pulseT*pulseT*pulseT * bInY);

                        ctx.fillStyle = '#FFFFFF';
                        ctx.shadowBlur = 18;
                        ctx.beginPath();
                        ctx.arc(px, py, 4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();

                    // Branch Card Box
                    ctx.save();
                    ctx.globalAlpha = stepUnlockProg * branchAlpha;
                    const slideX = branchX + ((1 - stepUnlockProg) * 35);

                    ctx.fillStyle = branchBg;
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 16;
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(slideX, bY, branchW, branchH, 10);
                        ctx.fill();
                    } else {
                        ctx.fillRect(slideX, bY, branchW, branchH);
                    }

                    ctx.strokeStyle = stageBranchBorder;
                    ctx.lineWidth = 1.5;
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(slideX, bY, branchW, branchH, 10);
                        ctx.stroke();
                    } else {
                        ctx.strokeRect(slideX, bY, branchW, branchH);
                    }

                    // Input Pin
                    ctx.fillStyle = stageAccent;
                    ctx.beginPath();
                    ctx.arc(slideX, bInY, 4, 0, Math.PI * 2);
                    ctx.fill();

                    // Branch Title
                    const brTitleFontSize = Math.max(13, Math.round(15 * mScale));
                    ctx.font = `700 ${brTitleFontSize}px 'Inter', sans-serif`;
                    ctx.fillStyle = textMain;
                    ctx.textBaseline = 'top';
                    ctx.fillText(br.title, slideX + 14, bY + 12);

                    // Metric Tag
                    if (br.metric) {
                        const tagFontSize = Math.max(10, Math.round(11 * mScale));
                        ctx.font = `800 ${tagFontSize}px 'Inter', sans-serif`;
                        const tagW = ctx.measureText(br.metric).width;
                        const tagPadX = 8;
                        const tagPadY = 3;
                        const tagX = slideX + branchW - tagW - (tagPadX * 2) - 14;

                        ctx.fillStyle = stageAccent;
                        if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(tagX, bY + 10, tagW + (tagPadX * 2), tagFontSize + (tagPadY * 2), 4);
                            ctx.fill();
                        } else {
                            ctx.fillRect(tagX, bY + 10, tagW + (tagPadX * 2), tagFontSize + (tagPadY * 2));
                        }

                        ctx.fillStyle = '#000000';
                        ctx.textBaseline = 'middle';
                        ctx.textAlign = 'left';
                        ctx.fillText(br.metric, tagX + tagPadX, bY + 10 + (tagFontSize / 2) + tagPadY);
                    }

                    // Branch Description
                    const brDescFontSize = Math.max(11, Math.round(12 * mScale));
                    ctx.font = `400 ${brDescFontSize}px 'Inter', sans-serif`;
                    ctx.fillStyle = textMuted;
                    ctx.fillText(br.desc, slideX + 14, bY + 12 + brTitleFontSize + 8);

                    ctx.restore();
                }
            });

        } else {
            // =========================================================
            // 9:16 VERTICAL STACK STAGE WORLD COORDINATES
            // =========================================================
            const stageWorldStartY = gIdx * stageSpacingY;
            const rootW = Math.round(width * 0.86);
            const rootH = Math.round(height * 0.16);
            const rootX = Math.round((width - rootW) / 2);
            const rootY = Math.round(stageWorldStartY + (totalRoots > 1 ? height * 0.10 : height * 0.08));
            const rootInX = width / 2;
            const rootInY = rootY;
            const rootOutX = width / 2;
            const rootOutY = rootY + rootH;

            const branchW = Math.round(width * 0.86);
            const branchH = Math.round(height * 0.14);
            const branchX = Math.round((width - branchW) / 2);
            const branchSpacing = branchH + 16;

            let stageScrollY = Math.round(stageWorldStartY + (height * 0.28));
            if (branchCount > 3) {
                const focusCenterY = activeBranchFocusFloat * branchSpacing;
                stageScrollY = Math.round(stageWorldStartY + (height * 0.45)) - focusCenterY;
            }

            const lastBranchCenterY = Math.round(stageScrollY + ((branchCount - 1) * branchSpacing) + branchH);
            const lastBranchOutX = width / 2;

            stageConnectionPoints.push({
                gIdx,
                rootInX,
                rootInY,
                lastBranchOutX,
                lastBranchCenterY,
                stageAccent
            });

            if (rootScale > 0.01) {
                ctx.save();
                ctx.translate(width / 2, rootY + (rootH / 2));
                ctx.scale(rootScale, rootScale);
                ctx.translate(-(width / 2), -(rootY + (rootH / 2)));

                ctx.fillStyle = rootBg;
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 20;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(rootX, rootY, rootW, rootH, 12);
                    ctx.fill();
                } else {
                    ctx.fillRect(rootX, rootY, rootW, rootH);
                }

                ctx.strokeStyle = stageBorder;
                ctx.lineWidth = 2.5;
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(rootX, rootY, rootW, rootH, 12);
                    ctx.stroke();
                } else {
                    ctx.strokeRect(rootX, rootY, rootW, rootH);
                }

                // Top Ingestion Pin with Smooth Energy Dissipation Animation (Vertical)
                if (gIdx > 0) {
                    const pinAlpha = Math.max(0, 1 - (localStageProg / 0.35));
                    if (pinAlpha > 0.01) {
                        ctx.save();
                        ctx.globalAlpha = pinAlpha;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.shadowColor = stageAccent;
                        ctx.shadowBlur = 20;
                        ctx.beginPath();
                        ctx.arc(rootInX, rootInY, Math.max(3, Math.round(5 * mScale)) * (1 + (1 - pinAlpha) * 0.6), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }

                ctx.fillStyle = stageAccent;
                ctx.font = `800 ${Math.max(10, Math.round(11 * mScale))}px 'Inter', sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(totalRoots > 1 ? `PHASE ${gIdx + 1}/${totalRoots} • CAUSAL ROOT` : "ROOT EVENT", rootX + 14, rootY + 12);

                ctx.fillStyle = textMain;
                ctx.font = `800 ${Math.max(14, Math.round(16 * mScale))}px 'Inter', sans-serif`;
                ctx.fillText(group.rootTitle, rootX + 14, rootY + 28);

                ctx.fillStyle = textMuted;
                ctx.font = `500 ${Math.max(11, Math.round(12 * mScale))}px 'Inter', sans-serif`;
                ctx.fillText(group.rootSubtitle, rootX + 14, rootY + 50);
                ctx.restore();
            }

            stageBranches.forEach((br, bIdx) => {
                const bY = stageScrollY + (bIdx * branchSpacing);
                const bInX = width / 2;
                const bInY = bY;

                const stepUnlockProg = Math.max(0, Math.min(1.0, (branchCurveProg - (bIdx * 0.16)) / 0.45));

                if (stepUnlockProg > 0) {
                    const distFromFocus = Math.abs(bIdx - activeBranchFocusFloat);
                    const branchAlpha = branchCount > 3 ? Math.max(0.25, 1 - (distFromFocus * 0.40)) : 1.0;

                    // Sequential Vertical Segment from previous card bottom to current card top (NEVER overlaps over boxes)
                    const fromX = bIdx === 0 ? rootOutX : (width / 2);
                    const fromY = bIdx === 0 ? rootOutY : (stageScrollY + ((bIdx - 1) * branchSpacing) + branchH);

                    if (bInY > fromY) {
                        ctx.save();
                        ctx.globalAlpha = stepUnlockProg * branchAlpha;
                        ctx.strokeStyle = stageAccent;
                        ctx.shadowColor = stageAccent;
                        ctx.shadowBlur = 14;
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        ctx.moveTo(fromX, fromY);
                        ctx.lineTo(bInX, bInY);
                        ctx.stroke();

                        // Photon spark travelling through the vertical laser gap
                        const pulseProg = (branchCurveProg * 2 + (bIdx * 0.35)) % 1.0;
                        const py = fromY + (bInY - fromY) * pulseProg;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(fromX, py, 3, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    ctx.save();
                    ctx.globalAlpha = stepUnlockProg * branchAlpha;
                    ctx.fillStyle = branchBg;
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(branchX, bY, branchW, branchH, 10);
                        ctx.fill();
                    } else {
                        ctx.fillRect(branchX, bY, branchW, branchH);
                    }

                    ctx.strokeStyle = stageBranchBorder;
                    ctx.lineWidth = 1.5;
                    if (ctx.roundRect) {
                        ctx.beginPath();
                        ctx.roundRect(branchX, bY, branchW, branchH, 10);
                        ctx.stroke();
                    } else {
                        ctx.strokeRect(branchX, bY, branchW, branchH);
                    }

                    ctx.fillStyle = textMain;
                    ctx.font = `700 ${Math.max(13, Math.round(15 * mScale))}px 'Inter', sans-serif`;
                    ctx.textBaseline = 'top';
                    ctx.fillText(br.title, branchX + 14, bY + 12);

                    if (br.metric) {
                        const tagFontSize = Math.max(10, Math.round(11 * mScale));
                        ctx.font = `800 ${tagFontSize}px 'Inter', sans-serif`;
                        const tagW = ctx.measureText(br.metric).width;
                        const tagX = branchX + branchW - tagW - 24;

                        ctx.fillStyle = stageAccent;
                        if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(tagX, bY + 10, tagW + 16, tagFontSize + 6, 4);
                            ctx.fill();
                        } else {
                            ctx.fillRect(tagX, bY + 10, tagW + 16, tagFontSize + 6);
                        }

                        ctx.fillStyle = '#000000';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(br.metric, tagX + 8, bY + 10 + (tagFontSize / 2) + 3);
                    }

                    ctx.fillStyle = textMuted;
                    ctx.font = `400 ${Math.max(11, Math.round(12 * mScale))}px 'Inter', sans-serif`;
                    ctx.fillText(br.desc, branchX + 14, bY + 36);
                    ctx.restore();
                }
            });
        }
    });

    // =========================================================================
    // 4. DRAW PHYSICAL CONTINUOUS CAUSAL BRIDGE CONDUITS BETWEEN ALL STAGES
    // =========================================================================
    if (stageConnectionPoints.length > 1) {
        for (let i = 0; i < stageConnectionPoints.length - 1; i++) {
            const fromPt = stageConnectionPoints[i];
            const toPt = stageConnectionPoints[i + 1];

            // Bridge activation window in global time: around transition from Stage i to Stage i+1
            const bridgeGlobalStart = (i + 0.60) / totalRoots;
            const bridgeGlobalEnd = (i + 1.15) / totalRoots;
            const bridgeProgress = Math.max(0, Math.min(1.0, (safeProgress - bridgeGlobalStart) / (bridgeGlobalEnd - bridgeGlobalStart)));

            if (bridgeProgress > 0) {
                ctx.save();
                ctx.strokeStyle = toPt.stageAccent;
                ctx.shadowColor = toPt.stageAccent;
                ctx.shadowBlur = 24;
                ctx.lineWidth = 3.5;

                if (!isVertical) {
                    // Continuous Horizontal S-Bridge across world space
                    const cX1 = fromPt.lastBranchOutX + Math.round((toPt.rootInX - fromPt.lastBranchOutX) * 0.5);
                    const cY1 = fromPt.lastBranchCenterY;
                    const cX2 = fromPt.lastBranchOutX + Math.round((toPt.rootInX - fromPt.lastBranchOutX) * 0.5);
                    const cY2 = toPt.rootInY;

                    ctx.beginPath();
                    ctx.moveTo(fromPt.lastBranchOutX, fromPt.lastBranchCenterY);
                    ctx.bezierCurveTo(cX1, cY1, cX2, cY2, toPt.rootInX, toPt.rootInY);
                    ctx.stroke();

                    // High-energy Traveling Spark bridging from Stage i to Stage i+1
                    const sparkT = Math.min(1.0, bridgeProgress * 1.3);
                    const omt = 1 - sparkT;
                    const sx = (omt*omt*omt * fromPt.lastBranchOutX) + (3*omt*omt*sparkT * cX1) + (3*omt*sparkT*sparkT * cX2) + (sparkT*sparkT*sparkT * toPt.rootInX);
                    const sy = (omt*omt*omt * fromPt.lastBranchCenterY) + (3*omt*omt*sparkT * cY1) + (3*omt*sparkT*sparkT * cY2) + (sparkT*sparkT*sparkT * toPt.rootInY);

                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
                    ctx.fill();

                    // Shockwave Ring upon Arrival at Stage i+1 with Smooth Fade-out
                    if (sparkT >= 0.80) {
                        const hitProg = (sparkT - 0.80) / 0.20;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, 1 - hitProg);
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.shadowColor = toPt.stageAccent;
                        ctx.shadowBlur = 18;
                        ctx.lineWidth = Math.max(1, 3 * (1 - hitProg));
                        ctx.beginPath();
                        ctx.arc(toPt.rootInX, toPt.rootInY, hitProg * 38 + 6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }

                } else {
                    // Continuous Vertical Bridge across world space
                    const cX1 = fromPt.lastBranchOutX;
                    const cY1 = fromPt.lastBranchCenterY + Math.round((toPt.rootInY - fromPt.lastBranchCenterY) * 0.5);
                    const cX2 = toPt.rootInX;
                    const cY2 = fromPt.lastBranchCenterY + Math.round((toPt.rootInY - fromPt.lastBranchCenterY) * 0.5);

                    ctx.beginPath();
                    ctx.moveTo(fromPt.lastBranchOutX, fromPt.lastBranchCenterY);
                    ctx.bezierCurveTo(cX1, cY1, cX2, cY2, toPt.rootInX, toPt.rootInY);
                    ctx.stroke();

                    const sparkT = Math.min(1.0, bridgeProgress * 1.3);
                    const omt = 1 - sparkT;
                    const sx = (omt*omt*omt * fromPt.lastBranchOutX) + (3*omt*omt*sparkT * cX1) + (3*omt*sparkT*sparkT * cX2) + (sparkT*sparkT*sparkT * toPt.rootInX);
                    const sy = (omt*omt*omt * fromPt.lastBranchCenterY) + (3*omt*omt*sparkT * cY1) + (3*omt*sparkT*sparkT * cY2) + (sparkT*sparkT*sparkT * toPt.rootInY);

                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
                    ctx.fill();

                    // Shockwave Ring upon Arrival at Stage i+1 with Smooth Fade-out (Vertical)
                    if (sparkT >= 0.80) {
                        const hitProg = (sparkT - 0.80) / 0.20;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, 1 - hitProg);
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.shadowColor = toPt.stageAccent;
                        ctx.shadowBlur = 18;
                        ctx.lineWidth = Math.max(1, 3 * (1 - hitProg));
                        ctx.beginPath();
                        ctx.arc(toPt.rootInX, toPt.rootInY, hitProg * 38 + 6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
                ctx.restore();
            }
        }
    }

    // Restore Camera Translation
    ctx.restore();

    // =========================================================================
    // 5. DRAW FIXED SCREEN OVERLAYS (TOP CAUSAL PROGRESS HUD & VIGNETTE)
    // =========================================================================
    if (totalRoots > 1) {
        const hudH = Math.round(36 * mScale);
        const hudY = Math.round(height * 0.035);
        const totalHudW = Math.min(width * 0.90, totalRoots * 220);
        const hudStartX = Math.round((width - totalHudW) / 2);
        const stepW = totalHudW / totalRoots;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hudStartX, hudY + (hudH / 2));
        ctx.lineTo(hudStartX + totalHudW, hudY + (hudH / 2));
        ctx.stroke();

        const activeHudHeadX = hudStartX + (safeProgress * totalHudW);
        ctx.strokeStyle = activeRootAccent;
        ctx.shadowColor = laserGlow;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(hudStartX, hudY + (hudH / 2));
        ctx.lineTo(activeHudHeadX, hudY + (hudH / 2));
        ctx.stroke();

        rootGroups.forEach((grp, gIdx) => {
            const nodeX = hudStartX + (gIdx * stepW) + (stepW / 2);
            const isDone = gIdx < activeRootIndex;
            const isCurrent = gIdx === activeRootIndex;
            const nodeCol = isCurrent ? activeRootAccent : (isDone ? '#10B981' : '#475569');

            ctx.fillStyle = nodeCol;
            ctx.shadowColor = isCurrent ? laserGlow : 'transparent';
            ctx.shadowBlur = isCurrent ? 14 : 0;
            ctx.beginPath();
            ctx.arc(nodeX, hudY + (hudH / 2), Math.round(5 * mScale), 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `800 ${Math.max(9, Math.round(10 * mScale))}px 'Inter', sans-serif`;
            ctx.fillStyle = isCurrent ? '#FFFFFF' : '#94A3B8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const shortTitle = grp.rootTitle.length > 18 ? grp.rootTitle.slice(0, 16) + '..' : grp.rootTitle;
            ctx.fillText(shortTitle.toUpperCase(), nodeX, hudY + (hudH / 2) - 8);
        });
        ctx.restore();
    }

    drawVignette(ctx, width, height, 0.40);
    ctx.restore();
}

// =========================================================================
// 13. KINETIC STAT COUNTER & COMPARISON METRIC BAR RENDERER
// (High-Contrast Emerald/Financial Visibility & Dynamic Gauge Layout)
// =========================================================================
export function drawCounterFrame(ctx, width, height, progress = 0, options = {}) {
    const headline = options.headline || "GLOBAL CLEAN ENERGY CAPACITY";
    const subtitle = options.subtitle || "INTERNATIONAL ENERGY AGENCY • 1990 - 2024";
    const val1 = Number(options.val1) || 4200;
    const label1 = options.label1 || "2024 Current Capacity";
    const val2 = Number(options.val2) || 850;
    const label2 = options.label2 || "1990 Baseline";
    const prefix = options.prefix || "";
    const suffix = options.suffix || " GW";
    const trendTag = options.trendTag || "+394% SURGE ↗";
    const theme = options.theme || "financial"; // 'financial' | 'cyberMetric' | 'warningRed' | 'slateClean'
    const showGauges = options.showGauges !== false;
    const isVertical = height > width;

    ctx.save();

    // 1. High-Contrast Color Palette Configuration
    let bgGrad, cardBg, cardBorder, bar1Col, bar2Col, neonGlow, textMain, textMuted, trendBg, trendText;
    if (theme === 'cyberMetric') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#0F172A');
        bgGrad.addColorStop(1, '#020617');
        cardBg = 'rgba(15, 23, 42, 0.94)';
        cardBorder = 'rgba(56, 189, 248, 0.50)';
        bar1Col = '#38BDF8';
        bar2Col = '#818CF8';
        neonGlow = '#0284C7';
        textMain = '#FFFFFF';
        textMuted = '#94A3B8';
        trendBg = 'rgba(56, 189, 248, 0.20)';
        trendText = '#38BDF8';
    } else if (theme === 'warningRed') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#450A0A');
        bgGrad.addColorStop(1, '#1A0404');
        cardBg = 'rgba(38, 8, 8, 0.94)';
        cardBorder = 'rgba(239, 68, 68, 0.50)';
        bar1Col = '#EF4444';
        bar2Col = '#F97316';
        neonGlow = '#DC2626';
        textMain = '#FEF2F2';
        textMuted = '#FCA5A5';
        trendBg = 'rgba(239, 68, 68, 0.25)';
        trendText = '#F87171';
    } else if (theme === 'slateClean') {
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#1E293B');
        bgGrad.addColorStop(1, '#0F172A');
        cardBg = 'rgba(15, 23, 42, 0.94)';
        cardBorder = 'rgba(148, 163, 184, 0.40)';
        bar1Col = '#F8FAFC';
        bar2Col = '#64748B';
        neonGlow = '#94A3B8';
        textMain = '#F8FAFC';
        textMuted = '#94A3B8';
        trendBg = 'rgba(255, 255, 255, 0.15)';
        trendText = '#FFFFFF';
    } else {
        // Financial / High-Contrast Obsidian Emerald & Amber Gold (Default)
        bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGrad.addColorStop(0, '#042419');
        bgGrad.addColorStop(0.7, '#021810');
        bgGrad.addColorStop(1, '#010E09');
        cardBg = 'rgba(4, 28, 20, 0.94)';
        cardBorder = 'rgba(52, 211, 153, 0.50)';
        bar1Col = '#10B981'; // Bright Neon Emerald
        bar2Col = '#F59E0B'; // Vivid Warm Amber Gold (100% High Contrast)
        neonGlow = '#34D399';
        textMain = '#FFFFFF';
        textMuted = '#6EE7B7'; // Bright Mint for High Readability
        trendBg = '#FEF3C7';
        trendText = '#92400E';
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    const mScale = Math.min(width, height) / 800;

    // Smooth Spring/Cubic Rollup Progress
    const safeProgress = Math.max(0, Math.min(1.0, isNaN(progress) ? 0 : Number(progress)));
    const rawProgress = Math.min(1.0, Math.max(0, (safeProgress - 0.05) / 0.75));
    const rollProgress = rawProgress < 0.5 
        ? 2 * rawProgress * rawProgress 
        : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

    const currentVal1 = val1 * rollProgress;
    const currentVal2 = val2 * Math.min(1.0, rollProgress * 1.2);

    // Formatting numbers cleanly
    const formattedVal1 = `${prefix}${Math.round(currentVal1).toLocaleString()}${suffix}`;
    const formattedVal2 = `${prefix}${Math.round(currentVal2).toLocaleString()}${suffix}`;

    const cardW = Math.round(width * (isVertical ? 0.90 : 0.76));
    const cardH = Math.round(height * (isVertical ? 0.82 : 0.74));
    const cardX = Math.round((width - cardW) / 2);
    const cardY = Math.round((height - cardH) / 2);

    // Card Container
    ctx.save();
    ctx.fillStyle = cardBg;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 32;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.fill();
    } else {
        ctx.fillRect(cardX, cardY, cardW, cardH);
    }

    ctx.strokeStyle = cardBorder;
    ctx.lineWidth = 1.5;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.stroke();
    } else {
        ctx.strokeRect(cardX, cardY, cardW, cardH);
    }
    ctx.restore();

    let curY = cardY + Math.round(cardH * 0.07);

    // Header Category / Subtitle
    ctx.font = `700 ${Math.max(11, Math.round(12 * mScale))}px 'Inter', sans-serif`;
    ctx.fillStyle = textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(subtitle.toUpperCase(), width / 2, curY);

    curY += Math.round(18 * mScale);

    // Chart Headline
    const headFontSize = Math.max(15, Math.round(20 * mScale));
    ctx.font = `800 ${headFontSize}px 'Inter', sans-serif`;
    ctx.fillStyle = textMain;
    ctx.fillText(headline.toUpperCase(), width / 2, curY);

    curY += headFontSize + Math.round(20 * mScale);

    // Giant Glowing Hero Counter
    const heroFontSize = isVertical ? Math.round(width / 9.5) : Math.round(width / 13);
    ctx.font = `900 ${heroFontSize}px 'Inter', sans-serif`;
    ctx.fillStyle = textMain;
    ctx.shadowColor = neonGlow;
    ctx.shadowBlur = 24;
    ctx.fillText(formattedVal1, width / 2, curY);
    ctx.shadowColor = 'transparent';

    curY += heroFontSize + Math.round(14 * mScale);

    // Trend Pill Badge
    if (trendTag && rollProgress > 0.3) {
        const trendAlpha = Math.min(1.0, (rollProgress - 0.3) / 0.3);
        ctx.save();
        ctx.globalAlpha = trendAlpha;
        const trendFontSize = Math.max(11, Math.round(13 * mScale));
        ctx.font = `800 ${trendFontSize}px 'Inter', sans-serif`;
        const trendW = ctx.measureText(trendTag).width;
        const trendPadX = 12;
        const trendPadY = 4;
        const trendX = (width - trendW - (trendPadX * 2)) / 2;

        ctx.fillStyle = trendBg;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(trendX, curY, trendW + (trendPadX * 2), trendFontSize + (trendPadY * 2), 6);
            ctx.fill();
        } else {
            ctx.fillRect(trendX, curY, trendW + (trendPadX * 2), trendFontSize + (trendPadY * 2));
        }

        ctx.fillStyle = trendText;
        ctx.textBaseline = 'middle';
        ctx.fillText(trendTag, width / 2, curY + (trendFontSize / 2) + trendPadY);
        ctx.restore();

        curY += trendFontSize + (trendPadY * 2) + Math.round(20 * mScale);
    } else {
        curY += Math.round(20 * mScale);
    }

    // Comparative Progress Bars
    if (showGauges) {
        const barW = Math.round(cardW * 0.84);
        const barH = Math.max(12, Math.round(16 * mScale));
        const barX = Math.round((width - barW) / 2);
        const maxVal = Math.max(val1, val2, 1);

        // Metric 1 Bar (Main / Current)
        const fill1W = Math.max(8, Math.round((currentVal1 / maxVal) * barW));
        ctx.fillStyle = textMain;
        ctx.font = `700 ${Math.max(11, Math.round(12 * mScale))}px 'Inter', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label1, barX, curY - 3);
        ctx.textAlign = 'right';
        ctx.fillText(formattedVal1, barX + barW, curY - 3);

        // Track 1
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX, curY, barW, barH, barH / 2);
            ctx.fill();
        } else {
            ctx.fillRect(barX, curY, barW, barH);
        }

        // Fill 1
        ctx.fillStyle = bar1Col;
        ctx.shadowColor = neonGlow;
        ctx.shadowBlur = 12;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX, curY, fill1W, barH, barH / 2);
            ctx.fill();
        } else {
            ctx.fillRect(barX, curY, fill1W, barH);
        }
        ctx.shadowColor = 'transparent';

        curY += barH + Math.round(22 * mScale);

        // Metric 2 Bar (Baseline / Comparison) - Crystal Clear Visibility
        const fill2W = Math.max(8, Math.round((currentVal2 / maxVal) * barW));
        ctx.fillStyle = bar2Col; // Baseline color for label
        ctx.font = `700 ${Math.max(11, Math.round(12 * mScale))}px 'Inter', sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`• ${label2}`, barX, curY - 3);
        ctx.textAlign = 'right';
        ctx.fillText(formattedVal2, barX + barW, curY - 3);

        // Track 2
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX, curY, barW, barH, barH / 2);
            ctx.fill();
        } else {
            ctx.fillRect(barX, curY, barW, barH);
        }

        // Fill 2
        ctx.fillStyle = bar2Col;
        ctx.shadowColor = bar2Col;
        ctx.shadowBlur = 10;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX, curY, fill2W, barH, barH / 2);
            ctx.fill();
        } else {
            ctx.fillRect(barX, curY, fill2W, barH);
        }
        ctx.shadowColor = 'transparent';
    }

    drawVignette(ctx, width, height, 0.40);
    ctx.restore();
}

// =========================================================================
// 13. PAPER CUT-OUT & RIPPED COLLAGE ANIMATOR (VOX & MAGNATESMEDIA STYLE)
// =========================================================================
export function drawPaperCutoutFrame(ctx, a, b, c, d, e) {
    let mediaSource = null;
    let width, height, progress, options;

    if (typeof a === 'number') {
        width = a;
        height = b;
        progress = c || 0;
        options = d || {};
        mediaSource = options.mediaSource || null;
    } else {
        mediaSource = a;
        width = Number(b) || (ctx.canvas ? ctx.canvas.width : 1920);
        height = Number(c) || (ctx.canvas ? ctx.canvas.height : 1080);
        progress = Number(d) || 0;
        options = e || {};
    }

    width = Math.max(10, Number(width) || 1920);
    height = Math.max(10, Number(height) || 1080);
    progress = Math.max(0, Math.min(1, Number(progress) || 0));

    const isVertical = height > width;
    const mScale = Math.min(width, height) / 720;

    const headline = options.headline || options.paperHeadline || "CLASSIFIED DOSSIER LEAKED";
    const snippet = options.snippet || options.paperSnippet || "Confidential investigative reports reveal undisclosed operations and strategic records.";
    const sourceTag = (options.sourceTag || options.paperSourceTag || "NATIONAL ARCHIVES • FILE #741").toUpperCase();
    const dateTag = (options.dateTag || options.paperDateTag || "OCTOBER 1974").toUpperCase();
    const theme = options.theme || options.paperTheme || "vintage"; // 'vintage' | 'noir' | 'neonNote' | 'cardstock'
    const tornStyle = options.tornStyle || options.paperTornStyle || "rippedEdge"; // 'rippedEdge' | 'polaroid' | 'stampTicket'
    const tapeColor = options.tapeColor || options.paperTapeColor || "washiGold"; // 'washiGold' | 'hazardStripe' | 'crimsonRed' | 'clearMatte'
    const jitterEnabled = (options.jitter !== undefined ? options.jitter : options.paperJitter) !== false;
    const highlightKeyword = options.highlightKeyword || options.paperHighlight || "";

    ctx.save();

    // 1. Theme Configuration
    let bgGradient, paperBg, paperBorder, textHeadCol, textBodyCol, metaCol, badgeBg, badgeCol, highlightCol;
    if (theme === 'noir') {
        bgGradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGradient.addColorStop(0, '#18181B');
        bgGradient.addColorStop(1, '#09090B');
        paperBg = '#27272A';
        paperBorder = '#3F3F46';
        textHeadCol = '#FAFAFA';
        textBodyCol = '#D4D4D8';
        metaCol = '#A1A1AA';
        badgeBg = '#E11D48';
        badgeCol = '#FFFFFF';
        highlightCol = 'rgba(244, 63, 94, 0.45)';
    } else if (theme === 'neonNote') {
        bgGradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGradient.addColorStop(0, '#1E293B');
        bgGradient.addColorStop(1, '#0F172A');
        paperBg = '#FEF08A';
        paperBorder = '#FACC15';
        textHeadCol = '#1E293B';
        textBodyCol = '#334155';
        metaCol = '#64748B';
        badgeBg = '#0284C7';
        badgeCol = '#FFFFFF';
        highlightCol = 'rgba(56, 189, 248, 0.45)';
    } else if (theme === 'cardstock') {
        bgGradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGradient.addColorStop(0, '#1E1E24');
        bgGradient.addColorStop(1, '#111113');
        paperBg = '#FFFFFF';
        paperBorder = '#E4E4E7';
        textHeadCol = '#18181B';
        textBodyCol = '#3F3F46';
        metaCol = '#71717A';
        badgeBg = '#18181B';
        badgeCol = '#FAFAFA';
        highlightCol = 'rgba(250, 204, 21, 0.5)';
    } else {
        // Vintage Newsprint Parchment (Default)
        bgGradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.9);
        bgGradient.addColorStop(0, '#1C1917');
        bgGradient.addColorStop(0.6, '#12100E');
        bgGradient.addColorStop(1, '#090807');
        paperBg = '#F6F1E5';
        paperBorder = '#D6CEBE';
        textHeadCol = '#1C1917';
        textBodyCol = '#292524';
        metaCol = '#78716C';
        badgeBg = '#78350F';
        badgeCol = '#FEF3C7';
        highlightCol = 'rgba(245, 179, 1, 0.55)';
    }

    // Outer Background
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle table wooden grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Stop-Motion Organic Paper Jitter (12fps stepped rotation and scale)
    const animProg = Math.min(1.0, progress / 0.15); // Drop in
    const scalePop = 0.92 + (0.08 * Math.sin(animProg * Math.PI / 2));
    
    let jitterAngle = -0.015;
    let jitterX = 0;
    let jitterY = 0;
    if (jitterEnabled) {
        const stepFrame = Math.floor(progress * 18);
        jitterAngle = -0.02 + ((stepFrame % 3 - 1) * 0.008);
        jitterX = (stepFrame % 4 - 2) * 1.5;
        jitterY = ((stepFrame * 7) % 3 - 1) * 1.5;
    }

    // Paper Card Dimensions
    const cardW = Math.round(isVertical ? width * 0.88 : width * 0.65);
    const cardH = Math.round(isVertical ? height * 0.68 : height * 0.72);
    const cardX = Math.round((width - cardW) / 2) + jitterX;
    const cardY = Math.round((height - cardH) / 2) + jitterY;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(jitterAngle);
    ctx.scale(scalePop, scalePop);
    ctx.translate(-width / 2, -height / 2);

    // Deep Realistic Paper Drop Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 12;
    ctx.fillRect(cardX + 4, cardY + 8, cardW - 8, cardH - 12);
    ctx.restore();

    // Draw Ripped / Polaroid Paper Card Body
    ctx.save();
    ctx.fillStyle = paperBg;
    ctx.beginPath();

    if (tornStyle === 'rippedEdge') {
        // Jagged Ripped Top Edge
        ctx.moveTo(cardX, cardY + 6);
        const topSegments = 24;
        for (let i = 1; i <= topSegments; i++) {
            const px = cardX + (i * (cardW / topSegments));
            const py = cardY + ((i % 2 === 0 ? 3 : -3) + (Math.sin(i * 1.7) * 2));
            ctx.lineTo(px, py);
        }
        // Right Edge
        ctx.lineTo(cardX + cardW, cardY + cardH - 6);
        // Jagged Ripped Bottom Edge
        const botSegments = 24;
        for (let i = botSegments; i >= 0; i--) {
            const px = cardX + (i * (cardW / botSegments));
            const py = cardY + cardH + ((i % 2 === 0 ? -4 : 4) + (Math.cos(i * 1.5) * 3));
            ctx.lineTo(px, py);
        }
        // Left Edge
        ctx.lineTo(cardX, cardY + 6);
        ctx.closePath();
    } else {
        // Smooth Polaroid / Ticket Card
        if (ctx.roundRect) {
            ctx.roundRect(cardX, cardY, cardW, cardH, tornStyle === 'polaroid' ? 4 : 8);
        } else {
            ctx.rect(cardX, cardY, cardW, cardH);
        }
    }
    ctx.fill();

    // Paper Outline Border
    ctx.strokeStyle = paperBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Optional Background Media Image / Texture
    let photoH = 0;
    if (mediaSource) {
        const heightRatio = Math.max(0.15, Math.min(0.60, Number(options.imageHeightRatio ?? options.paperImageHeight ?? 0.35)));
        const imgScale = Math.max(0.5, Math.min(3.0, Number(options.imageScale ?? options.paperImageScale ?? 1.0)));
        const imgPanX = Math.max(-1.0, Math.min(1.0, Number(options.imagePanX ?? options.paperImagePanX ?? 0)));
        const imgPanY = Math.max(-1.0, Math.min(1.0, Number(options.imagePanY ?? options.paperImagePanY ?? 0)));
        const imgFit = options.imageFit || options.paperImageFit || 'cover';

        photoH = Math.round(cardH * heightRatio);
        const photoW = cardW - 32;
        const photoX = cardX + 16;
        const photoY = cardY + Math.round(48 * mScale);
        
        ctx.save();
        // Inner clipping path for the photo frame
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(photoX, photoY, photoW, photoH, 4);
        } else {
            ctx.rect(photoX, photoY, photoW, photoH);
        }
        ctx.clip();

        // Dark matte backing
        ctx.fillStyle = '#0F0F12';
        ctx.fillRect(photoX, photoY, photoW, photoH);
        
        try {
            if (imgFit === 'contain') {
                const { width: sW, height: sH } = getSourceDimensions(mediaSource);
                const sAspect = sW / sH;
                const dAspect = photoW / photoH;
                let rW, rH;
                if (sAspect > dAspect) {
                    rW = photoW * imgScale;
                    rH = rW / sAspect;
                } else {
                    rH = photoH * imgScale;
                    rW = rH * sAspect;
                }
                const pX = photoX + (photoW - rW) / 2 + (imgPanX * (photoW - rW) * 0.5);
                const pY = photoY + (photoH - rH) / 2 + (imgPanY * (photoH - rH) * 0.5);
                ctx.drawImage(mediaSource, pX, pY, rW, rH);
            } else {
                drawImageCover(ctx, mediaSource, photoX, photoY, photoW, photoH, imgScale, imgPanX, imgPanY);
            }
        } catch (e) {}

        // Subtle frame stroke
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.5;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(photoX, photoY, photoW, photoH, 4);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Header Meta & Source Badge
    ctx.fillStyle = badgeBg;
    const badgePadX = Math.round(10 * mScale);
    const badgePadY = Math.round(4 * mScale);
    const badgeFont = `800 ${Math.max(10, Math.round(11 * mScale))}px 'Inter', sans-serif`;
    ctx.font = badgeFont;
    const sourceW = ctx.measureText(sourceTag).width;
    
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(cardX + 24, cardY + 16, sourceW + (badgePadX * 2), 20 * mScale, 3);
        ctx.fill();
    } else {
        ctx.fillRect(cardX + 24, cardY + 16, sourceW + (badgePadX * 2), 20 * mScale);
    }

    ctx.fillStyle = badgeCol;
    ctx.textBaseline = 'middle';
    ctx.fillText(sourceTag, cardX + 24 + badgePadX, cardY + 16 + (10 * mScale));

    // Date Tag (Right Aligned)
    ctx.fillStyle = metaCol;
    ctx.font = `700 ${Math.max(10, Math.round(11 * mScale))}px 'Courier New', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(dateTag, cardX + cardW - 24, cardY + 16 + (10 * mScale));
    ctx.textAlign = 'left';

    // Headline (Bold Serif Newspaper Typography)
    const contentStartY = mediaSource ? (cardY + photoH + Math.round(62 * mScale)) : (cardY + Math.round(56 * mScale));
    ctx.fillStyle = textHeadCol;
    const headFontSize = Math.max(16, Math.round((isVertical ? 21 : 24) * mScale));
    ctx.font = `900 ${headFontSize}px 'Georgia', serif`;
    ctx.textBaseline = 'top';

    // Word Wrap Headline
    const maxTextW = cardW - 48;
    const headWords = headline.split(' ');
    let currentLine = '';
    let curY = contentStartY;

    for (const w of headWords) {
        const testLine = currentLine ? `${currentLine} ${w}` : w;
        if (ctx.measureText(testLine).width > maxTextW) {
            ctx.fillText(currentLine, cardX + 24, curY);
            currentLine = w;
            curY += headFontSize * 1.25;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        ctx.fillText(currentLine, cardX + 24, curY);
        curY += headFontSize * 1.35;
    }

    // Divider Line
    ctx.strokeStyle = paperBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 24, curY);
    ctx.lineTo(cardX + cardW - 24, curY);
    ctx.stroke();
    curY += 14;

    // Body Snippet with Animated Yellow / Neon Highlighter
    ctx.fillStyle = textBodyCol;
    const bodyFontSize = Math.max(12, Math.round((isVertical ? 13 : 15) * mScale));
    ctx.font = `500 ${bodyFontSize}px 'Georgia', serif`;

    const bodyWords = snippet.split(' ');
    let bodyLine = '';
    const highlightProg = Math.max(0, Math.min(1.0, (progress - 0.25) / 0.50));

    for (const bw of bodyWords) {
        const testBody = bodyLine ? `${bodyLine} ${bw}` : bw;
        if (ctx.measureText(testBody).width > maxTextW) {
            // Draw Highlight behind line if it contains the keyword
            if (highlightKeyword && bodyLine.toLowerCase().includes(highlightKeyword.toLowerCase()) && highlightProg > 0) {
                const lineW = ctx.measureText(bodyLine).width;
                ctx.save();
                ctx.fillStyle = highlightCol;
                ctx.fillRect(cardX + 24, curY - 1, lineW * highlightProg, bodyFontSize + 4);
                ctx.restore();
            }

            ctx.fillStyle = textBodyCol;
            ctx.fillText(bodyLine, cardX + 24, curY);
            bodyLine = bw;
            curY += bodyFontSize * 1.45;
        } else {
            bodyLine = testBody;
        }
    }
    if (bodyLine) {
        if (highlightKeyword && bodyLine.toLowerCase().includes(highlightKeyword.toLowerCase()) && highlightProg > 0) {
            const lineW = ctx.measureText(bodyLine).width;
            ctx.save();
            ctx.fillStyle = highlightCol;
            ctx.fillRect(cardX + 24, curY - 1, lineW * highlightProg, bodyFontSize + 4);
            ctx.restore();
        }
        ctx.fillStyle = textBodyCol;
        ctx.fillText(bodyLine, cardX + 24, curY);
    }

    ctx.restore(); // Exit card clipping / rotation

    // Realistic Washi Tape Fasteners
    const drawTape = (tx, ty, tAngle, tWidth, tHeight) => {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(tAngle);

        if (tapeColor === 'hazardStripe') {
            ctx.fillStyle = '#EAB308';
            ctx.fillRect(-tWidth / 2, -tHeight / 2, tWidth, tHeight);
            // Black stripes
            ctx.fillStyle = '#000000';
            for (let sx = -tWidth / 2; sx < tWidth / 2; sx += 14) {
                ctx.beginPath();
                ctx.moveTo(sx, -tHeight / 2);
                ctx.lineTo(sx + 8, tHeight / 2);
                ctx.lineTo(sx + 14, tHeight / 2);
                ctx.lineTo(sx + 6, -tHeight / 2);
                ctx.fill();
            }
        } else if (tapeColor === 'crimsonRed') {
            ctx.fillStyle = 'rgba(225, 29, 72, 0.78)';
            ctx.fillRect(-tWidth / 2, -tHeight / 2, tWidth, tHeight);
        } else if (tapeColor === 'clearMatte') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(-tWidth / 2, -tHeight / 2, tWidth, tHeight);
        } else {
            // Washi Gold (Default)
            ctx.fillStyle = 'rgba(245, 179, 1, 0.72)';
            ctx.fillRect(-tWidth / 2, -tHeight / 2, tWidth, tHeight);
        }

        // Tape ragged ends
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-tWidth / 2, -tHeight / 2, tWidth, tHeight);

        ctx.restore();
    };

    // Tape on Top-Left Corner & Top-Right Corner
    drawTape(cardX + 28, cardY - 4, -0.15, 64 * mScale, 20 * mScale);
    drawTape(cardX + cardW - 28, cardY - 4, 0.18, 64 * mScale, 20 * mScale);

    drawVignette(ctx, width, height, 0.35);
    ctx.restore();
}

export function drawTrackingHudFrame(ctx, a, b, c, d, e) {
    let mediaSource = null;
    let width, height, progress, options;

    if (typeof a === 'number') {
        width = a;
        height = b;
        progress = c || 0;
        options = d || {};
        mediaSource = options.mediaSource || null;
    } else {
        mediaSource = a;
        width = Number(b) || (ctx.canvas ? ctx.canvas.width : 1920);
        height = Number(c) || (ctx.canvas ? ctx.canvas.height : 1080);
        progress = Number(d) || 0;
        options = e || {};
    }

    width = Math.max(10, Number(width) || 1920);
    height = Math.max(10, Number(height) || 1080);
    progress = Math.max(0, Math.min(1, Number(progress) || 0));

    const isVertical = height > width;
    const mScale = Math.min(width, height) / 720;

    const targetLabel = options.targetLabel || options.trackingTargetLabel || "[CONFIRMED ID: SUBJECT 09]";
    const category = (options.category || options.trackingCategory || "FACIAL BIOMETRICS • 4K SENSOR").toUpperCase();
    const confidenceVal = Number(options.confidence !== undefined ? options.confidence : options.trackingConfidence) || 99.4;
    const coordinates = options.coordinates || options.trackingCoordinates || "LAT: 37.7749° N | LON: 122.4194° W";
    const theme = options.theme || options.trackingHudTheme || "cyberCyan"; // 'cyberCyan' | 'tacticalAmber' | 'crimsonAlert' | 'matrixEmerald'
    const reticleStyle = options.reticleStyle || options.trackingReticleStyle || "cornerBrackets"; // 'cornerBrackets' | 'circularSniper' | 'fullHud'
    const scanBeam = (options.scanBeam !== undefined ? options.scanBeam : options.trackingScanBeam) !== false;
    const lockAnim = (options.lockAnimation !== undefined ? options.lockAnimation : options.trackingLockAnimation) !== false;

    ctx.save();

    // 1. HUD Color Palette Configuration
    let hudMain, hudGlow, hudBgDim, hudDanger, gridCol;
    if (theme === 'tacticalAmber') {
        hudMain = '#F59E0B';
        hudGlow = 'rgba(245, 158, 11, 0.75)';
        hudBgDim = 'rgba(245, 158, 11, 0.12)';
        hudDanger = '#EF4444';
        gridCol = 'rgba(245, 158, 11, 0.08)';
    } else if (theme === 'crimsonAlert') {
        hudMain = '#EF4444';
        hudGlow = 'rgba(239, 68, 68, 0.85)';
        hudBgDim = 'rgba(239, 68, 68, 0.14)';
        hudDanger = '#F59E0B';
        gridCol = 'rgba(239, 68, 68, 0.08)';
    } else if (theme === 'matrixEmerald') {
        hudMain = '#10B981';
        hudGlow = 'rgba(16, 185, 129, 0.75)';
        hudBgDim = 'rgba(16, 185, 129, 0.12)';
        hudDanger = '#EF4444';
        gridCol = 'rgba(16, 185, 129, 0.08)';
    } else {
        // Cyber Cyan (Default)
        hudMain = '#00E5FF';
        hudGlow = 'rgba(0, 229, 255, 0.8)';
        hudBgDim = 'rgba(0, 229, 255, 0.12)';
        hudDanger = '#F43F5E';
        gridCol = 'rgba(0, 229, 255, 0.08)';
    }

    // Background Canvas / Media
    if (mediaSource) {
        try {
            const { width: srcW, height: srcH } = getSourceDimensions(mediaSource);
            const scale = Math.max(width / srcW, height / srcH);
            const sw = srcW * scale;
            const sh = srcH * scale;
            const sx = (width - sw) / 2;
            const sy = (height - sh) / 2;
            ctx.drawImage(mediaSource, sx, sy, sw, sh);

            // Darkening surveillance tinted veil
            ctx.fillStyle = 'rgba(5, 10, 20, 0.65)';
            ctx.fillRect(0, 0, width, height);
        } catch (e) {
            ctx.fillStyle = '#050B14';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        // Deep Surveillance Grid Background
        const bgGrad = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.85);
        bgGrad.addColorStop(0, '#091522');
        bgGrad.addColorStop(1, '#02060C');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
    }

    // Top-Level Surveillance Grid Mesh
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    const gridStep = Math.round(48 * mScale);
    for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Top Status Header Bar
    ctx.fillStyle = hudMain;
    ctx.font = `800 ${Math.max(10, Math.round(11 * mScale))}px 'Courier New', monospace`;
    ctx.fillText(`● REC [AI SURVEILLANCE FEED]`, 28, 34);
    
    ctx.textAlign = 'right';
    const timeCode = `00:0${Math.floor(progress * 10)}:${Math.floor((progress * 60) % 60).toString().padStart(2, '0')}:24`;
    ctx.fillText(`SYS.LOCK // ${timeCode}`, width - 28, 34);
    ctx.textAlign = 'left';

    // Target Box Placement
    const boxW = Math.round(isVertical ? width * 0.72 : width * 0.42);
    const boxH = Math.round(isVertical ? height * 0.42 : height * 0.52);
    
    // Dynamic Tracking Lock Animation (Zooms from 1.35x down to 1.0x with slight bounce)
    let lockScale = 1.0;
    if (lockAnim) {
        const lockProg = Math.min(1.0, progress / 0.20);
        lockScale = 1.35 - (0.35 * Math.sin(lockProg * Math.PI / 2));
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const curW = boxW * lockScale;
    const curH = boxH * lockScale;
    const left = centerX - (curW / 2);
    const top = centerY - (curH / 2);
    const right = left + curW;
    const bottom = top + curH;

    // Sweeping Radar Scan Laser Line
    if (scanBeam) {
        const scanY = top + (curH * ((progress * 1.6) % 1.0));
        ctx.save();
        const laserGrad = ctx.createLinearGradient(left, scanY, right, scanY);
        laserGrad.addColorStop(0, 'rgba(0,0,0,0)');
        laserGrad.addColorStop(0.5, hudMain);
        laserGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = laserGrad;
        ctx.shadowColor = hudGlow;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(left, scanY);
        ctx.lineTo(right, scanY);
        ctx.stroke();
        ctx.restore();
    }

    // Reticle Center Crosshair
    ctx.save();
    ctx.strokeStyle = hudMain;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = hudGlow;
    ctx.shadowBlur = 10;
    const chSize = 14 * mScale;
    ctx.beginPath();
    ctx.moveTo(centerX - chSize, centerY);
    ctx.lineTo(centerX + chSize, centerY);
    ctx.moveTo(centerX, centerY - chSize);
    ctx.lineTo(centerX, centerY + chSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6 * mScale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4 Corner Brackets (Target Lock-On)
    const bracketLen = Math.round(28 * mScale);
    ctx.save();
    ctx.strokeStyle = hudMain;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = hudGlow;
    ctx.shadowBlur = 14;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(left, top + bracketLen);
    ctx.lineTo(left, top);
    ctx.lineTo(left + bracketLen, top);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(right - bracketLen, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, top + bracketLen);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(right, bottom - bracketLen);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right - bracketLen, bottom);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(left + bracketLen, bottom);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left, bottom - bracketLen);
    ctx.stroke();
    ctx.restore();

    // Circular Sniper Radar Ring (If selected)
    if (reticleStyle === 'circularSniper' || reticleStyle === 'fullHud') {
        ctx.save();
        ctx.strokeStyle = hudBgDim;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, curW * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating dashed lock circle
        ctx.strokeStyle = hudMain;
        ctx.setLineDash([8, 12]);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(progress * Math.PI);
        ctx.beginPath();
        ctx.arc(0, 0, curW * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.restore();
    }

    // Top Identifier Badge on Bounding Box
    ctx.fillStyle = hudMain;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(left, top - 26, 170 * mScale, 22, 2);
        ctx.fill();
    } else {
        ctx.fillRect(left, top - 26, 170 * mScale, 22);
    }

    ctx.fillStyle = '#000000';
    ctx.font = `900 ${Math.max(10, Math.round(11 * mScale))}px 'Courier New', monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`TARGET LOCKED [99.4%]`, left + 8, top - 15);

    // Target Label & Category Underneath Box
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.max(14, Math.round(17 * mScale))}px 'Inter', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(targetLabel, left, bottom + 12);

    ctx.fillStyle = hudMain;
    ctx.font = `700 ${Math.max(10, Math.round(12 * mScale))}px 'Courier New', monospace`;
    ctx.fillText(`CATEGORY // ${category}`, left, bottom + 38);

    // Confidence Level Meter (Live Counting Progression)
    const currentConf = Math.min(confidenceVal, (progress * 1.5) * confidenceVal).toFixed(1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `700 ${Math.max(10, Math.round(11 * mScale))}px 'Courier New', monospace`;
    ctx.fillText(`CONFIDENCE: ${currentConf}%`, left, bottom + 58);

    // Confidence Progress Bar
    const barW = curW;
    const barH = 5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(left, bottom + 74, barW, barH);

    ctx.fillStyle = hudMain;
    ctx.shadowColor = hudGlow;
    ctx.shadowBlur = 10;
    ctx.fillRect(left, bottom + 74, (Number(currentConf) / 100) * barW, barH);
    ctx.shadowColor = 'transparent';

    // Bottom Telemetry Coordinates
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `600 ${Math.max(9, Math.round(11 * mScale))}px 'Courier New', monospace`;
    ctx.fillText(coordinates, left, bottom + 88);

    drawVignette(ctx, width, height, 0.45);
    ctx.restore();
}



