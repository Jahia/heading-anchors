package org.jahia.community.headinganchors;

import org.jahia.services.content.decorator.JCRSiteNode;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.filter.AbstractFilter;
import org.jahia.services.render.filter.RenderChain;
import org.jahia.services.render.filter.RenderFilter;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Modified;
import org.osgi.service.metatype.annotations.Designate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Page-level render filter. Its priority is below the AggregateFilter (16), so it receives the fully
 * aggregated page and can guarantee unique ids across all fragments. Its output is not cached.
 * It must be registered as a {@link RenderFilter} service: that is the interface tracked by the Jahia OSGi registry.
 * It only applies to sites on which the module is enabled.
 */
@Component(service = RenderFilter.class, immediate = true, configurationPid = HeadingAnchorFilter.PID)
@Designate(ocd = HeadingAnchorConfig.class)
public class HeadingAnchorFilter extends AbstractFilter {

    public static final String PID = "org.jahia.community.headinganchors";

    private static final Logger logger = LoggerFactory.getLogger(HeadingAnchorFilter.class);

    static final String MODULE_ID = "heading-anchors";
    private static final String MODULE_PATH = "/modules/" + MODULE_ID;
    private static final Pattern HEADING_TAG = Pattern.compile("h[1-6]");

    private volatile boolean enabled;
    private volatile Set<String> modes = Set.of();
    private volatile HeadingAnchorSettings settings = new HeadingAnchorSettings();

    public HeadingAnchorFilter() {
        setPriority(3);
        setDescription("Adds slug-based anchors to page headings");
        setApplyOnConfigurations("page");
        setApplyOnTemplateTypes("html");
    }

    @Activate
    @Modified
    public void configure(HeadingAnchorConfig config) {
        List<ScopeSelector> scopes = new ArrayList<>();
        for (String raw : split(config.scope())) {
            ScopeSelector selector = ScopeSelector.parse(raw);
            if (selector == null) {
                logger.warn("Ignoring unsupported scope selector '{}'", raw);
            } else {
                scopes.add(selector);
            }
        }

        List<String> headings = headingTags(config.headings());
        List<String> permalinkHeadings = headingTags(config.permalink_headings());

        HeadingAnchorSettings.Mode mode = "anchor".equalsIgnoreCase(config.mode().trim())
                ? HeadingAnchorSettings.Mode.ANCHOR : HeadingAnchorSettings.Mode.HEADING;

        settings = new HeadingAnchorSettings()
                .setHeadings(headings)
                .setScopes(scopes)
                .setMode(mode)
                .setAnchorClass(config.anchor_class())
                .setAnchorName(config.anchor_name())
                .setAnchorOnExistingId("anchor".equalsIgnoreCase(config.existingId().trim()))
                .setAdoptLegacyAnchors("adopt".equalsIgnoreCase(config.legacyAnchors().trim()))
                .setPermalinkHeadings(permalinkHeadings)
                .setPermalinkEnabled(config.permalink_enabled())
                .setPermalinkLabel(config.permalink_label())
                .setPermalinkCopiedMessage(config.permalink_copiedMessage())
                .setPermalinkFallbackMessage(config.permalink_fallbackMessage());
        modes = Set.copyOf(split(config.modes()));
        enabled = config.enabled() && !headings.isEmpty() && !scopes.isEmpty();
        logger.info("Heading anchors configured: enabled={}, modes={}, headings={}, scope={}, mode={}, permalink={}",
                enabled, modes, headings, scopes, mode, config.permalink_enabled());
    }

    @Override
    public String execute(String previousOut, RenderContext renderContext, Resource resource, RenderChain chain) throws Exception {
        if (!enabled || previousOut == null || previousOut.isEmpty()) {
            return previousOut;
        }
        if (!modes.isEmpty() && !modes.contains(renderContext.getMode())) {
            return previousOut;
        }
        if (!isEnabledOnSite(renderContext.getSite())) {
            return previousOut;
        }

        String moduleUrl = renderContext.getRequest().getContextPath() + MODULE_PATH;
        try {
            HeadingAnchorSettings current = settings;
            PermalinkMessages messages = PermalinkMessages.forLocale(renderContext.getMainResourceLocale(), current);
            HeadingAnchorProcessor processor = new HeadingAnchorProcessor(current, messages,
                    moduleUrl + "/css/heading-anchors.css", moduleUrl + "/javascript/heading-anchors.js");
            String out = processor.process(previousOut);
            if (logger.isDebugEnabled()) {
                processor.getNotices().forEach(notice -> logger.debug("{}: {}", resource.getPath(), notice));
            }
            return out;
        } catch (RuntimeException e) {
            // Never break page rendering because of anchors
            logger.warn("Unable to add heading anchors on {}: {}", resource.getPath(), e.getMessage());
            logger.debug("Heading anchors failure", e);
            return previousOut;
        }
    }

    /**
     * The render context already holds the site of the main resource, no extra JCR lookup is needed.
     * Installed modules are read from the site node, which Jahia keeps in its node cache.
     */
    static boolean isEnabledOnSite(JCRSiteNode site) {
        return site != null && site.getInstalledModules().contains(MODULE_ID);
    }

    private static List<String> headingTags(String value) {
        List<String> tags = new ArrayList<>();
        for (String tag : split(value)) {
            String normalized = tag.toLowerCase(Locale.ROOT);
            if (HEADING_TAG.matcher(normalized).matches()) {
                tags.add(normalized);
            } else {
                logger.warn("Ignoring unsupported heading tag '{}'", tag);
            }
        }
        return tags;
    }

    private static List<String> split(String value) {
        if (value == null || value.trim().isEmpty()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
