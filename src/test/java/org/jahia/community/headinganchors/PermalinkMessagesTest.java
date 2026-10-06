package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class PermalinkMessagesTest {

    @Test
    void usesThePageLanguage() {
        PermalinkMessages fr = PermalinkMessages.forLocale(Locale.FRENCH, new HeadingAnchorSettings());
        assertThat(fr.getLabel("Cycle de vie")).isEqualTo("Copier le lien vers la section : Cycle de vie");
        assertThat(fr.getCopied()).isEqualTo("Lien copié dans le presse-papiers");
        assertThat(fr.getFallback()).isEqualTo("Le lien est dans la barre d'adresse");

        PermalinkMessages de = PermalinkMessages.forLocale(Locale.GERMANY, new HeadingAnchorSettings());
        assertThat(de.getCopied()).isEqualTo("Link in die Zwischenablage kopiert");
    }

    @Test
    void fallsBackToEnglishWhateverTheJvmLocale() {
        Locale previous = Locale.getDefault();
        try {
            Locale.setDefault(Locale.FRENCH);
            PermalinkMessages ja = PermalinkMessages.forLocale(Locale.JAPANESE, new HeadingAnchorSettings());
            assertThat(ja.getLabel("Intro")).isEqualTo("Copy link to section: Intro");
            assertThat(PermalinkMessages.forLocale(null, new HeadingAnchorSettings()).getCopied()).isEqualTo("Link copied to clipboard");
        } finally {
            Locale.setDefault(previous);
        }
    }

    @Test
    void configurationOverridesTheTranslations() {
        HeadingAnchorSettings settings = new HeadingAnchorSettings().setPermalinkLabel("Lien : {0}").setPermalinkCopiedMessage("Copié");

        PermalinkMessages messages = PermalinkMessages.forLocale(Locale.GERMAN, settings);

        assertThat(messages.getLabel("A")).isEqualTo("Lien : A");
        assertThat(messages.getCopied()).isEqualTo("Copié");
        assertThat(messages.getFallback()).isEqualTo("Der Link steht in der Adressleiste");
    }
}
