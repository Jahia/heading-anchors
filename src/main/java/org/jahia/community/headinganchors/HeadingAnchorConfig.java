package org.jahia.community.headinganchors;

import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;

/**
 * Karaf configuration, PID {@value HeadingAnchorFilter#PID}.
 * A method name with an underscore maps to a dotted key (e.g. {@code permalink_enabled} is {@code permalink.enabled}).
 */
@ObjectClassDefinition(name = "Heading anchors", description = "Adds slug-based anchors to page headings")
public @interface HeadingAnchorConfig {

    @AttributeDefinition(description = "Enable the filter")
    boolean enabled() default true;

    @AttributeDefinition(description = "Comma-separated site keys; empty means all sites")
    String sites() default "";

    @AttributeDefinition(description = "Comma-separated render modes (live, preview, edit)")
    String modes() default "live,preview";

    @AttributeDefinition(description = "Comma-separated heading tags to process")
    String headings() default "h1,h2,h3,h4,h5";

    @AttributeDefinition(description = "Ordered, comma-separated scope selectors (tag, #id, .class, tag#id, tag.class). "
            + "The first selector matching at least one element is used.")
    String scope() default "main,body";

    @AttributeDefinition(description = "heading: id on the heading (existing id kept); anchor: empty <a id> inserted in the heading")
    String mode() default "heading";

    @AttributeDefinition(description = "CSS class of the injected <a> in anchor mode")
    String anchor_class() default "heading-anchor";

    @AttributeDefinition(description = "Also set the legacy name attribute on the injected <a> in anchor mode")
    boolean anchor_name() default false;

    @AttributeDefinition(description = "Add a copy-permalink button next to each heading")
    boolean permalink_enabled() default false;

    @AttributeDefinition(description = "Accessible label of the permalink button, {0} is replaced by the heading text")
    String permalink_label() default "Copy link to section: {0}";

    @AttributeDefinition(description = "Message announced when the link is copied")
    String permalink_copiedMessage() default "Link copied to clipboard";

    @AttributeDefinition(description = "Message announced when the clipboard is not available")
    String permalink_fallbackMessage() default "Link is in the address bar";

    @AttributeDefinition(description = "scroll-margin-top applied to anchored headings, e.g. 120px or 6rem; empty keeps the CSS default")
    String scrollMarginTop() default "";
}
