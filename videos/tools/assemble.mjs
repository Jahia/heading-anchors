// Assembly: places each chapter narration at the start of its chapter, mixes and normalizes the audio,
// encodes the MP4 and writes WebVTT captions. Refuses narration that would run into the next chapter.
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chapterAudio, durationMs, manifest, outputDir, run} from './lib.mjs';

const LEAD_MS = 300;
const RATE = 48000;

/** Input sounds synthesized locally: a short mouse click and a lighter key press, with a little random variation. */
function synthesize(type, seed) {
    const random = (() => {
        let x = seed * 9301 + 49297;
        return () => ((x = (x * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    })();
    const length = Math.round(RATE * (type === 'click' ? 0.04 : 0.025));
    const gain = (type === 'click' ? 0.55 : 0.28) * (0.85 + 0.3 * Math.abs(random()));
    const samples = new Float32Array(length);
    let previous = 0;
    for (let i = 0; i < length; i++) {
        const t = i / RATE;
        const noise = random();
        // First difference: a simple high-pass, brighter for keys
        const bright = type === 'click' ? noise : noise - previous;
        previous = noise;
        const tick = bright * Math.exp(-t / (type === 'click' ? 0.004 : 0.0025));
        const thump = type === 'click' ? 0.5 * Math.sin(2 * Math.PI * 170 * t) * Math.exp(-t / 0.012) : 0;
        samples[i] = gain * (tick + thump);
    }
    return samples;
}

function wav(samples) {
    const buffer = Buffer.alloc(44 + samples.length * 2);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples.length * 2, 4);
    buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(RATE, 24);
    buffer.writeUInt32LE(RATE * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples.length * 2, 40);
    samples.forEach((sample, i) => buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2));
    return buffer;
}
const timeline = JSON.parse(readFileSync(path.join(outputDir, 'timeline.json'), 'utf8'));
const capture = path.join(outputDir, timeline.capture);
const output = path.join(outputDir, `${manifest.slug}.mp4`);

const captureMs = await durationMs(capture);
const effects = new Float32Array(Math.ceil(captureMs / 1000 * RATE) + RATE);
for (const [index, event] of (timeline.inputs || []).entries()) {
    const sound = synthesize(event.type, index + 1);
    const offset = Math.round(event.ms / 1000 * RATE);
    sound.forEach((sample, i) => {
        if (offset + i < effects.length) {
            effects[offset + i] += sample;
        }
    });
}
const effectsFile = path.join(outputDir, 'input-effects.wav');
await writeFile(effectsFile, wav(effects));

const inputs = ['-i', capture, '-i', effectsFile];
const filters = [];
const labels = [];
for (const [index, cue] of timeline.cues.entries()) {
    const chapter = manifest.chapters.find(c => c.id === cue.id);
    const file = chapterAudio(chapter);
    const audioMs = await durationMs(file);
    const startMs = cue.startMs + LEAD_MS;
    if (startMs + audioMs > cue.endMs + 100) {
        throw new Error(`Narration of ${cue.id} (${audioMs} ms) runs into the next chapter`);
    }
    inputs.push('-i', file);
    filters.push(`[${index + 2}:a]adelay=${startMs}|${startMs}[a${index}]`);
    labels.push(`[a${index}]`);
    cue.audioStartMs = startMs;
    cue.audioMs = audioMs;
}
labels.push('[1:a]');
filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[mix]`);

await run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'),
    '-map', '0:v', '-map', '[mix]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', output], {maxBuffer: 1 << 24});

// Captions: each chapter narration split into sentences, timed in proportion to their length
const pad = n => String(n).padStart(2, '0');
const stamp = ms => `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${String(ms % 1000).padStart(3, '0')}`;
const lines = ['WEBVTT', ''];
let counter = 1;
for (const cue of timeline.cues) {
    const chapter = manifest.chapters.find(c => c.id === cue.id);
    const sentences = chapter.narration.match(/[^.!?]+[.!?]+/g).map(sentence => sentence.trim());
    const total = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    let at = cue.audioStartMs;
    for (const sentence of sentences) {
        const length = Math.round(cue.audioMs * sentence.length / total);
        lines.push(String(counter++), `${stamp(at)} --> ${stamp(at + length)}`, sentence, '');
        at += length;
    }
}
await writeFile(path.join(outputDir, `${manifest.slug}.vtt`), lines.join('\n'));
await writeFile(path.join(outputDir, `${manifest.slug}.txt`),
    manifest.chapters.map(chapter => `${chapter.title}\n${chapter.narration}\n`).join('\n'));
await writeFile(path.join(outputDir, 'assembly.json'), JSON.stringify(timeline, null, 2));
console.log(`Video: ${output} (${Math.round(await durationMs(output) / 1000)} s)`);
