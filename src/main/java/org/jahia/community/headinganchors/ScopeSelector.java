package org.jahia.community.headinganchors;

import net.htmlparser.jericho.Element;
import net.htmlparser.jericho.Source;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal selector used to define where headings are processed.
 * Supported forms: {@code tag}, {@code #id}, {@code .class}, {@code tag#id}, {@code tag.class}.
 */
public final class ScopeSelector {

    private static final Pattern SYNTAX = Pattern.compile("^([a-zA-Z][a-zA-Z0-9-]*)?(?:([#.])([A-Za-z0-9_-]+))?$");

    private final String tag;
    private final String id;
    private final String cssClass;
    private final String raw;

    private ScopeSelector(String raw, String tag, String id, String cssClass) {
        this.raw = raw;
        this.tag = tag;
        this.id = id;
        this.cssClass = cssClass;
    }

    /**
     * @return the parsed selector, or {@code null} if the syntax is not supported
     */
    public static ScopeSelector parse(String raw) {
        String value = raw == null ? "" : raw.trim();
        Matcher matcher = SYNTAX.matcher(value);
        if (value.isEmpty() || !matcher.matches()) {
            return null;
        }
        String tag = matcher.group(1) == null ? null : matcher.group(1).toLowerCase();
        String type = matcher.group(2);
        String name = matcher.group(3);
        return new ScopeSelector(value, tag, "#".equals(type) ? name : null, ".".equals(type) ? name : null);
    }

    public List<Element> select(Source source) {
        List<Element> candidates;
        if (id != null) {
            candidates = source.getAllElements("id", id, true);
        } else if (cssClass != null) {
            candidates = source.getAllElementsByClass(cssClass);
        } else {
            candidates = source.getAllElements(tag);
        }
        if (tag == null || (id == null && cssClass == null)) {
            return candidates;
        }
        List<Element> result = new ArrayList<>();
        for (Element candidate : candidates) {
            if (tag.equals(candidate.getName())) {
                result.add(candidate);
            }
        }
        return result;
    }

    @Override
    public String toString() {
        return raw;
    }
}
