package org.jahia.community.headinganchors;

import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;

/**
 * Texts of the permalink button and of the copy feedback, in the language of the rendered page
 * (WCAG 3.1.2: an English label on a French page would be read with the wrong pronunciation).
 * A value set in the configuration overrides the translations for every language.
 */
public final class PermalinkMessages {

    static final String BUNDLE = "org.jahia.community.headinganchors.messages";

    // No fallback to the JVM default locale: an unknown language must get the base (English) texts
    private static final ResourceBundle.Control NO_FALLBACK =
            ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES);

    private final String label;
    private final String copied;
    private final String fallback;

    public PermalinkMessages(String label, String copied, String fallback) {
        this.label = label;
        this.copied = copied;
        this.fallback = fallback;
    }

    public static PermalinkMessages forLocale(Locale locale, HeadingAnchorSettings settings) {
        ResourceBundle bundle = ResourceBundle.getBundle(BUNDLE, locale == null ? Locale.ENGLISH : locale,
                PermalinkMessages.class.getClassLoader(), NO_FALLBACK);
        return new PermalinkMessages(
                pick(settings.getPermalinkLabel(), bundle, "permalink.label"),
                pick(settings.getPermalinkCopiedMessage(), bundle, "permalink.copiedMessage"),
                pick(settings.getPermalinkFallbackMessage(), bundle, "permalink.fallbackMessage"));
    }

    private static String pick(String override, ResourceBundle bundle, String key) {
        if (override != null && !override.trim().isEmpty()) {
            return override;
        }
        try {
            return bundle.getString(key);
        } catch (MissingResourceException e) {
            return key;
        }
    }

    /**
     * @param headingText replaces {@code {0}} in the label
     */
    public String getLabel(String headingText) {
        return label.replace("{0}", headingText);
    }

    public String getCopied() {
        return copied;
    }

    public String getFallback() {
        return fallback;
    }
}
