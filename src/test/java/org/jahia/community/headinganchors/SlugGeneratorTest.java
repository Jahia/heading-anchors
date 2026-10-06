package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class SlugGeneratorTest {

    // HTML: an id must not be empty and must not contain ASCII whitespace
    private static final Pattern VALID_HTML_ID = Pattern.compile("[^\\t\\n\\f\\r ]+");

    @Test
    void slugifiesLatinTextLikeTocScript() {
        assertThat(SlugGenerator.slugify("Jahia lifecycle")).isEqualTo("jahia-lifecycle");
        assertThat(SlugGenerator.slugify("  Évolution du produit ")).isEqualTo("evolution-du-produit");
        assertThat(SlugGenerator.slugify("What's new in 8.2?")).isEqualTo("whats-new-in-82");
        assertThat(SlugGenerator.slugify("R&D   team")).isEqualTo("rd-team");
        assertThat(SlugGenerator.slugify("Wi-Fi\tand\nmore")).isEqualTo("wifi-and-more");
    }

    @Test
    void transliteratesWithTheJahiaCharacterMap() {
        assertThat(SlugGenerator.slugify("Straße")).isEqualTo("strasse");
        assertThat(SlugGenerator.slugify("Œuvre æsthétique")).isEqualTo("oeuvre-aesthetique");
        assertThat(SlugGenerator.slugify("Жизненный цикл")).isEqualTo("zhiznennyi-cikl");
        // Jahia character map, as for node system names (ω gives w, η gives h)
        assertThat(SlugGenerator.slugify("Κύκλος ζωής")).isEqualTo("kyklos-zwhs");
    }

    @Test
    void foldsCompatibilityCharacters() {
        assertThat(SlugGenerator.slugify("ﬁle ＡＢＣ")).isEqualTo("file-abc");
    }

    @Test
    void keepsScriptsWithoutTransliteration() {
        assertThat(SlugGenerator.slugify("生命周期 管理")).isEqualTo("生命周期-管理");
        assertThat(SlugGenerator.slugify("ガイド")).isEqualTo("ガイド");
        assertThat(SlugGenerator.slugify("한국어 문서")).isEqualTo("한국어-문서");
        assertThat(SlugGenerator.slugify("מחזור חיים")).isEqualTo("מחזור-חיים");
        assertThat(SlugGenerator.slugify("हिन्दी")).isEqualTo("हिन्दी");
    }

    @Test
    void dropsMarksOfTransliteratedText() {
        assertThat(SlugGenerator.slugify("مُحَمَّد")).doesNotContainPattern("[\\u064b-\\u0652]").matches("[a-z0-9]+");
    }

    @Test
    void fallsBackWhenNothingIsLeft() {
        assertThat(SlugGenerator.slugify("???")).isEqualTo(SlugGenerator.FALLBACK);
        assertThat(SlugGenerator.slugify("🎉 !")).isEqualTo(SlugGenerator.FALLBACK);
        assertThat(SlugGenerator.slugify("")).isEqualTo(SlugGenerator.FALLBACK);
        assertThat(SlugGenerator.slugify(null)).isEqualTo(SlugGenerator.FALLBACK);
    }

    @Test
    void alwaysProducesAValidHtmlId() {
        for (String text : new String[]{"a b", "  ", " Title ", "Tab\there", "生命 周期", "-_-", "Line sep"}) {
            assertThat(SlugGenerator.slugify(text)).as(text).matches(VALID_HTML_ID);
        }
    }

    @Test
    void suffixesDuplicates() {
        Set<String> used = new HashSet<>(Set.of("overview"));
        assertThat(SlugGenerator.unique("overview", used)).isEqualTo("overview_1");
        assertThat(SlugGenerator.unique("overview", used)).isEqualTo("overview_2");
        assertThat(SlugGenerator.unique("install", used)).isEqualTo("install");
    }
}
