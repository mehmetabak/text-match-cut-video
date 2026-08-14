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