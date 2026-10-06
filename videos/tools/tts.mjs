// Narration: one Gemini TTS take per chapter, same voice and style for all of them.
// Audio files are cached: a chapter is regenerated only when its text, voice, style or model changes.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {audioDir, chapterAudio, durationMs, ensureDir, loadEnv, manifest, outputDir, requireEnv, run} from './lib.mjs';

loadEnv();
const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const voice = process.env.GEMINI_TTS_VOICE || manifest.voice;
const dryRun = process.argv.includes('--dry-run');
const only = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

function audioData(body) {
    if (body?.output_audio?.data) {
        return body.output_audio.data;
    }
    const contents = (body?.steps || []).flatMap(step => step?.content || []);
    return contents.filter(content => content?.type === 'audio' && content.data).at(-1)?.data || null;
}

async function synthesize(text) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-goog-api-key': requireEnv('GEMINI_API_KEY')},
        body: JSON.stringify({
            model,
            input: [{
                type: 'user_input',
                content: [{type: 'text', text, annotations: [{type: 'speech_metadata', style: manifest.voiceStyle}]}]
            }],
            response_format: {type: 'audio'},
            generation_config: {speech_config: [{voice}]}
        })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(`Gemini TTS rejected the request (${response.status}): ${JSON.stringify(body)?.slice(0, 300)}`);
    }
    const data = audioData(body);
    if (!data) {
        throw new Error('Gemini TTS returned no audio');
    }
    return Buffer.from(data, 'base64');
}

/** Converts the returned audio to a 48 kHz mono WAV; raw PCM (no container) is read as 24 kHz 16-bit mono. */
async function toWav(raw, target) {
    const tmp = `${target}.raw`;
    await writeFile(tmp, raw);
    try {
        await run('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-ar', '48000', '-ac', '1', target]);
    } catch {
        await run('ffmpeg', ['-y', '-v', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmp, '-ar', '48000', '-ac', '1', target]);
    }
    await rm(tmp);
}

await ensureDir(audioDir);
const metadataFile = path.join(outputDir, 'audio.json');
const metadata = existsSync(metadataFile) ? JSON.parse(readFileSync(metadataFile, 'utf8')) : {chapters: {}};
console.log(`Model ${model}, voice ${voice}${dryRun ? ' (dry run, no API call)' : ''}`);

for (const chapter of manifest.chapters) {
    if (only.length && !only.includes(chapter.id)) {
        continue;
    }
    const hash = createHash('sha256').update(JSON.stringify({text: chapter.narration, voice, style: manifest.voiceStyle, model})).digest('hex');
    const file = chapterAudio(chapter);
    if (metadata.chapters[chapter.id]?.hash === hash && existsSync(file)) {
        console.log(`= ${chapter.id} (cached, ${metadata.chapters[chapter.id].durationMs} ms)`);
        continue;
    }
    if (dryRun) {
        console.log(`would generate ${chapter.id}: ${chapter.narration.split(/\s+/).length} words`);
        continue;
    }
    await toWav(await synthesize(chapter.narration), file);
    metadata.chapters[chapter.id] = {hash, durationMs: await durationMs(file), voice, model};
    await writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`✓ ${chapter.id} (${metadata.chapters[chapter.id].durationMs} ms)`);
}
