// src/lib/ffmpeg.js
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;

export async function loadFfmpeg() {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    return ffmpeg;
}

export async function extractAudioFromVideo(videoFile) {
    if (!videoFile) return null;
    try {
        const ffmpeg = await loadFfmpeg();
        const inputName = 'temp_input_media.' + (videoFile.name?.split('.').pop() || 'mp4');
        await ffmpeg.writeFile(inputName, new Uint8Array(await videoFile.arrayBuffer()));

        // Extract audio stream to wav
        const exitCode = await ffmpeg.exec([
            '-i', inputName,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '44100',
            '-ac', '2',
            'extracted_audio.wav'
        ]);

        await ffmpeg.deleteFile(inputName);

        if (exitCode === 0) {
            const audioData = await ffmpeg.readFile('extracted_audio.wav');
            await ffmpeg.deleteFile('extracted_audio.wav');
            if (audioData && audioData.length > 100) {
                return new Blob([audioData.buffer], { type: 'audio/wav' });
            }
        }
    } catch (err) {
        console.warn("Audio extraction skipped (file may not have audio stream):", err);
    }
    return null;
}

export async function createVideoFromFrames(frames, audioBlob, fps, optionsOrHighQuality = false, onProgress) {
    const ffmpeg = await loadFfmpeg();

    const isOptionsObj = typeof optionsOrHighQuality === 'object' && optionsOrHighQuality !== null;
    const highQuality = isOptionsObj ? !!optionsOrHighQuality.highQuality : !!optionsOrHighQuality;
    const fastRender = isOptionsObj ? !!optionsOrHighQuality.fastRender : false;

    const hasAudio = !!audioBlob;
    if (hasAudio) {
        await ffmpeg.writeFile('audio.wav', new Uint8Array(await audioBlob.arrayBuffer()));
    }

    const ext = (highQuality && !fastRender) ? 'png' : 'jpg';

    for (let i = 0; i < frames.length; i++) {
        const name = `frame${String(i).padStart(4, '0')}.${ext}`;
        await ffmpeg.writeFile(name, frames[i]);
        if (onProgress) onProgress((i / frames.length) * 50);
    }

    const onFfmpegProgress = ({ progress }) => {
        if (onProgress) onProgress(50 + progress * 50);
    };
    ffmpeg.on('progress', onFfmpegProgress);

    let preset = 'fast';
    let crf = '22';
    if (fastRender) {
        preset = 'ultrafast';
        crf = '24';
    } else if (highQuality) {
        preset = 'medium';
        crf = '18';
    }

    const args = [
        '-framerate', `${fps}`,
        '-i', `frame%04d.${ext}`
    ];

    if (hasAudio) {
        args.push('-i', 'audio.wav');
    }

    args.push(
        '-c:v', 'libx264',
        '-preset', preset,
        '-tune', 'zerolatency',
        '-crf', crf
    );

    if (hasAudio) {
        args.push('-c:a', 'aac', '-shortest');
    }

    args.push(
        '-pix_fmt', 'yuv420p',
        'output.mp4'
    );

    await ffmpeg.exec(args);

    const data = await ffmpeg.readFile('output.mp4');

    // Bellek (RAM) Temizliği
    ffmpeg.off('progress', onFfmpegProgress);
    if (hasAudio) {
        await ffmpeg.deleteFile('audio.wav');
    }
    await ffmpeg.deleteFile('output.mp4');
    for (let i = 0; i < frames.length; i++) {
        const name = `frame${String(i).padStart(4, '0')}.${ext}`;
        await ffmpeg.deleteFile(name);
    }

    return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
}

