# Heading Anchors

Jahia module that adds slug-based anchors to the headings of rendered pages, so that any section can be linked
directly (for example `/customer-center.html#jahia-lifecycle`), whatever the template or the component used.
It can optionally add a "copy link" button next to each heading.

## How it works

A page-level render filter processes the fully aggregated HTML of the page (priority 3, below the aggregation
filter), so ids are unique across all the fragments of the page:

- each configured heading (`h1` to `h5` by default) inside the configured scope gets an `id` built from its text
  (`Jahia lifecycle` gives `jahia-lifecycle`)
- existing ids are kept, duplicates get a `_1`, `_2`... suffix
- the slug algorithm is the same as the academy `toc.min.js`, so ids previously generated in the browser are unchanged
- the filter only runs in the configured render modes (live and preview by default), never breaks the rendering:
  on error, the original HTML is returned

## Configuration

The file `org.jahia.community.headinganchors.cfg` is copied once into `karaf/etc` and can then be edited there.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | Enable the filter |
| `sites` | (empty) | Comma-separated site keys, empty means all sites |
| `modes` | `live,preview` | Render modes where anchors are added |
| `headings` | `h1,h2,h3,h4,h5` | Heading tags to process |
| `scope` | `main,body` | Ordered selectors (`tag`, `#id`, `.class`, `tag#id`, `tag.class`); the first one matching at least one element is used |
| `mode` | `heading` | `heading`: id set on the heading; `anchor`: empty `<a id>` inserted as first child of the heading |
| `anchor.class` | `heading-anchor` | CSS class of the injected `<a>` in `anchor` mode |
| `anchor.name` | `false` | Also set the legacy `name` attribute on the injected `<a>` |
| `permalink.enabled` | `false` | Add a copy-permalink button next to each heading |
| `permalink.label` | `Copy link to section: {0}` | Accessible label of the button, `{0}` is the heading text |
| `permalink.copiedMessage` | `Link copied to clipboard` | Message announced to screen readers after the copy |
| `permalink.fallbackMessage` | `Link is in the address bar` | Message announced when the clipboard is not available |
| `scrollMarginTop` | (empty) | `scroll-margin-top` of anchored headings, e.g. `120px` for a sticky header (default `1rem`) |

The theme can also override the CSS variable `--heading-anchors-scroll-margin`.

## Accessibility

- The id is set on the heading itself by default: no extra node, the fragment target is the heading.
- The permalink is a `<button>` placed after the heading (not inside it, so the heading name is unchanged), with an
  `aria-label` containing the heading text. It is visible on hover, on keyboard focus and always on touch devices,
  with a 24x24px minimum target size.
- The copy result is announced through a single `role="status"` region.

## Build

```bash
mvn clean install
```

## Release

The tag must have the format `X_X_X`:

```bash
mvn -Dresume=false -DdryRun=false -Dtag=1_0_0 release:prepare
```
