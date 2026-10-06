import {addNode, deleteNode} from '@jahia/cypress';

describe('Heading anchors', () => {
    const PID = 'org.jahia.community.headinganchors';
    const siteKey = 'digitall';
    const pageName = 'heading-anchors-test';
    const pagePath = `/sites/${siteKey}/home/${pageName}`;
    const previewUrl = `/cms/render/default/en${pagePath}.html`;

    const DEFAULTS: Record<string, string> = {
        enabled: 'true',
        sites: '',
        modes: 'live,preview',
        headings: 'h1,h2,h3,h4,h5',
        scope: 'main,body',
        mode: 'heading',
        'anchor.class': 'heading-anchor',
        'anchor.name': 'false',
        'permalink.enabled': 'false',
        scrollMarginTop: ''
    };

    const CONTENT = [
        '<div class="ha-test">',
        '<h2>Jahia lifecycle</h2><p>Lifecycle text</p>',
        '<h3>Évolution du produit</h3><p>Product text</p>',
        '<h2>Overview</h2><h2>Overview</h2>',
        '<h2 id="custom-id">Custom heading</h2>',
        '<h6>Small heading</h6>',
        '<p style="height: 2000px">Filler</p>',
        '<h2>Bottom section</h2>',
        // Room below the last heading so that the page can scroll it to the top
        '<p style="height: 2000px">Filler</p>',
        '</div>'
    ].join('');

    // Builds a YAML scalar safe for any config value
    const yamlValue = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    const configure = (overrides: Record<string, string>) => {
        const properties = {...DEFAULTS, ...overrides};
        const lines = Object.keys(properties).map(key => `    ${key}: ${yamlValue(properties[key])}`);
        cy.runProvisioningScript({
            script: {
                fileContent: `- editConfiguration: "${PID}"\n  properties:\n${lines.join('\n')}\n`,
                type: 'application/yaml'
            }
        });
    };

    const fetchPage = () => cy.request({url: previewUrl}).its('body');

    // The configuration is applied asynchronously (file install + config admin), wait for its effect
    const waitForPage = (predicate: (html: string) => boolean) => {
        cy.waitUntil(() => cy.request({url: previewUrl}).then(response => predicate(response.body)), {
            timeout: 30000,
            interval: 1000,
            errorMsg: 'Configuration change not applied on the rendered page'
        });
    };

    // The clipboard API only exists in secure contexts (not on http://jahia:8080), so it is always replaced
    const stubClipboard = (win: Cypress.AUTWindow, writeText: sinon.SinonStub) => {
        Object.defineProperty(win.navigator, 'clipboard', {value: {writeText}, configurable: true});
    };

    const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

    const headingsOf = (html: string) => Array.from(parse(html).querySelectorAll('.ha-test h2, .ha-test h3, .ha-test h6'))
        .map(element => ({tag: element.tagName.toLowerCase(), id: element.getAttribute('id'), text: element.textContent}));

    before(() => {
        cy.login();
        deleteNode(pagePath);
        addNode({
            parentPathOrId: `/sites/${siteKey}/home`,
            name: pageName,
            primaryNodeType: 'jnt:page',
            properties: [
                {name: 'jcr:title', value: 'Heading anchors test', language: 'en'},
                {name: 'j:templateName', value: 'home'}
            ],
            children: [{
                name: 'area-main',
                primaryNodeType: 'jnt:contentList',
                children: [{
                    name: 'headings',
                    primaryNodeType: 'jnt:bigText',
                    properties: [{name: 'text', value: CONTENT, language: 'en'}]
                }]
            }]
        }).its('data.jcr.addNode.uuid').should('exist');
    });

    beforeEach(() => {
        cy.login();
    });

    after(() => {
        cy.login();
        configure({});
        deleteNode(pagePath);
    });

    it('adds slug ids to headings with the default configuration', () => {
        configure({});
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            expect(headingsOf(html)).to.deep.equal([
                {tag: 'h2', id: 'jahia-lifecycle', text: 'Jahia lifecycle'},
                {tag: 'h3', id: 'evolution-du-produit', text: 'Évolution du produit'},
                {tag: 'h2', id: 'overview', text: 'Overview'},
                {tag: 'h2', id: 'overview_1', text: 'Overview'},
                {tag: 'h2', id: 'custom-id', text: 'Custom heading'},
                {tag: 'h6', id: null, text: 'Small heading'},
                {tag: 'h2', id: 'bottom-section', text: 'Bottom section'}
            ]);
            const doc = parse(html);
            expect(doc.querySelector('link[href$="/modules/heading-anchors/css/heading-anchors.css"]')).to.not.equal(null);
            expect(doc.querySelector('.heading-permalink')).to.equal(null);
            expect(doc.querySelector('script[src$="/modules/heading-anchors/javascript/heading-anchors.js"]')).to.equal(null);
        });
    });

    it('scrolls to the heading below the configured margin when the URL has a fragment', () => {
        configure({scrollMarginTop: '120px'});
        waitForPage(html => html.includes('--heading-anchors-scroll-margin:120px'));
        cy.visit(`${previewUrl}#bottom-section`);
        cy.get('#bottom-section').should('have.css', 'scroll-margin-top', '120px');
        cy.get('#bottom-section').then($heading => {
            const top = $heading[0].getBoundingClientRect().top;
            expect(top).to.be.within(110, 130);
        });
    });

    it('only processes the configured heading levels', () => {
        configure({headings: 'h3'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            const ids = headingsOf(html).map(heading => heading.id);
            expect(ids).to.deep.equal([null, 'evolution-du-produit', null, null, 'custom-id', null, null]);
        });
    });

    it('uses the first scope selector matching the page', () => {
        configure({scope: '.does-not-exist,div.ha-test'});
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            // Headings outside the test content are not in the scope anymore
            const outside = Array.from(parse(html).querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id]'))
                .filter(element => !element.closest('.ha-test'));
            expect(outside).to.have.length(0);
        });
    });

    it('does nothing when no scope selector matches', () => {
        configure({scope: '#does-not-exist'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            expect(html).to.not.contain('/modules/heading-anchors/css/heading-anchors.css');
        });
    });

    it('inserts an empty anchor in anchor mode', () => {
        configure({mode: 'anchor', 'anchor.name': 'true'});
        waitForPage(html => html.includes('class="heading-anchor"'));
        fetchPage().then(html => {
            const doc = parse(html);
            const heading = doc.querySelector('.ha-test h2');
            expect(heading.getAttribute('id')).to.equal(null);
            const anchor = heading.firstElementChild;
            expect(anchor.tagName.toLowerCase()).to.equal('a');
            expect(anchor.getAttribute('id')).to.equal('jahia-lifecycle');
            expect(anchor.getAttribute('name')).to.equal('jahia-lifecycle');
            expect(anchor.textContent).to.equal('');
            // The heading already having an id gets an extra anchor, its own id is kept
            expect(doc.querySelector('#custom-id a.heading-anchor').getAttribute('id')).to.equal('custom-heading');
        });
    });

    it('is disabled on sites that are not configured', () => {
        configure({sites: 'another-site'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
    });

    it('is disabled in render modes that are not configured', () => {
        configure({modes: 'live'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
    });

    it('can be disabled', () => {
        configure({enabled: 'false'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
    });

    describe('Permalink button', () => {
        beforeEach(() => {
            configure({'permalink.enabled': 'true'});
            waitForPage(html => html.includes('heading-permalink'));
        });

        it('renders an accessible button after each heading', () => {
            fetchPage().then(html => {
                const doc = parse(html);
                const wrapper = doc.querySelector('#jahia-lifecycle').parentElement;
                expect(wrapper.classList.contains('heading-anchors-wrap')).to.equal(true);
                const button = wrapper.querySelector('button.heading-permalink');
                expect(button.getAttribute('type')).to.equal('button');
                expect(button.getAttribute('data-target')).to.equal('jahia-lifecycle');
                expect(button.getAttribute('aria-label')).to.equal('Copy link to section: Jahia lifecycle');
                expect(button.querySelector('[aria-hidden="true"]').textContent).to.equal('#');
                // The button is not part of the heading
                expect(doc.querySelector('#jahia-lifecycle button')).to.equal(null);
                const status = doc.querySelector('#heading-anchors-status');
                expect(status.getAttribute('role')).to.equal('status');
                expect(doc.querySelectorAll('#heading-anchors-status')).to.have.length(1);
            });
        });

        it('copies the section URL and announces it', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().as('writeText').resolves());
                }
            });
            cy.get('#jahia-lifecycle + .heading-permalink').click();
            cy.get('@writeText').should('have.been.calledOnceWith', `${Cypress.config('baseUrl')}${previewUrl}#jahia-lifecycle`);
            cy.get('#heading-anchors-status').should('have.text', 'Link copied to clipboard');
        });

        it('puts the URL in the address bar when the clipboard is not available', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().rejects(new Error('denied')));
                }
            });
            cy.get('#evolution-du-produit + .heading-permalink').click();
            cy.location('hash').should('eq', '#evolution-du-produit');
            cy.get('#heading-anchors-status').should('have.text', 'Link is in the address bar');
        });

        it('is reachable with the keyboard and visible when focused', () => {
            cy.visit(previewUrl);
            cy.get('#jahia-lifecycle + .heading-permalink').should('have.css', 'opacity', '0');
            cy.get('#jahia-lifecycle + .heading-permalink').focus();
            cy.get('#jahia-lifecycle + .heading-permalink').should('have.focus').and('have.css', 'opacity', '1');
        });
    });
});
