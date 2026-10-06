# Product

## Register

product

## Users

Readers of documentation sites built with Jahia, first of all academy.jahia.com, and the Jahia support team.
They are in the middle of reading a long page and want to share or keep a link to one precise section: support
engineers pasting a link in a ticket, readers sending a section to a colleague, editors linking pages together.
Visitors of other Jahia sites (customer sites, Digitall) use it the same way once the module is enabled there.

## Product Purpose

Heading Anchors gives every heading of a rendered page a stable, readable anchor, whatever the template or the
component used, and optionally a "copy link" button next to each heading with a confirmation toast. Success: a
reader gets a working link to the exact section in one action, and the site looks exactly as before for everyone
who does not use the feature.

## Brand Personality

Quiet, precise, trustworthy. The component is a guest in someone else's site: it inherits the host theme (color,
font), stays invisible until needed, and never draws attention away from the content. Its only voice is the short
confirmation that the link was copied.

## Anti-references

- Heavy "share" widgets, floating social bars, tooltips that stay on screen.
- Link icons permanently displayed next to every heading, cluttering long documentation pages.
- Components imposing their own brand colors, fonts or shadows on the host site.
- Toasts that cover content, steal focus, or need to be dismissed.

## Design Principles

1. Guest, not host: inherit the site theme, never restyle site elements.
2. Invisible until useful: reveal on hover or focus, always reachable by keyboard and on touch.
3. One action, one confirmation: copy, then a brief, non-blocking message.
4. Same quality in every language and script: texts in the page language, readable anchors.
5. Accessible by construction: WCAG 2.2 AA is a requirement, not a polish step.

## Accessibility & Inclusion

WCAG 2.2 AA in live and preview, checked by automated tests (axe-core) and targeted tests: keyboard access,
visible focus, 24x24px targets, status messages, reflow at 320px, focus not obscured, page language for texts.
Reduced motion and forced colors (Windows high contrast) are supported.
