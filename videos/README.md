# Explainer video

Generates the English explainer video of the module (about 3 minutes): narration with Gemini TTS, recording of the
real Jahia UI with Playwright, assembly with ffmpeg. The script is in [`manifest.json`](manifest.json), one entry per
chapter (title and narration).

## Prerequisites

- the end-to-end test stack running, with the Digitall site and the module installed: see
  [`../tests/README.md`](../tests/README.md) (`bash ci.build.sh && bash ci.startup.sh`)
- Node.js 20+, ffmpeg and ffprobe
- `GEMINI_API_KEY` in `videos/.env.video.local` (git-ignored; a link to an existing file works). Optional:
  `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`, `VIDEO_AUDIT_MODEL`
- optional background music: the file named by `music.file` in the manifest (`assets/` is git-ignored: the track
  is not redistributed with the code). Without it, the video has no music

```bash
npm install
source ../tests/set-env.sh   # root password of the test Jahia
```

## Build

```bash
npm run tts         # narration, one take per chapter (cached: only changed chapters are regenerated)
npm run record      # recording, each chapter paced on its narration (npm run record -- --rehearse: no narration needed)
npm run assemble    # MP4, WebVTT captions, transcript
npm run audit       # narration of the final MP4 transcribed by Gemini and compared with the script
```

Outputs are in `output/heading-anchors-overview/` (git-ignored): `heading-anchors-overview.mp4`, `.vtt`, `.txt`.

## How it works

- `tools/setup.mjs` prepares the demo: default configuration, module disabled on Digitall, demo page in English and
  French, published. The recording starts from this state and restores the default configuration at the end.
- `tools/record.mjs` drives Chromium (1280x800). Each chapter places its actions at fractions of the narration
  (`at(0.4)`), then waits for the end of the narration. Mouse clicks and key presses are logged for the sound
  effects. `tools/overlay.js` adds a demo overlay: visible cursor, page address, chapter title, anchor badges.
- `tools/assemble.mjs` places each narration at the start of its chapter (and fails if one would run into the next
  chapter), adds click and key sounds synthesized locally, loops the background music with a crossfade and lowers it
  under the narration (compressor keyed on the voice), normalizes the audio and encodes the MP4.
- The narration never says "Jahia", to avoid a wrong pronunciation by the voice.
