# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Release tags use the `X_X_X` format (e.g. `1_0_0`).

## [Unreleased]

## [1.0.0] - 2026-10-06

First release.

### Added

- Page-level render filter adding slug-based anchors to page headings (`h1` to `h5` by default), so that any
  section can be linked directly (`page.html#jahia-lifecycle`), whatever the template or the component used.
  It processes the fully aggregated page, so ids are unique across all its fragments.
- Per-site activation: the filter only applies to sites on which the module is enabled.
- Karaf configuration `org.jahia.community.headinganchors.cfg`, kept on module redeployment: render modes,
  heading levels, scope selectors (`tag`, `#id`, `.class`, `tag#id`, `tag.class`), `heading` or `anchor` mode,
  handling of existing ids.
- Headings reached by a link stop below the sticky or fixed header of the site: its height is measured in the
  browser, per site and per template, without configuration (`--heading-anchors-scroll-margin` still overrides it).
- Slugs compatible with the academy `toc.min.js` for Latin text, transliteration with the Jahia character map
  (Cyrillic, Greek, Arabic, Armenian, Georgian), letters kept for scripts without transliteration (CJK, Hebrew,
  Thai, Devanagari...). Duplicates get a `_1`, `_2`... suffix.
- Existing ids are kept and used by the permalink; a duplicated id gets its own unique anchor.
- Manual anchors typed below a heading are kept by default; `legacyAnchors=adopt` lets the heading take their slug.
- Optional copy-link button inside each heading (`h2` to `h5` by default), with a tooltip and a toast confirming the
  copy. Texts translated in English, French and German, overridable in the configuration.
- Theming with the `--heading-anchors-*` CSS custom properties.

### Accessibility

- WCAG 2.2 AA: button with a short accessible name in the page language, visible on keyboard focus and on touch
  devices, 24x24px minimum target, tooltip dismissible with Escape, toast used as the `role="status"` live region,
  reflow at 320px, focus never obscured by the toast, reduced motion and forced colors support.

### Security

- The page structure and layout are never changed (no wrapper, the button never makes a heading taller), the
  stylesheet only targets elements injected or marked by the module, and injected elements are isolated from the
  site styles (`all: unset`, `!important` declarations).
- All injected attribute values are HTML-escaped.

[Unreleased]: https://github.com/Jahia/heading-anchors/compare/1_0_0...HEAD
[1.0.0]: https://github.com/Jahia/heading-anchors/releases/tag/1_0_0
