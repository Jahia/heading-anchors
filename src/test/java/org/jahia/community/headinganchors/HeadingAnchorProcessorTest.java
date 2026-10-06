package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HeadingAnchorProcessorTest {

    private static final String CSS = "/modules/heading-anchors/css/heading-anchors.css";
    private static final String JS = "/modules/heading-anchors/javascript/heading-anchors.js";

    private static String page(String body) {
        return "<html><head><title>t</title></head><body>" + body + "</body></html>";
    }

    private static String process(HeadingAnchorSettings settings, String html) {
        return new HeadingAnchorProcessor(settings, CSS, JS).process(html);
    }

    @Test
    void addsIdOnHeadingsInsideMain() {
        String out = process(new HeadingAnchorSettings(),
                page("<header><h2>Menu</h2></header><main><h2>Jahia lifecycle</h2><p>x</p><h3>Support</h3></main>"));

        assertThat(out).contains("<h2>Menu</h2>")
                .contains("<h2 id=\"jahia-lifecycle\">Jahia lifecycle</h2>")
                .contains("<h3 id=\"support\">Support</h3>")
                .contains("<link rel=\"stylesheet\" href=\"" + CSS + "\"></head>")
                .doesNotContain(JS);
    }

    @Test
    void fallsBackToNextScopeWhenFirstIsMissing() {
        String out = process(new HeadingAnchorSettings(), page("<div><h2>Title</h2></div>"));

        assertThat(out).contains("<h2 id=\"title\">Title</h2>");
    }

    @Test
    void supportsIdAndClassSelectors() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings()
                .setScopes(List.of(ScopeSelector.parse("div.content"), ScopeSelector.parse("#article")));

        String out = process(settings, page("<h2>Out</h2><article id=\"article\"><h2>In</h2></article>"));

        assertThat(out).contains("<h2>Out</h2>").contains("<h2 id=\"in\">In</h2>");
    }

    @Test
    void keepsExistingIdsAndAvoidsCollisions() {
        String out = process(new HeadingAnchorSettings(),
                page("<main><div id=\"overview\"></div><h2 id=\"custom\">Custom</h2><h2>Overview</h2><h2>Overview</h2></main>"));

        assertThat(out).contains("<h2 id=\"custom\">Custom</h2>")
                .contains("<h2 id=\"overview_1\">Overview</h2>")
                .contains("<h2 id=\"overview_2\">Overview</h2>");
    }

    @Test
    void usesFullHeadingTextIncludingNestedMarkup() {
        String out = process(new HeadingAnchorSettings(),
                page("<main><h2 class=\"x\" itemprop=\"name\">Release &amp; notes <small>8.2</small></h2></main>"));

        assertThat(out).contains("<h2 id=\"release-notes-82\" class=\"x\" itemprop=\"name\">");
    }

    @Test
    void ignoresHeadingLevelsNotConfigured() {
        String out = process(new HeadingAnchorSettings(), page("<main><h6>Small</h6></main>"));

        assertThat(out).contains("<h6>Small</h6>");
    }

    @Test
    void insertsAnchorInAnchorMode() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings()
                .setMode(HeadingAnchorSettings.Mode.ANCHOR)
                .setAnchorName(true);

        String out = process(settings, page("<main><h2 id=\"keep\">Jahia lifecycle</h2></main>"));

        assertThat(out).contains("<h2 id=\"keep\"><a id=\"jahia-lifecycle\" name=\"jahia-lifecycle\" class=\"heading-anchor\"></a>Jahia lifecycle</h2>");
    }

    @Test
    void addsPermalinkButtonStatusRegionAndScript() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><h2>Say \"hi\"</h2></main>"));

        assertThat(out).contains("<div class=\"heading-anchors-wrap\"><h2 id=\"say-hi\">Say \"hi\"</h2>"
                        + "<button type=\"button\" class=\"heading-permalink\" data-target=\"say-hi\""
                        + " aria-label=\"Copy link to section: Say &quot;hi&quot;\"><span aria-hidden=\"true\">#</span></button></div>")
                .contains("<div id=\"heading-anchors-status\" role=\"status\"")
                .contains("<script src=\"" + JS + "\" defer></script></body>");
    }

    @Test
    void skipsPermalinkInsideInteractiveElement() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><a href=\"/x\"><h3>Card</h3></a></main>"));

        assertThat(out).contains("<a href=\"/x\"><h3 id=\"card\">Card</h3></a>")
                .doesNotContain("heading-permalink\"")
                .doesNotContain(JS);
    }

    @Test
    void injectsScrollMargin() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setScrollMarginTop("120px");

        String out = process(settings, page("<main><h2>A</h2></main>"));

        assertThat(out).contains("<style>:root{--heading-anchors-scroll-margin:120px}</style></head>");
    }

    @Test
    void leavesPageUntouchedWithoutHeadings() {
        String html = page("<main><p>Nothing</p></main>");

        assertThat(process(new HeadingAnchorSettings(), html)).isEqualTo(html);
    }

    @Test
    void rejectsUnsupportedSelectors() {
        assertThat(ScopeSelector.parse("main > div")).isNull();
        assertThat(ScopeSelector.parse("")).isNull();
        assertThat(ScopeSelector.parse("article#doc")).isNotNull();
    }
}
