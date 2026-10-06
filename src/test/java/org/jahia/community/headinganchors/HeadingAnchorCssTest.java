package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The stylesheet is loaded on the pages of any site where the module is enabled: it must never target
 * an element of the site itself, only elements injected or marked by the module.
 */
class HeadingAnchorCssTest {

    private static final Pattern COMMENTS = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL);
    // Rule prelude: text before a "{" that is not an at-rule
    private static final Pattern PRELUDES = Pattern.compile("([^{}]+)\\{");
    private static final Pattern MODULE_HOOK = Pattern.compile(
            "\\[data-heading-anchors]|\\.heading-anchors-[a-z-]+|#heading-anchors-status");

    private static String css() throws IOException {
        try (InputStream in = HeadingAnchorCssTest.class.getResourceAsStream("/css/heading-anchors.css")) {
            return COMMENTS.matcher(new String(in.readAllBytes(), StandardCharsets.UTF_8)).replaceAll("");
        }
    }

    private static List<String> selectors() throws IOException {
        List<String> selectors = new ArrayList<>();
        Matcher matcher = PRELUDES.matcher(css());
        while (matcher.find()) {
            String prelude = matcher.group(1).trim();
            if (!prelude.startsWith("@")) {
                for (String selector : prelude.split(",")) {
                    selectors.add(selector.trim());
                }
            }
        }
        return selectors;
    }

    @Test
    void everySelectorTargetsAModuleElement() throws IOException {
        List<String> selectors = selectors();

        assertThat(selectors).isNotEmpty();
        for (String selector : selectors) {
            // The subject of the selector (its last compound) must be a module element
            String[] compounds = selector.split("\\s*[>+~\\s]\\s*");
            String subject = compounds[compounds.length - 1];
            if (subject.equals("span")) {
                // Only allowed as a direct child of the module button
                assertThat(selector).as(selector).contains("button.heading-anchors-permalink.heading-anchors-permalink > span");
            } else {
                assertThat(MODULE_HOOK.matcher(subject).find()).as("selector subject must be a module element: " + selector).isTrue();
            }
        }
    }

    @Test
    void injectedElementsAreResetAgainstSiteStyles() throws IOException {
        String css = css();

        assertThat(css).contains("div.heading-anchors-wrap > button.heading-anchors-permalink.heading-anchors-permalink {\n    all: unset !important;")
                .contains("div#heading-anchors-status.heading-anchors-toast {\n    all: unset !important;");
    }

    @Test
    void declarationsOnInjectedElementsAreImportant() throws IOException {
        Matcher rule = Pattern.compile("([^{}]+)\\{([^{}]*)}").matcher(css());
        int checked = 0;
        while (rule.find()) {
            String prelude = rule.group(1).trim();
            if (prelude.equals("[data-heading-anchors]")) {
                // Site headings: the theme may override the scroll margin
                continue;
            }
            for (String declaration : rule.group(2).split(";")) {
                if (!declaration.trim().isEmpty()) {
                    assertThat(declaration).as(prelude).contains("!important");
                    checked++;
                }
            }
        }
        assertThat(checked).isGreaterThan(30);
    }
}
