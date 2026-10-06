# Heading Anchors

[![Jahia 8.2.1+](https://img.shields.io/badge/Jahia-8.2.1%2B-blue)](https://www.jahia.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Jahia Store](https://img.shields.io/badge/Jahia%20Store-heading--anchors-brightgreen)](https://store.jahia.com/contents/modules-repository/org/jahia/community/heading-anchors.html)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2%20AA-005a9c)](https://www.w3.org/TR/WCAG22/)

Jahia module that adds slug-based anchors to the headings of rendered pages, so that any section can be linked
directly (for example `/customer-center.html#jahia-lifecycle`), whatever the template or the component used.
It can optionally add a "copy link" button next to each heading.

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
- the filter only applies to sites on which the module is enabled (site settings > modules), and only in the
  configured render modes (live and preview by default). It never breaks the rendering: on error, the original
  HTML is returned

### Slugs

HTML only requires an id to be non-empty, unique and without ASCII whitespace. Slugs are kept URL-friendly:

- Latin text: accents and punctuation removed, spaces replaced by `-`, lower case. Same ids as the academy
  `toc.min.js`, so links already shared keep working (`Évolution du produit` gives `evolution-du-produit`)
- letters without decomposition and transliterable scripts (Cyrillic, Greek, Arabic, Armenian, Georgian) use the
  Jahia character map, the one used for node system names (`Straße` gives `strasse`, `Жизненный цикл` gives
  `zhiznennyi-cikl`)
- scripts without transliteration (Chinese, Japanese, Korean, Hebrew, Thai, Devanagari...) keep their letters, which
  HTML allows: `生命周期` gives `生命周期`. The copied permalink is percent-encoded, browsers display it readable
- a heading without any letter or digit gets `section`, `section_1`...

Node system names are not used: a heading rendered from rich text has no node of its own, and the filter only sees
the HTML of the page.

## Configuration

The file `org.jahia.community.headinganchors.cfg` is copied once into `karaf/etc` and can then be edited there:
it starts with `# default configuration`, so redeploying the module never overwrites it.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Enable the filter globally (per site: enable the module on the site) |
| `modes` | `live,preview` | Render modes where anchors are added |
| `headings` | `h1,h2,h3,h4,h5` | Heading tags to process |
| `scope` | `main,body` | Ordered selectors (`tag`, `#id`, `.class`, `tag#id`, `tag.class`); the first one matching at least one element is used |
| `mode` | `heading` | `heading`: id set on the heading; `anchor`: empty `<a id>` always inserted as first child of the heading |
| `existingId` | `keep` | `heading` mode, heading with an id different from its slug. `keep`: the id is used; `anchor`: the slug is also added with an empty `<a id>` |
| `anchor.class` | `heading-anchors-target` | CSS class of the injected `<a>` |
| `anchor.name` | `false` | Also set the legacy `name` attribute on the injected `<a>` |
| `permalink.enabled` | `false` | Add a copy-permalink button next to each heading |
| `permalink.label` | (empty) | Accessible label of the button, `{0}` is the heading text. Empty: translated |
| `permalink.copiedMessage` | (empty) | Message shown after the copy. Empty: translated |
| `permalink.fallbackMessage` | (empty) | Message shown when the clipboard is not available. Empty: translated |
| `scrollMarginTop` | (empty) | `scroll-margin-top` of anchored headings, e.g. `120px` for a sticky header (default `1rem`) |

The button label and the messages are translated in the language of the page (English, French, German; other
languages get English). A value in the configuration overrides the translations for every language.

## Theming

The theme can use these CSS custom properties:

| Property | Default |
|---|---|
| `--heading-anchors-scroll-margin` | `1rem` |
| `--heading-anchors-toast-background` | `#1f1f1f` |
| `--heading-anchors-toast-color` | `#fff` |
| `--heading-anchors-toast-font-size` | `1em` |

## Isolation from the site styles

The stylesheet is loaded on every page where anchors are added, so it is written not to interfere with the site:

- every selector targets an element injected or marked by the module (`data-heading-anchors`, `heading-anchors-*`
  classes, `#heading-anchors-status`), never a site element. `HeadingAnchorCssTest` fails the build otherwise
- the injected button and toast start from `all: unset` with strong selectors and `!important` declarations, so
  site rules (`button`, `div`, `span`..., even with `!important`) do not change them. Only a site rule combining an
  id selector and `!important` on these elements could still win
- with `permalink.enabled=true`, the heading is wrapped in a `div.heading-anchors-wrap` to place the button next to
  it: site selectors relying on the direct parent or siblings of the heading (`.box > h2`, `h2 + p`) may need to be
  adapted. Without the permalink, the page structure is unchanged

## Accessibility (WCAG 2.2 AA)

Checked by the Cypress tests, including an axe-core audit (WCAG 2.0, 2.1 and 2.2 A/AA rules) of the injected
elements, in preview and live:

- the id is set on the heading itself: the fragment target and the sequential focus starting point are the heading
- the permalink is a `<button>` placed after the heading, not inside it, so the heading name is unchanged (1.3.1),
  with an `aria-label` containing the heading text (4.1.2, 2.5.3), in the page language (3.1.2)
- the button is visible on hover, on keyboard focus (2.1.1, 2.4.7) and always on touch devices, never hidden with
  `display: none`; minimum target size 24x24px (2.5.8); focus outline with the text color (1.4.11)
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

Unit tests run with the build. End-to-end tests (Cypress, Jahia in Docker) are in `tests/`, see `tests/README.md`.
A Jahia license is needed: put it base64-encoded in `JAHIA_LICENSE` in `tests/.env` (git-ignored).

## Release

Before releasing, move the `[Unreleased]` entries of `CHANGELOG.md` to a new `[X.Y.Z] - YYYY-MM-DD` section.
The tag must have the format `X_X_X`:

```bash
mvn -Dresume=false -DdryRun=false -Dtag=1_0_0 release:prepare
```
