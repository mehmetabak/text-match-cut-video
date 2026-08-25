# How We Built a Fast Browser-Based Video Tool

We recently launched **[Animation Maker](https://animationmaker.m0s.space)** on **[Product Hunt](https://www.producthunt.com/products/animation-maker)**—a free web tool for making kinetic typography, text match cuts, and video effects directly inside your browser.

Most animation tools—whether they create rapid text cuts, typewriter animations, document highlighters, or retro VHS effects—run on desktop software or process video on cloud servers.

We wanted to see if we could do this differently: **Can we generate smooth, animated videos directly in the browser with instant previews and no server uploads?**

Running everything on the client side gives users fast feedback and keeps their text and files private on their own device. But getting smooth 30fps and 60fps rendering in a browser tab took a few practical adjustments.

Here is a look at what we ran into and how we built it.

---

## 1. The Main Problem: Browser Memory & Frame Drops

Rendering a video in JavaScript comes down to four steps:
1. Draw each animation frame on an HTML5 `<canvas>`.
2. Extract the frame image data.
3. Pass the frames into FFmpeg running via WebAssembly.
4. Add sound effects and export the final `.mp4` file.

The main challenge is memory. A 10-second video at 30 frames per second has 300 frames. If you create new image objects or large arrays on every frame, the browser's garbage collector has to clean up hundreds of megabytes in the background.

When garbage collection kicks in, the browser stutters for a moment. That causes dropped frames and choppy exports. On mobile browsers (like Safari on iOS or Chrome on Android), memory spikes can easily crash the tab.

To fix this, we structured the render loop to **reuse the same memory buffers** instead of allocating new ones on every frame.

```
┌─────────────────────────────────────────────────────────────┐
│                     Inside the Browser                      │
│                                                             │
│  ┌──────────────────┐   Precalculated  ┌─────────────────┐  │
│  │ Text & Timing    │ ───────────────> │ Canvas Renderer │  │
│  │ Settings         │   Layout Data    │ (Reuses Memory) │  │
│  └──────────────────┘                  └────────┬────────┘  │
│                                                 │           │
│                                           Frame Stream      │
│                                                 ▼           │
│  ┌──────────────────┐   Audio Blob     ┌─────────────────┐  │
│  │ Web Audio        │ ───────────────> │ FFmpeg.wasm     │  │
│  │ (Sound Effects)  │                  │ (Video Encoder) │  │
│  └──────────────────┘                  └────────┬────────┘  │
│                                                 │           │
│                                             Final MP4       │
└─────────────────────────────────────────────────┴───────────┘
```

---

## 2. Text Match Cut: Keeping the Keyword Centered

In a **Text Match Cut**, different sentences flash quickly on the screen, while one shared word stays locked in the middle of the screen.

### The Alignment Calculation
Because each sentence has different words before and after the keyword, simply centering the whole sentence does not work. If sentence A has 2 words before the keyword and sentence B has 7 words, the keyword jumps back and forth.

To keep it steady, we calculate how far the keyword's center is from the start of the line, and shift the whole line by that exact offset:

```javascript
// Calculation to center a specific keyword on screen
function getKeywordPosition(ctx, textBefore, keyword, screenCenterX) {
  const widthBefore = ctx.measureText(textBefore).width;
  const keywordWidth = ctx.measureText(keyword).width;
  
  // Center point of the keyword inside the sentence
  const keywordCenter = widthBefore + (keywordWidth / 2);
  
  // Shift needed to place the keyword in the middle of the screen
  const drawStartX = screenCenterX - keywordCenter;
  
  return {
    startX: drawStartX,
    keywordLeft: screenCenterX - (keywordWidth / 2),
    keywordRight: screenCenterX + (keywordWidth / 2)
  };
}
```

### Why We Stopped Measuring Text on Every Frame
In our first prototype, we measured text widths (`ctx.measureText`), wrapped lines, and calculated font sizes on every single frame of the animation.

Measuring text in the browser is surprisingly slow when called hundreds of times per second. It was taking up most of our render time.

We fixed this by separating the process into two steps:
1. **Before rendering starts:** Calculate line breaks, word widths, and positions **once** for each cut, and store them in memory.
2. **During rendering:** Simply draw the text using the saved positions.

This single change cut text rendering time by over 80% with no difference in visual quality.

---

## 3. Creating Sound Effects in Code (No Large Audio Downloads)

A quick text cut or typewriter effect feels incomplete without synchronized sound. But downloading dozens of `.wav` or `.mp3` files over the network adds loading time and can fail on slow connections.

Instead, we use the browser's built-in **Web Audio API** to generate sound effects directly in code.

For example, a mechanical keyboard click or tape snap is basically a short sound pulse shaped with a filter:

```javascript
// Generating a quick click sound with Web Audio
function makeClickSound(audioContext, startTime) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  // Bandpass filter for a clean, snappy tone
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, startTime);
  filter.Q.setValueAtTime(3.5, startTime);

  // Quick volume drop
  gain.gain.setValueAtTime(0.7, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.04);
}
```

By generating sound effects offline into an audio buffer, the whole soundtrack is created in a few milliseconds and matches the visual cuts down to the millisecond.

---

## 4. Making Video Encoding Fast: Benchmarks & Lessons

Once all frames are drawn on the canvas and audio is generated, they are encoded into an `.mp4` file using FFmpeg running in WebAssembly. Here are three practical things we learned:

### 1. JPEG Frames over PNG
- `canvas.toDataURL('image/png')` or `canvas.convertToBlob({ type: 'image/png' })` produced clean frames, but PNG compression in the browser took ~30–50ms per frame.
- Switching to JPEG encoding (`quality: 0.85`) reduced frame extraction time to **1–2ms per frame** while keeping text sharp.

### 2. Matching Codec Block Sizes
Video encoders like `libx264` work in $16 \times 16$ pixel blocks. Setting export resolutions to standard sizes like $1280 \times 720$ and $720 \times 1280$ uses exact multiples of 16. This avoids extra padding and keeps WebAssembly encoding fast.

### 3. Tuning x264 Flags & Sending Frames in Batches
In WebAssembly:
- Using `-preset ultrafast` with a tuned Constant Rate Factor (`-crf 23`) gives a 4x encoding speedup compared to `-preset medium`, with no noticeable difference on mobile screens.
- Instead of keeping all rendered frames in JavaScript memory before sending them to FFmpeg, streaming them in small batches keeps memory low and prevents mobile tabs from running out of RAM.

---

## 5. What's Next & The Future of Web-Based Tools

Building **[Animation Maker](https://animationmaker.m0s.space)** showed us how capable modern web standards are. By combining simple Canvas 2D drawings, procedural Web Audio, and WebAssembly, it's possible to build video tools that run anywhere without installing apps or uploading files to a server.

As WebGPU and WebCodecs continue to improve across browsers, we can build tools in the browser that used to require desktop software. We are currently working on new blur effects, sound options, and additional animation modes.

- 🚀 Try the tool: **[Animation Maker](https://animationmaker.m0s.space)**
- 💬 Join the conversation on **[Product Hunt](https://www.producthunt.com/products/animation-maker)**
