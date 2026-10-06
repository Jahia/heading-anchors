package org.jahia.community.headinganchors;

import net.htmlparser.jericho.Element;
import net.htmlparser.jericho.EndTag;
import net.htmlparser.jericho.OutputDocument;
import net.htmlparser.jericho.Source;
import net.htmlparser.jericho.StartTag;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Adds slug-based anchors to the headings of a full HTML page.
 * Pure HTML-in / HTML-out so it can be unit tested without a Jahia runtime.
 */
public class HeadingAnchorProcessor {

    static final String STATUS_ID = "heading-anchors-status";
    static final String WRAPPER_CLASS = "heading-anchors-wrap";
    static final String PERMALINK_CLASS = "heading-permalink";

    private static final String[] INTERACTIVE_TAGS = {"a", "button", "summary", "label"};

    private final HeadingAnchorSettings settings;
    private final String cssUrl;
    private final String jsUrl;

    /**
     * @param cssUrl stylesheet injected in the head, or {@code null}
     * @param jsUrl  script injected when a permalink button is added, or {@code null}
     */
    public HeadingAnchorProcessor(HeadingAnchorSettings settings, String cssUrl, String jsUrl) {
        this.settings = settings;
        this.cssUrl = cssUrl;
        this.jsUrl = jsUrl;
    }

    public String process(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        Source source = new Source(html);
        List<Element> scopes = resolveScopes(source);
        if (scopes.isEmpty()) {
            return html;
        }
        List<Element> headings = collectHeadings(source, scopes);
        if (headings.isEmpty()) {
            return html;
        }

        Set<String> usedIds = collectIds(source);
        List<Element> interactiveElements = collectInteractiveElements(source);
        OutputDocument out = new OutputDocument(source);
        boolean permalinkAdded = false;

        for (Element heading : headings) {
            StartTag startTag = heading.getStartTag();
            String text = heading.getTextExtractor().setIncludeAttributes(false).toString().trim();
            String existingId = trimToNull(startTag.getAttributeValue("id"));
            String targetId;

            if (settings.getMode() == HeadingAnchorSettings.Mode.ANCHOR) {
                targetId = SlugGenerator.unique(SlugGenerator.slugify(text), usedIds);
                out.insert(startTag.getEnd(), anchorMarkup(targetId));
            } else if (existingId != null) {
                targetId = existingId;
            } else {
                targetId = SlugGenerator.unique(SlugGenerator.slugify(text), usedIds);
                out.insert(startTag.getBegin() + 1 + startTag.getName().length(), " id=\"" + targetId + "\"");
            }

            EndTag endTag = heading.getEndTag();
            if (settings.isPermalinkEnabled() && endTag != null && !isInsideInteractive(heading, interactiveElements)) {
                out.insert(startTag.getBegin(), "<div class=\"" + WRAPPER_CLASS + "\">");
                out.insert(heading.getEnd(), permalinkMarkup(targetId, text) + "</div>");
                permalinkAdded = true;
            }
        }

        injectAssets(source, out, permalinkAdded);
        return out.toString();
    }

    private List<Element> resolveScopes(Source source) {
        for (ScopeSelector selector : settings.getScopes()) {
            List<Element> matches = selector.select(source);
            if (!matches.isEmpty()) {
                return matches;
            }
        }
        return List.of();
    }

    private List<Element> collectHeadings(Source source, List<Element> scopes) {
        // Identity map de-duplicates headings matched by several (nested) scopes
        Map<Element, Boolean> found = new IdentityHashMap<>();
        for (String tag : settings.getHeadings()) {
            for (Element heading : source.getAllElements(tag)) {
                for (Element scope : scopes) {
                    if (scope.encloses(heading)) {
                        found.put(heading, Boolean.TRUE);
                        break;
                    }
                }
            }
        }
        List<Element> headings = new ArrayList<>(found.keySet());
        headings.sort(Comparator.comparingInt(Element::getBegin));
        return headings;
    }

    private static Set<String> collectIds(Source source) {
        Set<String> ids = new HashSet<>();
        for (StartTag tag : source.getAllStartTags()) {
            String id = trimToNull(tag.getAttributeValue("id"));
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }

    private static List<Element> collectInteractiveElements(Source source) {
        List<Element> elements = new ArrayList<>();
        for (String tag : INTERACTIVE_TAGS) {
            elements.addAll(source.getAllElements(tag));
        }
        return elements;
    }

    private static boolean isInsideInteractive(Element heading, List<Element> interactiveElements) {
        for (Element element : interactiveElements) {
            if (element.encloses(heading)) {
                return true;
            }
        }
        return false;
    }

    private String anchorMarkup(String id) {
        StringBuilder sb = new StringBuilder("<a id=\"").append(id).append('"');
        if (settings.isAnchorName()) {
            sb.append(" name=\"").append(id).append('"');
        }
        if (settings.getAnchorClass() != null && !settings.getAnchorClass().isEmpty()) {
            sb.append(" class=\"").append(escape(settings.getAnchorClass())).append('"');
        }
        return sb.append("></a>").toString();
    }

    private String permalinkMarkup(String id, String headingText) {
        String label = settings.getPermalinkLabel().replace("{0}", headingText);
        return "<button type=\"button\" class=\"" + PERMALINK_CLASS + "\" data-target=\"" + escape(id) + "\""
                + " aria-label=\"" + escape(label) + "\"><span aria-hidden=\"true\">#</span></button>";
    }

    private void injectAssets(Source source, OutputDocument out, boolean permalinkAdded) {
        Element head = source.getFirstElement("head");
        if (head != null && head.getEndTag() != null) {
            StringBuilder headAssets = new StringBuilder();
            if (cssUrl != null) {
                headAssets.append("<link rel=\"stylesheet\" href=\"").append(escape(cssUrl)).append("\">");
            }
            if (settings.getScrollMarginTop() != null && !settings.getScrollMarginTop().isEmpty()) {
                headAssets.append("<style>:root{--heading-anchors-scroll-margin:")
                        .append(settings.getScrollMarginTop()).append("}</style>");
            }
            out.insert(head.getEndTag().getBegin(), headAssets);
        }

        Element body = source.getFirstElement("body");
        if (permalinkAdded && body != null && body.getEndTag() != null) {
            StringBuilder bodyAssets = new StringBuilder();
            bodyAssets.append("<div id=\"").append(STATUS_ID).append("\" role=\"status\" class=\"heading-anchors-toast\"")
                    .append(" data-copied-message=\"").append(escape(settings.getPermalinkCopiedMessage())).append('"')
                    .append(" data-fallback-message=\"").append(escape(settings.getPermalinkFallbackMessage())).append("\"></div>");
            if (jsUrl != null) {
                bodyAssets.append("<script src=\"").append(escape(jsUrl)).append("\" defer></script>");
            }
            out.insert(body.getEndTag().getBegin(), bodyAssets);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String escape(String value) {
        StringBuilder sb = new StringBuilder(value.length());
        for (char c : value.toCharArray()) {
            switch (c) {
                case '&': sb.append("&amp;"); break;
                case '<': sb.append("&lt;"); break;
                case '>': sb.append("&gt;"); break;
                case '"': sb.append("&quot;"); break;
                case '\'': sb.append("&#39;"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }
}
