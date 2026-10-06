// Narration audit on the final video: each chapter narration is cut from the MP4 audio, transcribed by Gemini,
// and compared with the script (word error rate). Only the generated narration is sent, never the environment.
import {readFileSync} from 'node:fs';
import {readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {loadEnv, manifest, outputDir, requireEnv, run} from './lib.mjs';

loadEnv();
const model = process.env.VIDEO_AUDIT_MODEL || 'gemini-3.8-flash';
const MAX_WER = 0.1;
const assembly = JSON.parse(readFileSync(path.join(outputDir, 'assembly.json'), 'utf8'));
const video = path.join(outputDir, `${manifest.slug}.mp4`);

const words = text => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/(\d)\.(\d)/g, '$1 point $2').replace(/[^a-z0-9Ѐ-ӿ一-鿿 ]+/g, ' ').split(/\s+/).filter(Boolean);

function wer(reference, hypothesis) {
    const r = words(reference);
    const h = words(hypothesis);
    const d = Array.from({length: r.length + 1}, (_, i) => [i, ...new Array(h.length).fill(0)]);
    for (let j = 1; j <= h.length; j++) {
        d[0][j] = j;
    }
    for (let i = 1; i <= r.length; i++) {
        for (let j = 1; j <= h.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
        }
    }
    return d[r.length][h.length] / r.length;
}

async function transcribe(file) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY')},
        body: JSON.stringify({
            contents: [{
                parts: [
                    {text: 'Transcribe exactly every audible word of this clip, once, in order, whatever the language. '
                        + 'Write numbers as digits with dots for versions (for example 8.2.1). Do not summarize, do not complete '
                        + 'cut sentences, return only the spoken text without any comment.'},
                    {inlineData: {mimeType: 'audio/wav', data: (await readFile(file)).toString('base64')}}
                ]
            }]
        })
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`Gemini rejected the transcription (${response.status}): ${JSON.stringify(body).slice(0, 300)}`);
    }
    return body.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || '';
}

const report = [];
let failed = false;
for (const cue of assembly.cues) {
    const chapter = manifest.chapters.find(c => c.id === cue.id);
    const clip = path.join(outputDir, `audit-${cue.id}.wav`);
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', (cue.audioStartMs / 1000).toFixed(3), '-t', ((cue.audioMs + 200) / 1000).toFixed(3),
        '-i', video, '-vn', '-ac', '1', '-ar', '16000', clip]);
    const transcript = await transcribe(clip);
    await rm(clip);
    const rate = wer(chapter.narration, transcript);
    const ok = rate <= MAX_WER;
    failed ||= !ok;
    report.push({id: cue.id, wer: Number(rate.toFixed(3)), ok, transcript});
    console.log(`${ok ? '✓' : '✗'} ${cue.id}: WER ${(rate * 100).toFixed(1)}%${ok ? '' : `\n   heard: ${transcript}`}`);
}
await writeFile(path.join(outputDir, 'audit.json'), JSON.stringify({model, maxWer: MAX_WER, auditedAt: new Date().toISOString(), report}, null, 2));
if (failed) {
    process.exitCode = 1;
}
