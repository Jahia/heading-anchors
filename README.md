# Heading Anchors

[![Jahia 8.2.1+](https://img.shields.io/badge/Jahia-8.2.1%2B-blue)](https://www.jahia.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Jahia Store](https://img.shields.io/badge/Jahia%20Store-heading--anchors-brightgreen)](https://store.jahia.com/contents/modules-repository/org/jahia/community/heading-anchors.html)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2%20AA-005a9c)](https://www.w3.org/TR/WCAG22/)

Jahia module that adds slug-based anchors to the headings of rendered pages, so that any section can be linked
directly (for example `/customer-center.html#jahia-lifecycle`), whatever the template or the component used.
It can optionally add a "copy link" button to each heading.

## Requirements

- Jahia 8.2.1 or later, on JDK 11.0.13+ or JDK 17 (see the [supported stack](https://academy.jahia.com/downloads/supported-stack))

## Installation and usage

1. Deploy the module (Jahia Store, or the `heading-anchors-<version>.jar` in **Administration > Modules**).
2. Enable it on each site that should get anchors (**Site settings > Modules**, or the provisioning API
   `- enable: "heading-anchors"` / `site: "<siteKey>"`). Sites where the module is not enabled are never changed.
3. Headings now have ids: `page.html#section-title` links to the section.
4. Optionally, adapt the configuration (see below), for example to add the copy-link button (`permalink.enabled=true`)
   or to keep headings below a sticky header (`scrollMarginTop=120px`). Changes apply immediately, without restart:
   - **Felix web console**: **Administration > Tools > OSGi console > Configuration > Heading anchors**
     (`/tools/osgi/console/configMgr`), edit the values and **Save**
   - **file**: `karaf/etc/org.jahia.community.headinganchors.cfg`
   - **provisioning API**: `- editConfiguration: "org.jahia.community.headinganchors"` with `properties`

## How it works

A page-level render filter processes the fully aggregated HTML of the page (priority 3, below the aggregation
filter), so ids are unique across all the fragments of the page:

- each configured heading (`h1` to `h5` by default) inside the configured scope gets an `id` built from its text
  (`Jahia lifecycle` gives `jahia-lifecycle`), and a `data-heading-anchors` marker attribute
- two headings with the same text get `overview`, `overview_1`, `overview_2`...; generated ids never collide with
  an id already present in the page
- an id already set on a heading (e.g. typed by the editor) is kept and used by the permalink. With
  `existingId=anchor`, the slug is also added with an empty `<a id>` inside the heading
- a duplicated id (two elements with `id="faq"`) cannot be reached by a link: the second heading keeps its id and
  gets its own unique anchor (`faq_1`)
- a manual anchor typed in the text below a heading (an empty `<a id="jahia-lifecycle">` without href, the usual
  workaround) is kept untouched by default: the heading then gets a suffixed slug (`jahia-lifecycle_1`). Remove the
  manual anchor from the content to get the plain slug, or set `legacyAnchors=adopt` to let the heading take the
  slug (the manual anchor loses its id, so existing links reach the heading). These cases are logged at DEBUG level
  (`log:set DEBUG org.jahia.community.headinganchors` in the Karaf console)
- the filter only applies to sites on which the module is enabled, and only in the configured render modes (live
  and preview by default). It never breaks the rendering: on error, the original HTML is returned

### Slugs

HTML only requires an id to be non-empty, unique and without ASCII whitespace. Slugs are kept URL-friendly:

- Latin text: lower case, accents and punctuation removed, spaces replaced by `-` (`Évolution du produit` gives
  `evolution-du-produit`)
- letters without decomposition and transliterable scripts (Cyrillic, Greek, Arabic, Armenian, Georgian) use the
  Jahia character map, the one used for node system names (`Straße` gives `strasse`, `Жизненный цикл` gives
  `zhiznennyi-cikl`)
- scripts without transliteration (Chinese, Japanese, Korean, Hebrew, Thai, Devanagari...) keep their letters, which
  HTML allows: `生命周期` gives `生命周期`. The copied permalink is percent-encoded, browsers display it readable
- a heading without any letter or digit gets `section`, `section_1`...

For most Latin headings, the ids are the same as the ones generated in the browser by the academy `toc.min.js`.
They differ when a heading ends with punctuation after a space (`Why migrate ?` gives `why-migrate`, the script
gives `why-migrate-`) or contains letters without decomposition (`Straße` gives `strasse`, the script gives
`strae`): links to such sections built from the script ids must be updated.

Node system names are not used: a heading rendered from rich text has no node of its own, and the filter only sees
the HTML of the page.

## Configuration

The file `org.jahia.community.headinganchors.cfg` is copied once into `karaf/etc` and can then be edited there:
it starts with `# default configuration`, so redeploying the module never overwrites it.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Enable the filter globally (per site: enable the module on the site) |
| `modes` | `live,preview` | Render modes where anchors are added |
| `headings` | `h1,h2,h3,h4,h5` | Heading tags getting an id |
| `scope` | `main,body` | Ordered selectors (`tag`, `#id`, `.class`, `tag#id`, `tag.class`); the first one matching at least one element is used |
| `mode` | `heading` | `heading`: id set on the heading; `anchor`: empty `<a id>` always inserted as first child of the heading |
| `existingId` | `keep` | `heading` mode, heading with an id different from its slug. `keep`: the id is used; `anchor`: the slug is also added with an empty `<a id>` |
| `legacyAnchors` | `keep` | Manual anchor holding the slug in the section of a heading without id. `keep`: kept, the heading gets a suffixed slug; `adopt`: the heading takes the slug |
| `anchor.class` | `heading-anchors-target` | CSS class of the injected `<a>` |
| `anchor.name` | `false` | Also set the legacy `name` attribute on the injected `<a>` |
| `permalink.enabled` | `false` | Add a copy-link button to each heading |
| `permalink.headings` | `h2,h3,h4,h5` | Heading tags getting the button (`h1`, the page title, is excluded by default) |
| `permalink.label` | (empty) | Label of the button, also shown as tooltip; `{0}` is the heading text. Empty: translated |
| `permalink.copiedMessage` | (empty) | Message shown after the copy. Empty: translated |
| `permalink.fallbackMessage` | (empty) | Message shown when the clipboard is not available. Empty: translated |
| `scrollMarginTop` | (empty) | `scroll-margin-top` of anchored headings, e.g. `120px` for a sticky header (default `1rem`) |

The button label ("Copy link") and the messages are translated in the language of the page (English, French,
German; other languages get English). A value in the configuration overrides the translations for every language.

## Theming

The theme can use these CSS custom properties:

| Property | Default |
|---|---|
| `--heading-anchors-scroll-margin` | `1rem` |
| `--heading-anchors-toast-background` | `#1f1f1f` (toast and tooltip) |
| `--heading-anchors-toast-color` | `#fff` (toast and tooltip) |
| `--heading-anchors-toast-font-size` | `1em` |
| `--heading-anchors-tooltip-font-size` | `0.875rem` |

## Isolation from the site styles

The stylesheet is loaded on every page where anchors are added, so it is written not to interfere with the site:

- the page structure is never changed: the button is the last child of its heading, without wrapper, so site
  selectors such as `.box > h2` or `p + h2` keep working. Its glyph is CSS generated content, so the heading text
  read by table of contents scripts is unchanged, and it never makes a heading taller. Cypress checks that the
  position and size of every heading are the same with and without the button
- every selector targets an element injected or marked by the module (`data-heading-anchors`, `heading-anchors-*`
  classes, `#heading-anchors-status`), never a site element. `HeadingAnchorCssTest` fails the build otherwise
- the injected button and toast start from `all: unset` with strong selectors and `!important` declarations, so
  site rules (`button`, `div`..., even with `!important`) do not change them. Only a site rule combining an id
  selector and `!important` on these elements could still win

## Accessibility (WCAG 2.2 AA)

Checked by the Cypress tests, including an axe-core audit of the injected elements (WCAG 2.0, 2.1 and 2.2 A/AA
rules) in preview, and a check of the live rendering:

- the id is set on the heading itself: the fragment target and the sequential focus starting point are the heading
- the permalink is a `<button>` inside the heading (valid HTML), with a short accessible name in the page language
  ("Copy link", 4.1.2, 3.1.2): screen readers announce the heading as "Jahia lifecycle, Copy link"
- the button is visible on hover, on keyboard focus (2.1.1, 2.4.7) and always on touch devices, never hidden with
  `display: none`; minimum target size 24x24px (2.5.8); focus outline with the text color (1.4.11)
- a tooltip shows the accessible name (2.5.3) on hover and keyboard focus; it stays while the pointer is over it
  and is dismissed with Escape (1.4.13)
- the copy result is shown in a toast that is also the single `role="status"` live region (4.1.3): no focus move,
  never blocks clicks, displayed 5 seconds, wraps its text and fits a 320px wide screen (1.4.10, 1.4.12), moves to
  the top of the screen when it would cover the focused button (2.4.11), honors `prefers-reduced-motion` and forced
  colors
- if the clipboard is not available, the URL is put in the address bar and announced

## Build

```bash
mvn clean install
```

## Tests

Unit tests run with the build. End-to-end tests (Cypress, Jahia in Docker) are in `tests/`, see
[`tests/README.md`](tests/README.md).

## Release

1. Move the `[Unreleased]` entries of `CHANGELOG.md` to a new `[X.Y.Z] - YYYY-MM-DD` section (pull request).
2. Prepare the release. The tag must have the format `X_X_X`. The plugin pushes the release commits and the tag to
   `main`, which is protected: run it with an account allowed to bypass the protection (repository admin).

   ```bash
   mvn -Dresume=false -DdryRun=false -Dtag=1_0_0 release:prepare
   ```
