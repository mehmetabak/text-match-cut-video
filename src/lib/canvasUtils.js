// src/lib/canvasUtils.js

/**
 * Verilen metni, canvas'ta belirtilen genişliği aşmayacak şekilde satırlara böler.
 * Aşırı uzun kelimeleri (boşluksuz) de akıllıca bölerek canvas dışına taşmasını engeller.
 * @param {CanvasRenderingContext2D} ctx - Canvas context'i.
 * @param {string} text - Bölünecek metin.
 * @param {number} maxWidth - Bir satırın maksimum genişliği.
 * @returns {string[]} Satırlara bölünmüş metin dizisi.
 */
export function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      // Eğer kelimenin tek başına genişliği bile maxWidth'tan büyükse (örneğin aşırı uzun bir kelime)
      if (ctx.measureText(word).width > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Kelimeyi karakter karakter böl
        let charChunk = '';
        for (let c = 0; c < word.length; c++) {
          const testChar = charChunk + word[c];
          if (ctx.measureText(testChar).width <= maxWidth) {
            charChunk = testChar;
          } else {
            lines.push(charChunk);
            charChunk = word[c];
          }
        }
        currentLine = charChunk;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Metnin verilen genişliğe sığması için font boyutunu dinamik olarak hesaplar.
 */
export function getFittedFontSize(ctx, text, maxWidth, initialSize, minSize = 14, fontFamily = 'sans-serif', fontStyle = 'bold') {
  let size = initialSize;
  ctx.font = `${fontStyle} ${size}px ${fontFamily}`;
  let width = ctx.measureText(text).width;

  while (width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${fontStyle} ${size}px ${fontFamily}`;
    width = ctx.measureText(text).width;
  }

  return { fontSize: size, isWrappedNeeded: width > maxWidth };
}