package org.jahia.community.headinganchors;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Builds anchor ids from heading text.
 * The algorithm mirrors the one used by the academy toc.min.js so that ids generated
 * server side are identical to the ones previously generated in the browser.
 */
public final class SlugGenerator {

    static final String FALLBACK = "section";

    private static final Pattern COMBINING_MARKS = Pattern.compile("[\\u0300-\\u036f]");
    private static final Pattern NOT_ALLOWED = Pattern.compile("[^a-z0-9 ]");
    private static final Pattern SPACES = Pattern.compile("\\s+");

    private SlugGenerator() {
    }

    public static String slugify(String text) {
        if (text == null) {
            return FALLBACK;
        }
        String slug = Normalizer.normalize(text, Normalizer.Form.NFD);
        slug = COMBINING_MARKS.matcher(slug).replaceAll("").toLowerCase(Locale.ROOT).trim();
        slug = NOT_ALLOWED.matcher(slug).replaceAll("");
        slug = SPACES.matcher(slug).replaceAll("-");
        return slug.isEmpty() ? FALLBACK : slug;
    }

    /**
     * Returns {@code base}, or {@code base_1}, {@code base_2}... if already used, and records the result.
     */
    public static String unique(String base, Set<String> usedIds) {
        String candidate = base;
        int counter = 1;
        while (usedIds.contains(candidate)) {
            candidate = base + "_" + counter++;
        }
        usedIds.add(candidate);
        return candidate;
    }
}
