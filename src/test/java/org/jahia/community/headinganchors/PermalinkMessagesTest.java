package org.jahia.community.headinganchors;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
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

    @Test
    void bundlesAreEncodedInIso88591() throws IOException {
        try (InputStream in = PermalinkMessagesTest.class.getResourceAsStream("/org/jahia/community/headinganchors/messages_fr.properties")) {
            byte[] bytes = in.readAllBytes();
            // "copi\u00e9": a single 0xE9 byte, not the UTF-8 sequence 0xC3 0xA9
            assertThat(indexOf(bytes, new byte[]{'p', 'i', (byte) 0xE9})).isGreaterThan(0);
            assertThat(indexOf(bytes, new byte[]{(byte) 0xC3, (byte) 0xA9})).isEqualTo(-1);
        }
    }

    private static int indexOf(byte[] bytes, byte[] pattern) {
        for (int i = 0; i <= bytes.length - pattern.length; i++) {
            int j = 0;
            while (j < pattern.length && bytes[i + j] == pattern[j]) {
                j++;
            }
            if (j == pattern.length) {
                return i;
            }
        }
        return -1;
    }
}
