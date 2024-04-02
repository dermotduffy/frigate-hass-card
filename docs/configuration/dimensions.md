# `dimensions`

These options control the dimensions and aspect-ratio of the card. These options
configuration applies once to the entire card (including the menu, thumbnails,
etc), not just to displayed media. This only applies to the card in normal
render mode -- when in fullscreen, or when in expanded (popup/dialog mode) the
aspect ratio is chosen dynamically to maximize the amount of content shown.

```yaml
dimensions:
   [...]
```

| Option | Default | Description |
| - | - | - |
| `aspect_ratio_mode` | `dynamic` | The aspect ratio mode to use. Acceptable values: `dynamic`, `static`, `unconstrained`. See below. |
| `aspect_ratio` | `16:9` | The aspect ratio  to use. Acceptable values: `[W]:[H]` or `[W]/[H]`. See below. |
| `max_height` | `100vh` | The maximum allowable height for the card. Specified in [CSS units](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units). Generally users should not need to change this setting unless they have set an `unconstrained` aspect ratio. |
| `min_height` | `100px` | The minimum allowable height for the card. Specified in [CSS units](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Values_and_units). Generally users should not need to change this setting. |

### `aspect_ratio_mode`

| Option | Description |
| - | - |
| `dynamic` | The aspect-ratio of the entire card will match the aspect-ratio of the last selected media item. |
| `static` | A fixed aspect-ratio (as defined by `aspect_ratio`) will be applied to the card. |
| `unconstrained` | No aspect ratio is enforced in any view, the card will expand with the content. This may be especially useful for a panel-mode dashboard, or in views that have no intrinsic aspect-ratio (e.g. the media gallery). |

### `aspect_ratio`

* `16 / 9` or `16:9`: Default widescreen ratio.
* `4 / 3` or `4:3`: Default fullscreen ratio.
* `[W]/[H]` or `[W]:[H]`: Any arbitrary aspect-ratio.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
dimensions:
  aspect_ratio_mode: dynamic
  aspect_ratio: 16:9
  max_height: 100vh
  min_height: 100px
```
