package org.jahia.community.headinganchors;

import net.htmlparser.jericho.Element;
import net.htmlparser.jericho.EndTag;
import net.htmlparser.jericho.OutputDocument;
import net.htmlparser.jericho.Source;
import net.htmlparser.jericho.StartTag;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
    static final String PERMALINK_CLASS = "heading-anchors-permalink";
    static final String TOAST_CLASS = "heading-anchors-toast";
    /** Marks every element handled by the module: the stylesheet only targets marked or injected elements */
    static final String MARKER_ATTRIBUTE = "data-heading-anchors";

    private static final String[] INTERACTIVE_TAGS = {"a", "button", "summary", "label"};

    private final HeadingAnchorSettings settings;
    private final PermalinkMessages messages;
    private final List<String> notices = new ArrayList<>();
    private final String cssUrl;
    private final String jsUrl;

    /**
     * @param messages texts of the permalink button and of the copy feedback, in the page language
     * @param cssUrl   stylesheet injected in the head, or {@code null}
     * @param jsUrl    script injected when a permalink button is added, or {@code null}
     */
    public HeadingAnchorProcessor(HeadingAnchorSettings settings, PermalinkMessages messages, String cssUrl, String jsUrl) {
        this.settings = settings;
        this.messages = messages;
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

        Map<String, Integer> firstIdPositions = collectIds(source);
        Set<String> usedIds = new HashSet<>(firstIdPositions.keySet());
        Map<String, Element> legacyAnchors = collectLegacyAnchors(source);
        List<Element> interactiveElements = collectInteractiveElements(source);
        OutputDocument out = new OutputDocument(source);
        boolean permalinkAdded = false;

        for (int index = 0; index < headings.size(); index++) {
            Element heading = headings.get(index);
            int sectionEnd = index + 1 < headings.size() ? headings.get(index + 1).getBegin() : source.length();
            StartTag startTag = heading.getStartTag();
            String text = heading.getTextExtractor().setIncludeAttributes(false).toString().trim();
            String existingId = trimToNull(startTag.getAttributeValue("id"));
            String targetId;

            if (settings.getMode() == HeadingAnchorSettings.Mode.ANCHOR) {
                // Anchor mode: the heading is never modified
                targetId = SlugGenerator.unique(SlugGenerator.slugify(text), usedIds);
                out.insert(startTag.getEnd(), anchorMarkup(targetId));
            } else {
                int attributesPosition = startTag.getBegin() + 1 + startTag.getName().length();
                String slug = SlugGenerator.slugify(text);
                if (existingId == null) {
                    targetId = slugForHeading(slug, heading, sectionEnd, usedIds, legacyAnchors, out);
                    out.insert(attributesPosition, " id=\"" + targetId + "\" " + MARKER_ATTRIBUTE);
                } else if (isUsable(existingId, startTag, firstIdPositions)
                        && (existingId.equals(slug) || !settings.isAnchorOnExistingId())) {
                    // The existing id (often typed by the editor) is kept and used by the permalink
                    targetId = existingId;
                    out.insert(attributesPosition, " " + MARKER_ATTRIBUTE);
                } else {
                    // The existing id may be used by the site (CSS, scripts, links): it is kept, and a unique slug is
                    // added with an empty anchor inside the heading, so the fragment target stays the heading.
                    // Also used when the existing id is a duplicate: a link to it would reach an earlier element
                    targetId = SlugGenerator.unique(slug, usedIds);
                    out.insert(attributesPosition, " " + MARKER_ATTRIBUTE);
                    out.insert(startTag.getEnd(), anchorMarkup(targetId));
                }
            }

            EndTag endTag = heading.getEndTag();
            if (settings.isPermalinkEnabled() && settings.getPermalinkHeadings().contains(heading.getName())
                    && endTag != null && !isInsideInteractive(heading, interactiveElements)) {
                // Last child of the heading: the page structure is unchanged (no wrapper), so site selectors such as
                // "p + h2" or ".box > h2" keep working. The glyph is drawn in CSS, out of the heading text content
                out.insert(endTag.getBegin(), permalinkMarkup(targetId, text));
                permalinkAdded = true;
            }
        }

        injectAssets(source, out, permalinkAdded);
        return out.toString();
    }

    /**
     * @return what the processor noticed on the last processed page, e.g. manual anchors kept next to a heading
     */
    public List<String> getNotices() {
        return notices;
    }

    /**
     * Returns the id of a heading without id. When the slug is already taken by a manual anchor of its section
     * (an empty {@code <a id>} without href, e.g. typed in the text below the heading), the anchor is kept by default
     * and the heading gets a suffixed slug; with {@code legacyAnchors=adopt}, the heading takes the slug and the anchor
     * loses its id, so existing links reach the heading.
     */
    private String slugForHeading(String slug, Element heading, int sectionEnd, Set<String> usedIds,
                                  Map<String, Element> legacyAnchors, OutputDocument out) {
        Element legacy = legacyAnchors.get(slug);
        if (legacy == null || legacy.getBegin() < heading.getEnd() || legacy.getBegin() >= sectionEnd) {
            return SlugGenerator.unique(slug, usedIds);
        }
        if (settings.isAdoptLegacyAnchors()) {
            removeAttribute(out, legacy.getStartTag(), "id");
            if (slug.equals(legacy.getStartTag().getAttributeValue("name"))) {
                removeAttribute(out, legacy.getStartTag(), "name");
            }
            legacyAnchors.remove(slug);
            notices.add("Manual anchor '" + slug + "' adopted by its heading");
            return slug;
        }
        String id = SlugGenerator.unique(slug, usedIds);
        notices.add("Manual anchor '" + slug + "' kept below its heading, which gets '" + id + "'");
        return id;
    }

    private static void removeAttribute(OutputDocument out, StartTag tag, String name) {
        if (tag.getAttributes() != null && tag.getAttributes().get(name) != null) {
            out.replace(tag.getAttributes().get(name), "");
        }
    }

    /**
     * Manual anchors: empty {@code <a>} elements with an id and without href, the usual way to create a link target
     * in rich text.
     */
    private static Map<String, Element> collectLegacyAnchors(Source source) {
        Map<String, Element> anchors = new HashMap<>();
        for (Element anchor : source.getAllElements("a")) {
            String id = trimToNull(anchor.getAttributeValue("id"));
            if (id != null && anchor.getAttributeValue("href") == null && anchor.getChildElements().isEmpty()
                    && anchor.getContent().toString().trim().isEmpty()) {
                anchors.putIfAbsent(id, anchor);
            }
        }
        return anchors;
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

    /**
     * @return every id of the page, with the position of the first element that has it
     */
    private static Map<String, Integer> collectIds(Source source) {
        Map<String, Integer> ids = new HashMap<>();
        for (StartTag tag : source.getAllStartTags()) {
            String id = trimToNull(tag.getAttributeValue("id"));
            if (id != null) {
                ids.putIfAbsent(id, tag.getBegin());
            }
        }
        return ids;
    }

    /**
     * An id is usable as a fragment target only if this heading is the first element of the page having it.
     */
    private static boolean isUsable(String id, StartTag startTag, Map<String, Integer> firstIdPositions) {
        return firstIdPositions.get(id) == startTag.getBegin();
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
        StringBuilder sb = new StringBuilder("<a id=\"").append(id).append("\" ").append(MARKER_ATTRIBUTE);
        if (settings.isAnchorName()) {
            sb.append(" name=\"").append(id).append('"');
        }
        if (settings.getAnchorClass() != null && !settings.getAnchorClass().isEmpty()) {
            sb.append(" class=\"").append(escape(settings.getAnchorClass())).append('"');
        }
        return sb.append("></a>").toString();
    }

    /**
     * Empty button: the "#" glyph and the tooltip are CSS generated content, so they are not part of the heading text
     * read by table of contents scripts. The tooltip shows the accessible name (WCAG 2.5.3).
     */
    private String permalinkMarkup(String id, String headingText) {
        String label = messages.getLabel(headingText);
        return "<button type=\"button\" class=\"" + PERMALINK_CLASS + "\" data-target=\"" + escape(id) + "\""
                + " aria-label=\"" + escape(label) + "\"></button>";
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
            bodyAssets.append("<div id=\"").append(STATUS_ID).append("\" role=\"status\" class=\"").append(TOAST_CLASS).append('"')
                    .append(" data-copied-message=\"").append(escape(messages.getCopied())).append('"')
                    .append(" data-fallback-message=\"").append(escape(messages.getFallback())).append("\"></div>");
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
