# Anya — Little Universe

Self-contained card artwork. No framework, package installation, external resources, or network requests.

## Files
- `card.gif` — looping animated image, 360 × 520, 32 frames, under 1.9 MB. Use this if the competition accepts GIFs.
- `card.svg` — scalable, animated SVG artwork. Use this if SVG is permitted.
- `index.html` — standalone interactive demo with pointer-based tilt and shine. Open it directly in a browser; artwork is embedded.
- `preview.png` — static preview.

## Safe integration
The target repository and its required folder schema were not supplied. Do not replace its existing `index.html`, application files, package manifest, or other participants' folders with these files. Inspect an accepted participant's folder and copy only the assets required by that repository, using the same naming convention and any required metadata. The artwork intentionally omits the website's NEW badge, like counter and comment counter; those should remain managed by the website.

For a normal image slot use `card.gif` or `card.svg`; the GIF does not respond to pointer input. The demo is a standalone page, not a drop-in component for an unknown application framework. If the site accepts HTML embedded in an iframe, the demo can be used there subject to its rules.

Before committing, inspect `git status` and `git diff --stat`, preview your website locally, and ensure that only your intended participant folder and any required registration changes are included. Do not commit generated dependencies or modify shared application files unless the repository instructions require it.
