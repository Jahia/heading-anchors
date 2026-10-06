// Records the demo in Chromium (Playwright). Each chapter is paced on the duration of its narration:
// actions are placed at fractions of the narration with at(), then the scene waits until the narration ends.
// Usage: node tools/record.mjs [--rehearse]   (--rehearse: no narration needed, estimated durations)
import {existsSync, readFileSync} from 'node:fs';
import {readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {ensureDir, manifest, outputDir, sleep, videosDir} from './lib.mjs';
import {configure, DEFAULTS, jahiaUrl, liveUrl, renameHeading, setup} from './setup.mjs';

const rehearse = process.argv.includes('--rehearse');
const GAP_MS = 700;
const {width, height} = manifest.viewport;
const audio = existsSync(path.join(outputDir, 'audio.json')) ? JSON.parse(readFileSync(path.join(outputDir, 'audio.json'), 'utf8')) : {chapters: {}};

function narrationMs(chapter) {
    const measured = audio.chapters[chapter.id]?.durationMs;
    if (measured && !rehearse) {
        return measured;
    }
    if (!rehearse) {
        throw new Error(`No narration for chapter ${chapter.id}: run "npm run tts" first, or use --rehearse`);
    }
    return Math.round(chapter.narration.split(/\s+/).length / 2.6 * 1000);
}

await setup();
const rawDir = await ensureDir(path.join(outputDir, 'raw'));
const browser = await chromium.launch();

// Login in a context that is not recorded, then reuse its session
const loginContext = await browser.newContext({locale: 'en-US'});
const loginPage = await loginContext.newPage();
await loginPage.goto(`${jahiaUrl}/cms/login`);
await loginPage.fill('input[name="username"]', 'root');
await loginPage.fill('input[type="password"]', process.env.SUPER_USER_PASSWORD);
await Promise.all([loginPage.waitForLoadState('networkidle'), loginPage.click('button[type="submit"], input[type="submit"]')]);
const storageState = await loginContext.storageState();
await loginContext.close();

const context = await browser.newContext({
    viewport: {width, height}, deviceScaleFactor: 1, locale: 'en-US', storageState,
    recordVideo: {dir: rawDir, size: {width, height}}
});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: jahiaUrl});
await context.addInitScript({path: path.join(videosDir, 'tools', 'overlay.js')});
const page = await context.newPage();
const t0 = Date.now();
const cues = [];
// Input events (mouse clicks, key presses) for the sound effects added at assembly time
const inputs = [];
const input = type => inputs.push({type, ms: Date.now() - t0});

// --- helpers -------------------------------------------------------------------------------------------------
const demo = (fn, ...args) => page.evaluate(([name, values]) => window.__demo && window.__demo[name](...values), [fn, args]).catch(() => null);

async function pointAt(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await demo('cursorTo', x, y);
    await page.mouse.move(x, y, {steps: 12});
    await sleep(350);
    return {x, y};
}

async function clickOn(locator) {
    await pointAt(locator);
    await demo('press', true);
    input('click');
    await locator.click();
    await sleep(120);
    await demo('press', false);
}

async function typeSlowly(locator, text) {
    await clickOn(locator);
    await locator.fill('');
    for (const character of text) {
        input('key');
        await page.keyboard.type(character);
        await sleep(120);
    }
}

async function press(key) {
    input('key');
    await page.keyboard.press(key);
}

