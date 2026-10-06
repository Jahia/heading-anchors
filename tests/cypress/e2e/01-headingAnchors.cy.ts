import {addNode, deleteNode, disableModule, enableModule, publishAndWaitJobEnding} from '@jahia/cypress';

describe('Heading anchors', () => {
    const PID = 'org.jahia.community.headinganchors';
    const moduleId = 'heading-anchors';
    const siteKey = 'digitall';
    const pageName = 'heading-anchors-test';
    const pagePath = `/sites/${siteKey}/home/${pageName}`;
    const previewUrl = `/cms/render/default/en${pagePath}.html`;
    const previewUrlFr = `/cms/render/default/fr${pagePath}.html`;
    const liveUrl = `/cms/render/live/en${pagePath}.html`;
    // Pinned: the audit result must not change without a deliberate upgrade
    const AXE_URL = 'https://cdn.jsdelivr.net/npm/axe-core@4.14.0/axe.min.js';
    const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

    const DEFAULTS: Record<string, string> = {
        enabled: 'true',
        modes: 'live,preview',
        headings: 'h1,h2,h3,h4,h5',
        scope: 'main,body',
        mode: 'heading',
        existingId: 'keep',
        legacyAnchors: 'keep',
        'anchor.class': 'heading-anchors-target',
        'anchor.name': 'false',
        'permalink.enabled': 'false',
        'permalink.headings': 'h2,h3,h4,h5',
        'permalink.label': '',
        'permalink.copiedMessage': '',
        'permalink.fallbackMessage': '',
        scrollMarginTop: ''
    };

    const CONTENT = [
        '<div class="ha-test">',
        '<h2>Jahia lifecycle</h2><p>Lifecycle text</p>',
        '<h3>Évolution du produit</h3><p>Product text</p>',
        '<h2>Overview</h2><h2>Overview</h2>',
        '<h2 id="custom-id">Custom heading</h2>',
        '<h2 id="faq">FAQ</h2><h2 id="faq">FAQ</h2>',
        // Manual anchor typed in the text below a heading, as on academy
        '<h2>Legacy section</h2><p><a id="legacy-section"></a>Legacy text</p>',
        '<h3>Жизненный цикл</h3>',
        '<h3>生命周期</h3>',
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

    const fetchPage = (url = previewUrl) => cy.request({url}).its('body');

    // The configuration is applied asynchronously (file install + config admin), wait for its effect
    const waitForPage = (predicate: (html: string) => boolean, url = previewUrl) => {
        cy.waitUntil(() => cy.request({url}).then(response => predicate(response.body)), {
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

    const permalinkOf = (id: string) => `[data-heading-anchors]#${id} > .heading-anchors-permalink`;

    before(() => {
        cy.login();
        enableModule(moduleId, siteKey);
        deleteNode(pagePath);
        addNode({
            parentPathOrId: `/sites/${siteKey}/home`,
            name: pageName,
            primaryNodeType: 'jnt:page',
            properties: [
                {name: 'jcr:title', value: 'Heading anchors test', language: 'en'},
                {name: 'jcr:title', value: 'Test des ancres', language: 'fr'},
                {name: 'j:templateName', value: 'home'}
            ],
            children: [{
                name: 'area-main',
                primaryNodeType: 'jnt:contentList',
                children: [{
                    name: 'headings',
                    primaryNodeType: 'jnt:bigText',
                    properties: [
                        {name: 'text', value: CONTENT, language: 'en'},
                        {name: 'text', value: CONTENT, language: 'fr'}
                    ]
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
        deleteNode(pagePath, 'LIVE');
    });

    it('adds valid and unique ids to headings with the default configuration', () => {
        configure({});
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            expect(headingsOf(html)).to.deep.equal([
                {tag: 'h2', id: 'jahia-lifecycle', text: 'Jahia lifecycle'},
                {tag: 'h3', id: 'evolution-du-produit', text: 'Évolution du produit'},
                {tag: 'h2', id: 'overview', text: 'Overview'},
                {tag: 'h2', id: 'overview_1', text: 'Overview'},
                {tag: 'h2', id: 'custom-id', text: 'Custom heading'},
                {tag: 'h2', id: 'faq', text: 'FAQ'},
                {tag: 'h2', id: 'faq', text: 'FAQ'},
                {tag: 'h2', id: 'legacy-section_1', text: 'Legacy section'},
                {tag: 'h3', id: 'zhiznennyi-cikl', text: 'Жизненный цикл'},
                {tag: 'h3', id: '生命周期', text: '生命周期'},
                {tag: 'h6', id: null, text: 'Small heading'},
                {tag: 'h2', id: 'bottom-section', text: 'Bottom section'}
            ]);
            const doc = parse(html);
            // A manually typed id is kept, without extra anchor
            expect(doc.querySelector('#custom-id').hasAttribute('data-heading-anchors')).to.equal(true);
            expect(doc.querySelector('#custom-id a')).to.equal(null);
            // A duplicated id cannot be reached: the second heading gets its own unique anchor
            const faqHeadings = doc.querySelectorAll('.ha-test h2[id="faq"]');
            expect(faqHeadings[0].querySelector('a')).to.equal(null);
            expect(faqHeadings[1].querySelector('a.heading-anchors-target').getAttribute('id')).to.equal('faq_1');
            // A manual anchor below a heading is kept by default (legacyAnchors=keep)
            expect(doc.querySelector('a#legacy-section').closest('p').textContent).to.equal('Legacy text');
            // Every id of the page is unique and valid (not empty, no ASCII whitespace)
            const anchorIds = Array.from(doc.querySelectorAll('[data-heading-anchors]'))
                .map(element => element.getAttribute('id'))
                .filter(id => id !== 'faq');
            expect(new Set(anchorIds).size).to.equal(anchorIds.length);
            anchorIds.forEach(id => expect(id).to.match(/^[^\t\n\f\r ]+$/));
            expect(doc.querySelector('link[href$="/modules/heading-anchors/css/heading-anchors.css"]')).to.not.equal(null);
            expect(doc.querySelector('.heading-anchors-permalink')).to.equal(null);
            expect(doc.querySelector('script[src$="/modules/heading-anchors/javascript/heading-anchors.js"]')).to.equal(null);
        });
    });

    it('adds the slug next to a different existing id when configured', () => {
        configure({existingId: 'anchor'});
        waitForPage(html => html.includes('id="custom-heading"'));
        fetchPage().then(html => {
            const anchor = parse(html).querySelector('#custom-id > a.heading-anchors-target:first-child');
            expect(anchor.getAttribute('id')).to.equal('custom-heading');
            expect(anchor.hasAttribute('data-heading-anchors')).to.equal(true);
            expect(anchor.textContent).to.equal('');
        });
    });

    it('lets the heading adopt a manual anchor of its section when configured', () => {
        configure({legacyAnchors: 'adopt'});
        waitForPage(html => html.includes('id="legacy-section"') && !html.includes('legacy-section_1'));
        fetchPage().then(html => {
            const doc = parse(html);
            expect(doc.querySelector('#legacy-section').tagName.toLowerCase()).to.equal('h2');
            // The manual anchor lost its id, so links to #legacy-section now reach the heading
            expect(doc.querySelectorAll('[id="legacy-section"]')).to.have.length(1);
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
            expect(ids).to.deep.equal([
                null,
                'evolution-du-produit',
                null,
                null,
                'custom-id',
                'faq',
                'faq',
                null,
                'zhiznennyi-cikl',
                '生命周期',
                null,
                null
            ]);
        });
    });

    it('uses the first scope selector matching the page', () => {
        configure({scope: '.does-not-exist,div.ha-test'});
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            // Headings outside the test content are not in the scope anymore
            const outside = Array.from(parse(html).querySelectorAll('[data-heading-anchors]'))
                .filter(element => !element.closest('.ha-test'));
            expect(outside).to.have.length(0);
        });
    });

    it('does nothing when no scope selector matches', () => {
        configure({scope: '#does-not-exist'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
        fetchPage().then(html => {
            expect(html).to.not.contain('/modules/heading-anchors/css/heading-anchors.css');
            expect(html).to.not.contain('data-heading-anchors');
        });
    });

    it('inserts an empty anchor in anchor mode', () => {
        configure({mode: 'anchor', 'anchor.name': 'true'});
        waitForPage(html => html.includes('class="heading-anchors-target"'));
        fetchPage().then(html => {
            const doc = parse(html);
            const heading = doc.querySelector('.ha-test h2');
            expect(heading.getAttribute('id')).to.equal(null);
            const anchor = heading.firstElementChild;
            expect(anchor.tagName.toLowerCase()).to.equal('a');
            expect(anchor.getAttribute('id')).to.equal('jahia-lifecycle');
            expect(anchor.getAttribute('name')).to.equal('jahia-lifecycle');
            expect(anchor.textContent).to.equal('');
            expect(doc.querySelector('#custom-id a.heading-anchors-target').getAttribute('id')).to.equal('custom-heading');
        });
    });

    it('only applies on sites where the module is enabled', () => {
        configure({});
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
        disableModule(moduleId, siteKey);
        waitForPage(html => !html.includes('id="jahia-lifecycle"') && !html.includes('heading-anchors.css'));
        enableModule(moduleId, siteKey);
        waitForPage(html => html.includes('id="jahia-lifecycle"'));
    });

    it('is disabled in render modes that are not configured', () => {
        configure({modes: 'live'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
    });

    it('can be disabled', () => {
        configure({enabled: 'false'});
        waitForPage(html => !html.includes('id="jahia-lifecycle"'));
    });

    it('works in live mode', () => {
        configure({'permalink.enabled': 'true'});
        publishAndWaitJobEnding(pagePath, ['en', 'fr']);
        cy.logout();
        waitForPage(html => html.includes('id="jahia-lifecycle"') && html.includes('heading-anchors-permalink'), liveUrl);
    });

    describe('Permalink button', () => {
        beforeEach(() => {
            configure({'permalink.enabled': 'true'});
            waitForPage(html => html.includes('heading-anchors-permalink'));
        });

        it('renders an accessible button as last child of each heading', () => {
            fetchPage().then(html => {
                const doc = parse(html);
                const heading = doc.querySelector('#jahia-lifecycle');
                const button = heading.lastElementChild;
                expect(button.tagName.toLowerCase()).to.equal('button');
                expect(button.classList.contains('heading-anchors-permalink')).to.equal(true);
                expect(button.getAttribute('type')).to.equal('button');
                expect(button.getAttribute('data-target')).to.equal('jahia-lifecycle');
                expect(button.getAttribute('aria-label')).to.equal('Copy link');
                // Empty button: the heading text read by table of contents scripts is unchanged
                expect(button.textContent).to.equal('');
                expect(heading.textContent).to.equal('Jahia lifecycle');
                // No wrapper: the page structure is unchanged
                expect(doc.querySelector('.heading-anchors-wrap')).to.equal(null);
                // A manually typed id is used by the permalink
                expect(doc.querySelector('#custom-id > button').getAttribute('data-target')).to.equal('custom-id');
                // Only the configured levels get a button (h6 is not processed at all)
                expect(doc.querySelector('.ha-test h6 button')).to.equal(null);
                const status = doc.querySelector('#heading-anchors-status');
                expect(status.getAttribute('role')).to.equal('status');
                expect(doc.querySelectorAll('#heading-anchors-status')).to.have.length(1);
            });
        });

        it('does not change the layout of the page', () => {
            const rectsOf = (doc: Document) => Array.from(doc.querySelectorAll('.ha-test h2, .ha-test h3'))
                .map(element => {
                    const rect = element.getBoundingClientRect();
                    return [Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)].join(',');
                });
            cy.visit(previewUrl);
            cy.document().then(doc => {
                const withButtons = rectsOf(doc);
                configure({'permalink.enabled': 'false'});
                waitForPage(html => !html.includes('heading-anchors-permalink'));
                cy.visit(previewUrl);
                cy.document().then(plainDoc => {
                    expect(rectsOf(plainDoc)).to.deep.equal(withButtons);
                });
            });
        });

        it('shows the label as a tooltip, dismissible with Escape (WCAG 1.4.13, 2.5.3)', () => {
            cy.visit(previewUrl);
            cy.get(permalinkOf('jahia-lifecycle')).focus();
            cy.get(permalinkOf('jahia-lifecycle')).then($button => {
                const win = $button[0].ownerDocument.defaultView;
                expect(win.getComputedStyle($button[0], '::before').content).to.contain('#');
                expect(win.getComputedStyle($button[0], '::after').display).to.equal('block');
                expect(win.getComputedStyle($button[0], '::after').content).to.contain('Copy link');
            });
            cy.get('body').type('{esc}');
            cy.get(permalinkOf('jahia-lifecycle')).should('have.class', 'is-dismissed').then($button => {
                expect($button[0].ownerDocument.defaultView.getComputedStyle($button[0], '::after').display).to.equal('none');
            });
        });

        it('uses the language of the page (WCAG 3.1.2)', () => {
            fetchPage(previewUrlFr).then(html => {
                const doc = parse(html);
                expect(doc.querySelector('#jahia-lifecycle > button').getAttribute('aria-label')).to.equal('Copier le lien');
                const status = doc.querySelector('#heading-anchors-status');
                expect(status.getAttribute('data-copied-message')).to.equal('Lien copié dans le presse-papiers');
                expect(status.getAttribute('data-fallback-message')).to.equal('Le lien est dans la barre d\'adresse');
            });
        });

        it('copies the section URL and shows a toast', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().as('writeText').resolves());
                }
            });
            cy.get(permalinkOf('jahia-lifecycle')).click();
            cy.get('@writeText').should('have.been.calledOnceWith', `${Cypress.config('baseUrl')}${previewUrl}#jahia-lifecycle`);
            cy.get('#heading-anchors-status').should('have.text', 'Link copied to clipboard');
            // Visible toast, which never blocks clicks and disappears by itself
            cy.get('#heading-anchors-status')
                .should('have.class', 'is-visible')
                .and('have.css', 'opacity', '1')
                .and('have.css', 'position', 'fixed')
                .and('have.css', 'pointer-events', 'none');
            cy.get('#heading-anchors-status', {timeout: 8000}).should('not.have.class', 'is-visible');
            cy.get('#heading-anchors-status').should('have.text', '');
        });

        it('copies the encoded URL of a non-Latin anchor', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().as('writeText').resolves());
                }
            });
            cy.get(permalinkOf('生命周期')).click();
            cy.get('@writeText').should('have.been.calledOnceWith',
                `${Cypress.config('baseUrl')}${previewUrl}#${encodeURIComponent('生命周期')}`);
        });

        it('puts the URL in the address bar when the clipboard is not available', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().rejects(new Error('denied')));
                }
            });
            cy.get(permalinkOf('evolution-du-produit')).click();
            cy.location('hash').should('eq', '#evolution-du-produit');
            cy.get('#heading-anchors-status').should('have.text', 'Link is in the address bar');
        });

        it('is reachable with the keyboard and visible when focused (WCAG 2.1.1, 2.4.7)', () => {
            cy.visit(previewUrl);
            cy.get(permalinkOf('jahia-lifecycle')).should('have.css', 'opacity', '0');
            cy.get(permalinkOf('jahia-lifecycle')).focus();
            cy.get(permalinkOf('jahia-lifecycle')).should('have.focus').and('have.css', 'opacity', '1');
            cy.get(permalinkOf('jahia-lifecycle')).should('have.css', 'outline-style', 'solid');
        });

        it('has a 24x24 minimum target size (WCAG 2.5.8)', () => {
            cy.visit(previewUrl);
            cy.get('.heading-anchors-permalink').each($button => {
                const rect = $button[0].getBoundingClientRect();
                expect(rect.width).to.be.at.least(24);
                expect(rect.height).to.be.at.least(24);
            });
        });

        it('keeps the toast inside a 320px wide viewport (WCAG 1.4.10)', () => {
            cy.viewport(320, 640);
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().resolves());
                }
            });
            cy.get(permalinkOf('jahia-lifecycle')).click();
            cy.get('#heading-anchors-status').should('have.class', 'is-visible').then($toast => {
                const rect = $toast[0].getBoundingClientRect();
                expect(rect.left).to.be.at.least(0);
                expect(rect.right).to.be.at.most(320);
            });
        });

        it('never covers the focused button (WCAG 2.4.11)', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().resolves());
                }
            });
            // Puts the button at the bottom of the viewport, where the toast is displayed, and focuses it without scrolling
            cy.window().then(win => {
                const button = win.document.querySelector<HTMLButtonElement>(permalinkOf('bottom-section'));
                win.scrollBy(0, button.getBoundingClientRect().bottom - win.innerHeight + 30);
                button.focus({preventScroll: true});
            });
            cy.get(permalinkOf('bottom-section')).should('have.focus').click({scrollBehavior: false});
            cy.get('#heading-anchors-status').should('have.class', 'is-visible').and('have.class', 'is-top');
            cy.get('#heading-anchors-status').then($toast => {
                cy.get(permalinkOf('bottom-section')).then($button => {
                    const toast = $toast[0].getBoundingClientRect();
                    const button = $button[0].getBoundingClientRect();
                    expect(toast.bottom <= button.top || toast.top >= button.bottom).to.equal(true);
                });
            });
        });

        it('is not changed by site styles, even with !important', () => {
            cy.visit(previewUrl);
            cy.document().then(doc => {
                const style = doc.createElement('style');
                style.textContent = [
                    'button { background: rgb(255, 0, 0) !important; padding: 40px !important; border: 5px solid red !important;',
                    '  opacity: 1 !important; position: absolute !important; }',
                    'div { display: block !important; margin: 30px !important; position: static !important; opacity: 1 !important; }',
                    'span { font-size: 50px !important; }',
                    '[id] { scroll-margin-top: 0 !important; }'
                ].join('\n');
                doc.head.appendChild(style);
            });
            cy.get(permalinkOf('jahia-lifecycle'))
                .should('have.css', 'background-color', 'rgba(0, 0, 0, 0)')
                .and('have.css', 'border-top-width', '0px')
                .and('have.css', 'opacity', '0')
                .and('have.css', 'position', 'relative');
            cy.get('#heading-anchors-status')
                .should('have.css', 'position', 'fixed')
                .and('have.css', 'opacity', '0');
        });

        it('does not style site elements', () => {
            cy.visit(previewUrl);
            cy.document().then(doc => {
                // A site heading with an id, outside of the elements handled by the module
                const heading = doc.createElement('h2');
                heading.id = 'site-heading';
                heading.textContent = 'Site heading';
                doc.body.appendChild(heading);
                const button = doc.createElement('button');
                button.textContent = 'Site button';
                doc.body.appendChild(button);
                expect(doc.defaultView.getComputedStyle(heading).scrollMarginTop).to.equal('0px');
                expect(doc.defaultView.getComputedStyle(button).opacity).to.equal('1');
            });
        });

        it('has no WCAG 2.2 A/AA violation on the injected elements (axe-core)', () => {
            cy.visit(previewUrl, {
                onBeforeLoad(win) {
                    stubClipboard(win, cy.stub().resolves());
                }
            });
            cy.request(AXE_URL).then(response => {
                cy.window().then(win => {
                    const script = win.document.createElement('script');
                    script.text = response.body;
                    win.document.head.appendChild(script);
                });
            });
            // Button visible and toast displayed, so that contrast is also checked
            cy.get(permalinkOf('jahia-lifecycle')).focus();
            // No scroll: the button must stay where the test put it; the button keeps the focus after the click
            cy.get(permalinkOf('jahia-lifecycle')).click({scrollBehavior: false});
            cy.get('#heading-anchors-status').should('have.class', 'is-visible').and('have.css', 'opacity', '1');
            cy.window().then(win => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const axe = (win as any).axe;
                return axe.run({include: [['.heading-anchors-permalink'], ['#heading-anchors-status'], ['[data-heading-anchors]']]},
                    {runOnly: {type: 'tag', values: WCAG_22_AA}});
            }).then(results => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const violations = (results as any).violations.map(violation =>
                    `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`);
                expect(violations, violations.join('\n')).to.have.length(0);
            });
        });
    });
});
