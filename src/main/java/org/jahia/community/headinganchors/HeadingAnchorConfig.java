package org.jahia.community.headinganchors;

import org.osgi.service.metatype.annotations.AttributeDefinition;
import org.osgi.service.metatype.annotations.ObjectClassDefinition;
import org.osgi.service.metatype.annotations.Option;

/**
 * Karaf configuration, PID {@value HeadingAnchorFilter#PID}.
 * A method name with an underscore maps to a dotted key (e.g. {@code permalink_enabled} is {@code permalink.enabled}).
 */
@ObjectClassDefinition(name = "Heading anchors", description = "Adds slug-based anchors to page headings")
public @interface HeadingAnchorConfig {

    @AttributeDefinition(description = "Enable the filter")
    boolean enabled() default true;

    @AttributeDefinition(description = "Comma-separated render modes (live, preview, edit)")
    String modes() default "live,preview";

    @AttributeDefinition(description = "Comma-separated heading tags to process")
    String headings() default "h1,h2,h3,h4,h5";

    @AttributeDefinition(description = "Ordered, comma-separated scope selectors (tag, #id, .class, tag#id, tag.class). "
            + "The first selector matching at least one element is used.")
    String scope() default "main,body";

    @AttributeDefinition(description = "heading: id on the heading (existing id kept); anchor: empty <a id> inserted in the heading",
            options = {@Option(label = "Id on the heading", value = "heading"), @Option(label = "Empty anchor in the heading", value = "anchor")})
    String mode() default "heading";

    @AttributeDefinition(description = "Heading mode, heading with an id different from its slug. keep: the id is kept "
            + "and used by the permalink; anchor: the id is kept and the slug is added with an empty <a> in the heading",
            options = {@Option(label = "Keep the existing id", value = "keep"), @Option(label = "Also add the slug", value = "anchor")})
    String existingId() default "keep";

    @AttributeDefinition(description = "Manual anchor (empty <a id> without href) in the section of a heading without id, "
            + "holding the heading slug. keep: the anchor is kept and the heading gets a suffixed slug; "
            + "adopt: the heading takes the slug and the anchor loses its id",
            options = {@Option(label = "Keep the manual anchor", value = "keep"), @Option(label = "Heading adopts the slug", value = "adopt")})
    String legacyAnchors() default "keep";

    @AttributeDefinition(description = "CSS class of the injected <a>")
    String anchor_class() default "heading-anchors-target";

    @AttributeDefinition(description = "Also set the legacy name attribute on the injected <a> in anchor mode")
    boolean anchor_name() default false;

    @AttributeDefinition(description = "Add a copy-link button to each heading")
    boolean permalink_enabled() default false;

    @AttributeDefinition(description = "Comma-separated heading tags getting a permalink button (subset of headings)")
    String permalink_headings() default "h2,h3,h4,h5";

    @AttributeDefinition(description = "Label of the permalink button, also shown as tooltip; {0} is replaced by the heading "
            + "text. Empty: translated in the page language (en, fr, de). A value overrides it for every language.")
    String permalink_label() default "";

    @AttributeDefinition(description = "Message shown when the link is copied. Empty: translated in the page language.")
    String permalink_copiedMessage() default "";

    @AttributeDefinition(description = "Message shown when the clipboard is not available. Empty: translated in the page language.")
    String permalink_fallbackMessage() default "";

    @AttributeDefinition(description = "scroll-margin-top applied to anchored headings, e.g. 120px or 6rem; empty keeps the CSS default")
    String scrollMarginTop() default "";
}
