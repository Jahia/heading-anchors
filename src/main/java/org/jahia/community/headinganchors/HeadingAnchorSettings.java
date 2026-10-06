package org.jahia.community.headinganchors;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Immutable-by-convention settings consumed by {@link HeadingAnchorProcessor}.
 */
public final class HeadingAnchorSettings {

    public enum Mode {
        /** Put the id on the heading itself; an existing id is kept. */
        HEADING,
        /** Insert an empty {@code <a id>} as first child of the heading. */
        ANCHOR
    }

    private List<String> headings = List.of("h1", "h2", "h3", "h4", "h5");
    private List<ScopeSelector> scopes = List.of(ScopeSelector.parse("main"), ScopeSelector.parse("body"));
    private Mode mode = Mode.HEADING;
    private String anchorClass = "heading-anchors-target";
    private boolean anchorName;
    private boolean anchorOnExistingId;
    private boolean adoptLegacyAnchors;
    private List<String> permalinkHeadings = List.of("h2", "h3", "h4", "h5");
    private boolean permalinkEnabled;
    // Empty: translated texts from the module resource bundle are used
    private String permalinkLabel = "";
    private String permalinkCopiedMessage = "";
    private String permalinkFallbackMessage = "";

    public List<String> getHeadings() {
        return headings;
    }

    public HeadingAnchorSettings setHeadings(List<String> headings) {
        this.headings = Collections.unmodifiableList(new ArrayList<>(headings));
        return this;
    }

    public List<ScopeSelector> getScopes() {
        return scopes;
    }

    public HeadingAnchorSettings setScopes(List<ScopeSelector> scopes) {
        this.scopes = Collections.unmodifiableList(new ArrayList<>(scopes));
        return this;
    }

    public Mode getMode() {
        return mode;
    }

    public HeadingAnchorSettings setMode(Mode mode) {
        this.mode = mode;
        return this;
    }

    public String getAnchorClass() {
        return anchorClass;
    }

    public HeadingAnchorSettings setAnchorClass(String anchorClass) {
        this.anchorClass = anchorClass;
        return this;
    }

    public boolean isAnchorName() {
        return anchorName;
    }

    public HeadingAnchorSettings setAnchorName(boolean anchorName) {
        this.anchorName = anchorName;
        return this;
    }

    public boolean isAnchorOnExistingId() {
        return anchorOnExistingId;
    }

    /**
     * @param anchorOnExistingId when a heading already has an id different from its slug, also add the slug
     *                           with an empty anchor inside the heading (the permalink then uses the slug)
     */
    public HeadingAnchorSettings setAnchorOnExistingId(boolean anchorOnExistingId) {
        this.anchorOnExistingId = anchorOnExistingId;
        return this;
    }

    public boolean isAdoptLegacyAnchors() {
        return adoptLegacyAnchors;
    }

    /**
     * @param adoptLegacyAnchors give the slug to the heading and remove it from a manual anchor of its section
     */
    public HeadingAnchorSettings setAdoptLegacyAnchors(boolean adoptLegacyAnchors) {
        this.adoptLegacyAnchors = adoptLegacyAnchors;
        return this;
    }

    public List<String> getPermalinkHeadings() {
        return permalinkHeadings;
    }

    /**
     * @param permalinkHeadings heading tags getting a permalink button (h1, the page title, is excluded by default)
     */
    public HeadingAnchorSettings setPermalinkHeadings(List<String> permalinkHeadings) {
        this.permalinkHeadings = Collections.unmodifiableList(new ArrayList<>(permalinkHeadings));
        return this;
    }

    public boolean isPermalinkEnabled() {
        return permalinkEnabled;
    }

    public HeadingAnchorSettings setPermalinkEnabled(boolean permalinkEnabled) {
        this.permalinkEnabled = permalinkEnabled;
        return this;
    }

    public String getPermalinkLabel() {
        return permalinkLabel;
    }

    public HeadingAnchorSettings setPermalinkLabel(String permalinkLabel) {
        this.permalinkLabel = permalinkLabel;
        return this;
    }

    public String getPermalinkCopiedMessage() {
        return permalinkCopiedMessage;
    }

    public HeadingAnchorSettings setPermalinkCopiedMessage(String permalinkCopiedMessage) {
        this.permalinkCopiedMessage = permalinkCopiedMessage;
        return this;
    }

    public String getPermalinkFallbackMessage() {
        return permalinkFallbackMessage;
    }

    public HeadingAnchorSettings setPermalinkFallbackMessage(String permalinkFallbackMessage) {
        this.permalinkFallbackMessage = permalinkFallbackMessage;
        return this;
    }

}
