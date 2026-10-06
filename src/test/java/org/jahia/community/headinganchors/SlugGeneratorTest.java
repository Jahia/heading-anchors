package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class SlugGeneratorTest {

    @Test
    void slugifiesLikeTocScript() {
        assertThat(SlugGenerator.slugify("Jahia lifecycle")).isEqualTo("jahia-lifecycle");
        assertThat(SlugGenerator.slugify("  Évolution du produit ")).isEqualTo("evolution-du-produit");
        assertThat(SlugGenerator.slugify("What's new in 8.2?")).isEqualTo("whats-new-in-82");
        assertThat(SlugGenerator.slugify("R&D   team")).isEqualTo("rd-team");
    }

    @Test
    void fallsBackWhenNothingIsLeft() {
        assertThat(SlugGenerator.slugify("???")).isEqualTo(SlugGenerator.FALLBACK);
        assertThat(SlugGenerator.slugify("")).isEqualTo(SlugGenerator.FALLBACK);
        assertThat(SlugGenerator.slugify(null)).isEqualTo(SlugGenerator.FALLBACK);
    }

    @Test
    void suffixesDuplicates() {
        Set<String> used = new HashSet<>(Set.of("overview"));
        assertThat(SlugGenerator.unique("overview", used)).isEqualTo("overview_1");
        assertThat(SlugGenerator.unique("overview", used)).isEqualTo("overview_2");
        assertThat(SlugGenerator.unique("install", used)).isEqualTo("install");
    }
}
