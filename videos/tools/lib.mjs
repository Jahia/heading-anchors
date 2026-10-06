// Shared helpers of the video pipeline: paths, environment, manifest, audio durations.
import {execFile} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

export const run = promisify(execFile);

export const videosDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifest = JSON.parse(readFileSync(path.join(videosDir, 'manifest.json'), 'utf8'));
export const outputDir = path.join(videosDir, 'output', manifest.slug);
export const audioDir = path.join(outputDir, 'audio');

/**
 * Loads KEY=VALUE pairs of videos/.env.video.local (a git-ignored link to the shared file holding GEMINI_API_KEY)
 * into process.env, without overriding variables already set. Values are never printed.
 */
export function loadEnv() {
    const file = path.join(videosDir, '.env.video.local');
    if (!existsSync(file)) {
        return;
    }
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }
}

export function requireEnv(name) {
    if (!process.env[name]) {
        throw new Error(`${name} is not set (expected in videos/.env.video.local)`);
    }
    return process.env[name];
}

export async function ensureDir(dir) {
    await mkdir(dir, {recursive: true});
    return dir;
}

export async function durationMs(file) {
    const {stdout} = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    return Math.round(parseFloat(stdout.trim()) * 1000);
}

export function chapterAudio(chapter) {
    return path.join(audioDir, `${chapter.id}.wav`);
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
