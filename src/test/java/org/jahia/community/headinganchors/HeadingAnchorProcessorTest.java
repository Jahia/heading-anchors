package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class HeadingAnchorProcessorTest {

    private static final String CSS = "/modules/heading-anchors/css/heading-anchors.css";
    private static final String JS = "/modules/heading-anchors/javascript/heading-anchors.js";

    private static String page(String body) {
        return "<html><head><title>t</title></head><body>" + body + "</body></html>";
    }

    private static final String M = " data-heading-anchors";

    private static String process(HeadingAnchorSettings settings, String html) {
        PermalinkMessages messages = PermalinkMessages.forLocale(Locale.ENGLISH, settings);
        return new HeadingAnchorProcessor(settings, messages, CSS, JS).process(html);
    }

    @Test
    void addsIdOnHeadingsInsideMain() {
        String out = process(new HeadingAnchorSettings(),
                page("<header><h2>Menu</h2></header><main><h2>Jahia lifecycle</h2><p>x</p><h3>Support</h3></main>"));

        assertThat(out).contains("<h2>Menu</h2>")
                .contains("<h2 id=\"jahia-lifecycle\"" + M + ">Jahia lifecycle</h2>")
                .contains("<h3 id=\"support\"" + M + ">Support</h3>")
                .contains("<link rel=\"stylesheet\" href=\"" + CSS + "\"></head>")
                .doesNotContain(JS);
    }

    @Test
    void fallsBackToNextScopeWhenFirstIsMissing() {
        String out = process(new HeadingAnchorSettings(), page("<div><h2>Title</h2></div>"));

        assertThat(out).contains("<h2 id=\"title\"" + M + ">Title</h2>");
    }

    @Test
    void supportsIdAndClassSelectors() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings()
                .setScopes(List.of(ScopeSelector.parse("div.content"), ScopeSelector.parse("#article")));

        String out = process(settings, page("<h2>Out</h2><article id=\"article\"><h2>In</h2></article>"));

        assertThat(out).contains("<h2>Out</h2>").contains("<h2 id=\"in\"" + M + ">In</h2>");
    }

    @Test
    void keepsExistingIdsAndAvoidsCollisions() {
        String out = process(new HeadingAnchorSettings(),
                page("<main><div id=\"overview\"></div><h2 id=\"custom\">Custom</h2><h2>Overview</h2><h2>Overview</h2></main>"));

        assertThat(out).contains("<h2" + M + " id=\"custom\">Custom</h2>")
                .contains("<h2 id=\"overview_1\"" + M + ">Overview</h2>")
                .contains("<h2 id=\"overview_2\"" + M + ">Overview</h2>")
                .contains("<div id=\"overview\"></div>");
    }

    @Test
    void usesTheExistingIdForThePermalinkByDefault() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><h2 id=\"lifecycle\">Jahia lifecycle</h2></main>"));

        assertThat(out).contains("<h2" + M + " id=\"lifecycle\">Jahia lifecycle<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"lifecycle\" aria-label=\"Copy link\"></button></h2>")
                .doesNotContain("heading-anchors-target");
    }

    @Test
    void addsTheSlugNextToADifferentExistingIdWhenConfigured() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true).setAnchorOnExistingId(true);

        String out = process(settings, page("<main><h2 id=\"lifecycle\">Jahia lifecycle</h2><h2 id=\"faq\">FAQ</h2></main>"));

        assertThat(out).contains("<h2" + M + " id=\"lifecycle\"><a id=\"jahia-lifecycle\"" + M
                        + " class=\"heading-anchors-target\"></a>Jahia lifecycle<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"jahia-lifecycle\" aria-label=\"Copy link\"></button></h2>")
                // Same as the slug: nothing to add
                .contains("<h2" + M + " id=\"faq\">FAQ<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"faq\" aria-label=\"Copy link\"></button></h2>");
    }

    @Test
    void givesAUniqueAnchorToHeadingsWithADuplicatedId() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><h2 id=\"faq\">FAQ</h2><h2 id=\"faq\">FAQ</h2></main>"));

        // The first heading keeps its id; the second one cannot be reached with it, it gets its own anchor
        assertThat(out).contains("<h2" + M + " id=\"faq\">FAQ<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"faq\" aria-label=\"Copy link\"></button></h2>")
                .contains("<h2" + M + " id=\"faq\"><a id=\"faq_1\"" + M + " class=\"heading-anchors-target\"></a>FAQ"
                        + "<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"faq_1\" aria-label=\"Copy link\"></button></h2>");
    }

    @Test
    void givesAUniqueAnchorWhenAnEarlierElementHasTheSameId() {
        String out = process(new HeadingAnchorSettings(), page("<main><div id=\"intro\"></div><h2 id=\"intro\">Intro</h2></main>"));

        assertThat(out).contains("<h2" + M + " id=\"intro\"><a id=\"intro_1\"" + M + " class=\"heading-anchors-target\"></a>Intro</h2>");
    }

    @Test
    void usesFullHeadingTextIncludingNestedMarkup() {
        String out = process(new HeadingAnchorSettings(),
                page("<main><h2 class=\"x\" itemprop=\"name\">Release &amp; notes <small>8.2</small></h2></main>"));

        assertThat(out).contains("<h2 id=\"release-notes-82\"" + M + " class=\"x\" itemprop=\"name\">");
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

        assertThat(out).contains("<h2 id=\"keep\"><a id=\"jahia-lifecycle\"" + M
                + " name=\"jahia-lifecycle\" class=\"heading-anchors-target\"></a>Jahia lifecycle</h2>");
    }

    @Test
    void addsPermalinkButtonStatusRegionAndScript() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><h2>Say \"hi\"</h2></main>"));

        // Last child of the heading, no wrapper: the page structure is unchanged
        assertThat(out).contains("<h2 id=\"say-hi\"" + M + ">Say \"hi\"<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"say-hi\" aria-label=\"Copy link\"></button></h2>")
                .doesNotContain("heading-anchors-wrap")
                .contains("<div id=\"heading-anchors-status\" role=\"status\" class=\"heading-anchors-toast\""
                        + " data-copied-message=\"Link copied to clipboard\" data-fallback-message=\"Link is in the address bar\"></div>")
                .contains("<script src=\"" + JS + "\" defer></script></body>");
    }

    @Test
    void escapesAConfiguredLabelWithTheHeadingText() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true).setPermalinkLabel("Link to {0}");

        String out = process(settings, page("<main><h2>Say \"hi\"</h2></main>"));

        assertThat(out).contains("aria-label=\"Link to Say &quot;hi&quot;\"");
    }

    @Test
    void addsNoPermalinkOnHeadingLevelsNotConfiguredForIt() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><h1>Page title</h1><h2>Section</h2></main>"));

        // h1 (the page title) gets an id but no button by default
        assertThat(out).contains("<h1 id=\"page-title\"" + M + ">Page title</h1>")
                .contains("<h2 id=\"section\"" + M + ">Section<button type=\"button\" class=\"heading-anchors-permalink\" data-target=\"section\" aria-label=\"Copy link\"></button></h2>");
    }

    @Test
    void keepsAManualAnchorOfTheSectionByDefault() {
        HeadingAnchorProcessor processor = new HeadingAnchorProcessor(new HeadingAnchorSettings(),
                PermalinkMessages.forLocale(Locale.ENGLISH, new HeadingAnchorSettings()), CSS, JS);

        String out = processor.process(page("<main><h3>Jahia lifecycle</h3>"
                + "<p><a id=\"jahia-lifecycle\" name=\"jahia-lifecycle\"></a>Text</p></main>"));

        assertThat(out).contains("<h3 id=\"jahia-lifecycle_1\"" + M + ">Jahia lifecycle</h3>")
                .contains("<a id=\"jahia-lifecycle\" name=\"jahia-lifecycle\"></a>");
        assertThat(processor.getNotices()).containsExactly(
                "Manual anchor 'jahia-lifecycle' kept below its heading, which gets 'jahia-lifecycle_1'");
    }

    @Test
    void adoptsAManualAnchorOfTheSectionWhenConfigured() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setAdoptLegacyAnchors(true);

        String out = process(settings, page("<main><h3>Jahia lifecycle</h3>"
                + "<p><a id=\"jahia-lifecycle\" name=\"jahia-lifecycle\"></a>Text</p>"
                + "<h3>Other</h3><p><a id=\"other-anchor\"></a></p></main>"));

        assertThat(out).contains("<h3 id=\"jahia-lifecycle\"" + M + ">Jahia lifecycle</h3>")
                .doesNotContain("id=\"jahia-lifecycle_1\"")
                .doesNotContain("name=\"jahia-lifecycle\"")
                // Unrelated manual anchors are untouched
                .contains("<a id=\"other-anchor\"></a>");
    }

    @Test
    void neverAdoptsAnAnchorOutsideTheSectionOrALink() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setAdoptLegacyAnchors(true);

        String out = process(settings, page("<main><p><a id=\"intro\"></a></p><h2>Intro</h2>"
                + "<h2>Next</h2><p><a id=\"next\" href=\"#x\"></a></p></main>"));

        // Anchor before the heading, and anchor with href: kept, the headings get suffixed slugs
        assertThat(out).contains("<a id=\"intro\"></a>").contains("<h2 id=\"intro_1\"" + M + ">Intro</h2>")
                .contains("<a id=\"next\" href=\"#x\"></a>").contains("<h2 id=\"next_1\"" + M + ">Next</h2>");
    }

    @Test
    void skipsPermalinkInsideInteractiveElement() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkEnabled(true);

        String out = process(settings, page("<main><a href=\"/x\"><h3>Card</h3></a></main>"));

        assertThat(out).contains("<a href=\"/x\"><h3 id=\"card\"" + M + ">Card</h3></a>")
                .doesNotContain("heading-anchors-permalink\"")
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
