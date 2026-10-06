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
                selectors.addAll(splitTopLevel(prelude));
            }
        }
        return selectors;
    }

    /**
     * Splits a selector list on its top-level commas only: ":is(h1, h2) > button" is a single selector.
     */
    private static List<String> splitTopLevel(String selectorList) {
        List<String> selectors = new ArrayList<>();
        int depth = 0;
        int start = 0;
        for (int i = 0; i < selectorList.length(); i++) {
            char c = selectorList.charAt(i);
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
            } else if (c == ',' && depth == 0) {
                selectors.add(selectorList.substring(start, i).trim());
                start = i + 1;
            }
        }
        selectors.add(selectorList.substring(start).trim());
        return selectors;
    }

    @Test
    void everySelectorTargetsAModuleElement() throws IOException {
        List<String> selectors = selectors();

        assertThat(selectors).isNotEmpty();
        for (String selector : selectors) {
            // The subject of the selector (its last compound, after the last combinator outside parentheses)
            // must be a module element
            String withoutGroups = selector.replaceAll("\\([^()]*\\)", "()");
            String[] compounds = withoutGroups.split("\\s*[>+~\\s]\\s*");
            String subject = compounds[compounds.length - 1];
            assertThat(MODULE_HOOK.matcher(subject).find()).as("selector subject must be a module element: " + selector).isTrue();
        }
    }

    @Test
    void injectedElementsAreResetAgainstSiteStyles() throws IOException {
        String css = css();

        assertThat(css).contains(":is(h1, h2, h3, h4, h5, h6) > button.heading-anchors-permalink.heading-anchors-permalink {\n    all: unset !important;")
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
