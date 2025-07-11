// src/lib/canvasUtils.js

/**
 * Verilen metni, canvas'ta belirtilen genişliği aşmayacak şekilde satırlara böler.
 * @param {CanvasRenderingContext2D} ctx - Canvas context'i.
 * @param {string} text - Bölünecek metin.
 * @param {number} maxWidth - Bir satırın maksimum genişliği.
 * @returns {string[]} Satırlara bölünmüş metin dizisi.
 */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}