async function scrollToElement(selector, offset = 140) {
    await page.evaluate(([sel, off]) => {
        const element = document.querySelector(sel);
        window.scrollTo({top: element.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth'});
    }, [selector, offset]);
    await sleep(900);
}

let loads = 0;

/** Loads a page, bypassing the browser cache (the URL pill of the overlay only shows the path and the anchor). */
async function goto(url) {
    const [base, hash] = url.split('#');
    const separator = base.includes('?') ? '&' : '?';
    await page.goto(`${jahiaUrl}${base}${separator}demo=${++loads}${hash ? '#' + hash : ''}`, {waitUntil: 'networkidle'});
}

async function adminModuleFrame() {
    await goto('/jahia/administration/manageModules');
    const list = page.frameLocator('iframe[src*="settings.manageModules"]').first();
    return list;
}

async function scene(chapter, actions) {
    const duration = narrationMs(chapter);
    const start = Date.now();
    const at = async fraction => {
        const wait = start + fraction * duration - Date.now();
        if (wait > 0) {
            await sleep(wait);
        }
    };
    await demo('card', chapter.title, 2200);
    await actions(at);
    const remaining = start + duration + GAP_MS - Date.now();
    if (remaining > 0) {
        await sleep(remaining);
    } else {
        console.warn(`! ${chapter.id}: actions overran the narration by ${-remaining} ms`);
    }
    cues.push({id: chapter.id, title: chapter.title, startMs: start - t0, endMs: Date.now() - t0, narrationMs: duration});
    console.log(`✓ ${chapter.id} (${Date.now() - start} ms)`);
}

const chapter = id => manifest.chapters.find(c => c.id === id);
const heading = text => page.locator('[data-heading-anchors], h2, h3').filter({hasText: text}).first();

// --- scenes --------------------------------------------------------------------------------------------------
await goto(liveUrl('en'));

await scene(chapter('problem'), async at => {
    await at(0.15);
    await scrollToElement('h2:nth-of-type(2)', 300);
    await at(0.42);
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'smooth'}));
    await at(0.55);
    await page.evaluate(() => {
        location.hash = 'jahia-lifecycle';
    });
    await pointAt(page.locator('#demo-url'));
});

await scene(chapter('enable'), async at => {
    await goto('/jahia/administration');
    await at(0.15);
    await clickOn(page.getByText('Modules and Extensions', {exact: true}));
    await clickOn(page.getByText('Modules', {exact: true}).first());
    await page.waitForTimeout(1500);
    const list = page.frameLocator('iframe[src*="settings.manageModules"]').first();
    await at(0.4);
    await typeSlowly(list.getByPlaceholder('Search module by keyword'), 'heading');
    await clickOn(list.getByText('Heading Anchors', {exact: true}).first());
    await page.waitForTimeout(1500);
    const detail = page.frameLocator('iframe[src*="manageModules"]').first();
    await at(0.65);
    await clickOn(detail.locator('label[data-sel-role="siteEnabler-digitall"]'));
    await page.waitForTimeout(1500);
    await pointAt(page.frameLocator('iframe[src*="manageModules"]').first().getByText('In use').first()).catch(() => null);
});

await scene(chapter('anchors'), async at => {
    await goto(liveUrl('en'));
    await at(0.2);
    await demo('showIds');
    await at(0.36);
    await goto(`${liveUrl('en')}#jahia-lifecycle`);
    await page.waitForTimeout(800);
    await demo('showIds');
    await at(0.55);
    // The heading stops below the sticky header, measured by the module
    await pointAt(page.locator('.header-v8').first());
    await at(0.7);
    await pointAt(page.locator('#jahia-lifecycle'));
});

await scene(chapter('configure'), async at => {
    await goto('/tools/osgi/console/configMgr');
    await at(0.12);
    await clickOn(page.getByText('Heading anchors', {exact: true}).first());
    await page.waitForTimeout(1000);
    await at(0.4);
    await clickOn(page.locator('input[type="checkbox"][name="permalink.enabled"]'));
    await at(0.58);
    await clickOn(page.locator('.ui-dialog-buttonpane button').filter({hasText: 'Save'}));
    await page.waitForTimeout(2500);
});

await scene(chapter('copy'), async at => {
    await goto(`${liveUrl('en')}#jahia-lifecycle`);
    await page.waitForTimeout(600);
    await at(0.1);
    await pointAt(page.locator('#jahia-lifecycle'));
    await at(0.2);
    await pointAt(page.locator('#jahia-lifecycle > .heading-anchors-permalink'));
    await at(0.36);
    await clickOn(page.locator('#jahia-lifecycle > .heading-anchors-permalink'));
    await at(0.68);
    // Click the paragraph right after the heading: the next Tab goes to the button of the following heading
    await clickOn(page.locator('#jahia-lifecycle + p'));
    await press('Tab');
    await sleep(900);
    await at(0.88);
    await press('Enter');
});

