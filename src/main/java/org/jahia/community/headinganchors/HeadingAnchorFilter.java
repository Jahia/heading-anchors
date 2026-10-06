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
 */
@Component(service = RenderFilter.class, immediate = true, configurationPid = HeadingAnchorFilter.PID)
@Designate(ocd = HeadingAnchorConfig.class)
public class HeadingAnchorFilter extends AbstractFilter {

    public static final String PID = "org.jahia.community.headinganchors";

    private static final Logger logger = LoggerFactory.getLogger(HeadingAnchorFilter.class);

    private static final String MODULE_PATH = "/modules/heading-anchors";
    private static final Pattern HEADING_TAG = Pattern.compile("h[1-6]");
    private static final Pattern CSS_LENGTH = Pattern.compile("^\\d+(\\.\\d+)?(px|rem|em|vh)$");

    private volatile boolean enabled;
    private volatile Set<String> sites = Set.of();
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

        List<String> headings = new ArrayList<>();
        for (String tag : split(config.headings())) {
            String normalized = tag.toLowerCase(Locale.ROOT);
            if (HEADING_TAG.matcher(normalized).matches()) {
                headings.add(normalized);
            } else {
                logger.warn("Ignoring unsupported heading tag '{}'", tag);
            }
        }

        String scrollMarginTop = config.scrollMarginTop() == null ? "" : config.scrollMarginTop().trim();
        if (!scrollMarginTop.isEmpty() && !CSS_LENGTH.matcher(scrollMarginTop).matches()) {
            logger.warn("Ignoring invalid scrollMarginTop '{}'", scrollMarginTop);
            scrollMarginTop = "";
        }

        HeadingAnchorSettings.Mode mode = "anchor".equalsIgnoreCase(config.mode().trim())
                ? HeadingAnchorSettings.Mode.ANCHOR : HeadingAnchorSettings.Mode.HEADING;

        settings = new HeadingAnchorSettings()
                .setHeadings(headings)
                .setScopes(scopes)
                .setMode(mode)
                .setAnchorClass(config.anchor_class())
                .setAnchorName(config.anchor_name())
                .setPermalinkEnabled(config.permalink_enabled())
                .setPermalinkLabel(config.permalink_label())
                .setPermalinkCopiedMessage(config.permalink_copiedMessage())
                .setPermalinkFallbackMessage(config.permalink_fallbackMessage())
                .setScrollMarginTop(scrollMarginTop);
        sites = Set.copyOf(split(config.sites()));
        modes = Set.copyOf(split(config.modes()));
        enabled = config.enabled() && !headings.isEmpty() && !scopes.isEmpty();
        logger.info("Heading anchors configured: enabled={}, sites={}, modes={}, headings={}, scope={}, mode={}, permalink={}",
                enabled, sites, modes, headings, scopes, mode, config.permalink_enabled());
    }

    @Override
    public String execute(String previousOut, RenderContext renderContext, Resource resource, RenderChain chain) throws Exception {
        if (!enabled || previousOut == null || previousOut.isEmpty()) {
            return previousOut;
        }
        if (!modes.isEmpty() && !modes.contains(renderContext.getMode())) {
            return previousOut;
        }
        if (!sites.isEmpty()) {
            JCRSiteNode site = renderContext.getSite();
            if (site == null || !sites.contains(site.getSiteKey())) {
                return previousOut;
            }
        }

        String moduleUrl = renderContext.getRequest().getContextPath() + MODULE_PATH;
        try {
            return new HeadingAnchorProcessor(settings, moduleUrl + "/css/heading-anchors.css",
                    moduleUrl + "/javascript/heading-anchors.js").process(previousOut);
        } catch (RuntimeException e) {
            // Never break page rendering because of anchors
            logger.warn("Unable to add heading anchors on {}: {}", resource.getPath(), e.getMessage());
            logger.debug("Heading anchors failure", e);
            return previousOut;
        }
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
