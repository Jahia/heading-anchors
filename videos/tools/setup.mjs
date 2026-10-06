// Demo data for the recording, on the local test Jahia (tests/ stack with the Digitall site):
// - default module configuration (no permalink button, default scroll margin)
// - module disabled on Digitall, so the video starts from a page without anchors
// - demo page under the Digitall home page, in English and French, published
import {sleep} from './lib.mjs';

export const jahiaUrl = process.env.JAHIA_URL_LOCAL || 'http://localhost:8080';
export const siteKey = 'digitall';
export const pagePath = `/sites/${siteKey}/home/heading-anchors-demo`;
export const liveUrl = lang => `/${lang}${pagePath}.html`;

const PID = 'org.jahia.community.headinganchors';

function auth() {
    if (!process.env.SUPER_USER_PASSWORD) {
        throw new Error('SUPER_USER_PASSWORD is not set: run "source ../tests/set-env.sh" first');
    }
    return 'Basic ' + Buffer.from(`root:${process.env.SUPER_USER_PASSWORD}`).toString('base64');
}

async function graphql(query, variables = {}) {
    const response = await fetch(`${jahiaUrl}/modules/graphql`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: auth(), Origin: jahiaUrl},
        body: JSON.stringify({query, variables})
    });
    const body = await response.json();
    if (body.errors) {
        throw new Error(JSON.stringify(body.errors).slice(0, 400));
    }
    return body.data;
}

export async function provisioning(yaml) {
    const form = new FormData();
    form.append('script', new Blob([yaml], {type: 'application/yaml'}), 'script.yml');
    const response = await fetch(`${jahiaUrl}/modules/api/provisioning`, {method: 'POST', headers: {Authorization: auth()}, body: form});
    if (!response.ok) {
        throw new Error(`Provisioning failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }
}

export async function configure(properties) {
    const lines = Object.entries(properties).map(([key, value]) => `    ${key}: "${value}"`).join('\n');
    await provisioning(`- editConfiguration: "${PID}"\n  properties:\n${lines}\n`);
    // The configuration is applied asynchronously (file install + config admin)
    await sleep(2500);
}

export const DEFAULTS = {
    enabled: 'true', modes: 'live,preview', headings: 'h1,h2,h3,h4,h5', scope: 'main,body', mode: 'heading',
    existingId: 'keep', legacyAnchors: 'keep', 'permalink.enabled': 'false', 'permalink.headings': 'h2,h3,h4,h5',
    'permalink.label': '', 'permalink.copiedMessage': '', 'permalink.fallbackMessage': '', scrollMarginTop: ''
};

export async function setModuleOnSite(enabled) {
    for (const workspace of ['EDIT', 'LIVE']) {
        const data = await graphql(`query($path: String!) { jcr(workspace: ${workspace}) { nodeByPath(path: $path) {
            property(name: "j:installedModules") { values } } } }`, {path: `/sites/${siteKey}`});
        const installed = data.jcr.nodeByPath.property.values;
        if (enabled === installed.includes('heading-anchors')) {
            continue;
        }
        await graphql(`mutation($path: String!) { jcr(workspace: ${workspace}) { mutateNode(pathOrId: $path) {
            mutateProperty(name: "j:installedModules") { ${enabled ? 'addValue' : 'removeValue'}(value: "heading-anchors") } } } }`,
        {path: `/sites/${siteKey}`});
    }
}

const filler = text => `<p>${text}</p>`;
const lorem = 'Jahia releases follow a predictable cadence, so that teams can plan upgrades, test their modules and keep their sites secure. Each release is documented with its new features, its fixes and the modules it updates.';
const loremFr = 'Les versions de Jahia suivent un rythme prévisible, afin que les équipes puissent planifier les mises à jour, tester leurs modules et garder leurs sites sûrs. Chaque version est documentée avec ses nouveautés, ses corrections et les modules mis à jour.';

function content(fr, renames = {}) {
    const t = (en, frText) => (fr ? frText : renames[en] || en);
    const p = () => filler(fr ? loremFr : lorem);
    return [
        `<h2>${t('Getting started', 'Premiers pas')}</h2>`, p(), p(),
        `<h2>${t('Jahia lifecycle', 'Cycle de vie de Jahia')}</h2>`, p(), p(), p(),
        `<h3>${t('Release cadence', 'Rythme des versions')}</h3>`, p(), p(),
        `<h2 id="support">${t('Support and maintenance', 'Support et maintenance')}</h2>`, p(), p(),
        `<h2>FAQ</h2>`, p(), `<h2>FAQ</h2>`, p(),
        `<h2>${t('Upgrade notes', 'Notes de mise à jour')}</h2>`,
        `<p><a id="upgrade-notes"></a>${fr ? loremFr : lorem}</p>`,
        `<h3>Жизненный цикл</h3>`, p(),
        `<h3>生命周期</h3>`, p(), p(), p(), p()
    ].join('');
}

export async function createDemoPage(renames = {}) {
    // Delete in both workspaces: a live copy left behind would block the publication of the new page
    for (const workspace of ['EDIT', 'LIVE']) {
        await graphql(`mutation($path: String!) { jcr(workspace: ${workspace}) { deleteNode(pathOrId: $path) } }`, {path: pagePath})
            .catch(() => null);
    }
    await graphql(`mutation($props: [InputJCRProperty], $children: [InputJCRNode]!) { jcr { addNode(parentPathOrId: "/sites/${siteKey}/home",
        name: "heading-anchors-demo", primaryNodeType: "jnt:page", properties: $props) { addChildrenBatch(nodes: $children) { uuid } } } }`, {
        props: [
            {name: 'jcr:title', value: 'Release guide', language: 'en'},
            {name: 'jcr:title', value: 'Guide des versions', language: 'fr'},
            {name: 'j:templateName', value: 'home'}
        ],
        children: [{
            name: 'area-main', primaryNodeType: 'jnt:contentList', children: [{
                name: 'guide', primaryNodeType: 'jnt:bigText', properties: [
                    {name: 'text', value: content(false, renames), language: 'en'},
                    {name: 'text', value: content(true), language: 'fr'}
                ]
            }]
        }]
    });
    await graphql(`mutation($path: String!) { jcr { mutateNode(pathOrId: $path) {
        publish(languages: ["en", "fr"], publishSubNodes: true, includeSubTree: true) } } }`, {path: pagePath});
    await sleep(3000);
}

/**
 * Renames a heading of the English demo content and publishes it, as an editor would. The page is recreated with the
 * new title: publishing a single changed translation through the API is not picked up reliably.
 */
export async function renameHeading(from, to) {
    await createDemoPage({[from]: to});
    for (let attempt = 0; attempt < 20; attempt++) {
        const html = await (await fetch(`${jahiaUrl}${liveUrl('en')}?t=${Date.now()}`)).text();
        if (html.includes(`>${to}<`)) {
            return;
        }
        await sleep(500);
    }
    throw new Error(`The renamed heading "${to}" is not published`);
}

export async function setup() {
    await configure(DEFAULTS);
    await setModuleOnSite(false);
    await createDemoPage();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    await setup();
    console.log(`Demo ready: ${jahiaUrl}${liveUrl('en')} (module disabled on ${siteKey})`);
}