await scene(chapter('languages'), async at => {
    await goto(`${liveUrl('fr')}#cycle-de-vie-de-jahia`);
    await page.waitForTimeout(600);
    await at(0.15);
    await pointAt(page.locator('#cycle-de-vie-de-jahia > .heading-anchors-permalink'));
    await at(0.3);
    await clickOn(page.locator('#cycle-de-vie-de-jahia > .heading-anchors-permalink'));
    await at(0.5);
    await goto(`${liveUrl('en')}#zhiznennyi-cikl`);
    await page.waitForTimeout(600);
    await demo('showIds');
    await at(0.75);
    await pointAt(page.locator('[id="生命周期"]'));
});

await scene(chapter('existing'), async at => {
    await goto(`${liveUrl('en')}#support`);
    await page.waitForTimeout(600);
    await demo('showIds');
    await pointAt(page.locator('#support'));
    await at(0.3);
    await scrollToElement('#faq', 120);
    await demo('showIds');
    await pointAt(page.locator('#faq_1'));
    await at(0.62);
    await scrollToElement('#upgrade-notes_1', 120);
    await demo('showIds');
    await pointAt(page.locator('#upgrade-notes_1'));
});

await scene(chapter('rename'), async at => {
    await goto(`${liveUrl('en')}#release-cadence`);
    await page.waitForTimeout(400);
    await demo('showIds');
    await pointAt(page.locator('#release-cadence'));
    await at(0.1);
    await renameHeading('Release cadence', 'Release schedule');
    await goto(`${liveUrl('en')}#release-schedule`);
    await page.waitForTimeout(400);
    await demo('showIds');
    await pointAt(page.locator('#release-schedule'));
    await at(0.52);
    // The old link has no target anymore: the page opens at the top
    await goto(`${liveUrl('en')}#release-cadence`);
    await pointAt(page.locator('#demo-url'));
    await at(0.7);
    // A fixed id typed by the editor stays stable
    await goto(`${liveUrl('en')}#support`);
    await page.waitForTimeout(400);
    await demo('showIds');
    await pointAt(page.locator('#support'));
});

await scene(chapter('safe'), async at => {
    await goto(`${liveUrl('en')}#jahia-lifecycle`);
    await page.waitForTimeout(500);
    await demo('showIds');
    await at(0.42);
    await goto('/jahia/administration/manageModules');
    await page.waitForTimeout(1200);
    const list = page.frameLocator('iframe[src*="settings.manageModules"]').first();
    await list.getByPlaceholder('Search module by keyword').fill('heading');
    await clickOn(list.getByText('Heading Anchors', {exact: true}).first());
    await page.waitForTimeout(1200);
    const detail = page.frameLocator('iframe[src*="manageModules"]').first();
    await clickOn(detail.locator('label[data-sel-role="siteEnabler-digitall"]'));
    await page.waitForTimeout(600);
    await clickOn(detail.getByRole('button', {name: /disable the module only/i}));
    await page.waitForTimeout(1500);
    await at(0.85);
    await goto(`${liveUrl('en')}#jahia-lifecycle`);
    await demo('showIds');
    const remaining = await page.locator('[data-heading-anchors]').count();
    if (remaining > 0) {
        throw new Error(`The module is still active on the page after disabling it (${remaining} anchors)`);
    }
});

await scene(chapter('wrap-up'), async at => {
    await at(0.05);
    await demo('end', [
        ['h1', 'Heading Anchors'],
        ['p', 'Readable anchors and copy-link buttons for every Jahia page'],
        ['p', 'Jahia 8.2.1+  ·  WCAG 2.2 AA  ·  MIT'],
        ['code', 'store.jahia.com  ·  github.com/Jahia/heading-anchors']
    ]);
});

const video = page.video();
await context.close();
await browser.close();
await configure(DEFAULTS);

const recorded = await video.path();
const capture = path.join(outputDir, rehearse ? 'capture-rehearsal.webm' : 'capture.webm');
await rename(recorded, capture);
for (const file of await readdir(rawDir)) {
    await rm(path.join(rawDir, file));
}
await writeFile(path.join(outputDir, rehearse ? 'timeline-rehearsal.json' : 'timeline.json'), JSON.stringify({capture: path.basename(capture), cues, inputs}, null, 2));
console.log(`Capture: ${capture}`);
