package org.jahia.community.headinganchors;

import org.jahia.utils.Patterns;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Builds anchor ids from heading text.
 * <p>
 * HTML requires an id to be non-empty, unique and without ASCII whitespace; every other character is allowed.
 * Slugs are kept URL-friendly:
 * <ul>
 * <li>Latin text gives the same ids as the academy toc.min.js (accents removed, punctuation removed,
 * spaces replaced by "-"), so links already shared keep working</li>
 * <li>letters without decomposition and other transliterable scripts (Cyrillic, Greek, Arabic, Armenian,
 * Georgian) use the Jahia character map, the one used for node system names (ß gives ss, ж gives zh)</li>
 * <li>scripts without transliteration (CJK, Hebrew, Thai, Devanagari...) keep their letters, which HTML
 * allows: the id stays meaningful for readers of the page language</li>
 * </ul>
 */
public final class SlugGenerator {

    static final String FALLBACK = "section";

    private static final Pattern COMBINING_ACCENTS = Pattern.compile("[\\u0300-\\u036f]");
    private static final Pattern WHITESPACES = Pattern.compile("\\s+");

    private SlugGenerator() {
    }

    public static String slugify(String text) {
        if (text == null) {
            return FALLBACK;
        }
        // NFKD also folds compatibility characters (ligatures, full-width letters)
        String decomposed = Normalizer.normalize(text, Normalizer.Form.NFKD);
        decomposed = COMBINING_ACCENTS.matcher(decomposed).replaceAll("").toLowerCase(Locale.ROOT).trim();

        StringBuilder slug = new StringBuilder(decomposed.length());
        decomposed.codePoints().forEach(codePoint -> append(slug, codePoint));

        // NFC recomposes the scripts that are kept as is (e.g. Hangul syllables, Japanese voiced kana)
        String result = Normalizer.normalize(slug.toString(), Normalizer.Form.NFC).trim();
        result = WHITESPACES.matcher(result).replaceAll("-");
        return result.isEmpty() ? FALLBACK : result;
    }

    private static void append(StringBuilder slug, int codePoint) {
        if ((codePoint >= 'a' && codePoint <= 'z') || (codePoint >= '0' && codePoint <= '9') || codePoint == ' ') {
            slug.appendCodePoint(codePoint);
            return;
        }
        if (Character.isWhitespace(codePoint)) {
            slug.append(' ');
            return;
        }
        String transliteration = Patterns.CHARMAP.getProperty(new String(Character.toChars(codePoint)));
        if (transliteration != null) {
            // The map may give upper case or punctuation: keep only what a slug allows
            transliteration.toLowerCase(Locale.ROOT).codePoints()
                    .filter(c -> (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
                    .forEach(slug::appendCodePoint);
            return;
        }
        if (isKept(codePoint, slug)) {
            slug.appendCodePoint(codePoint);
        }
        // Anything else (punctuation, symbols, emoji, untransliterated Latin letters) is removed, like toc.min.js
    }

    /**
     * Letters and digits of non-Latin scripts, and the marks they need (Devanagari, Thai, Japanese voiced kana...).
     * A mark is only kept after such a letter: e.g. Arabic vowel marks are dropped as Arabic letters are transliterated.
     */
    private static boolean isKept(int codePoint, StringBuilder slug) {
        int type = Character.getType(codePoint);
        if (type == Character.NON_SPACING_MARK || type == Character.COMBINING_SPACING_MARK) {
            return slug.length() > 0 && slug.codePointBefore(slug.length()) > 0x7f;
        }
        return Character.isLetterOrDigit(codePoint) && Character.UnicodeScript.of(codePoint) != Character.UnicodeScript.LATIN;
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
