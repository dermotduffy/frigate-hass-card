# `image`

Configure the `image` view.

```yaml
image:
   [...]
```

| Option | Default | Description |
| - | - | - |
| `actions` | | [Actions](actions.md) to use for the `image` view.|
| `mode` | `url` | Mode of the the `image` view. Value must be one of `url` (to fetch an arbitrary image URL), `camera` (to show a still of the currently selected camera using either `camera_entity` or `webrtc_card.entity` in that order of precedence), or `screensaver` (to show an [embedded stock Frigate card logo](https://github.com/dermotduffy/frigate-hass-card/blob/main/src/images/frigate-bird-in-sky.jpg)). In either `url` or `camera` mode, the `screensaver` content is used as a fallback if a URL is not specified or cannot be derived. |
| `refresh_seconds` | 0 | The image will be refreshed at least every `refresh_seconds` (it may refresh more frequently, e.g. whenever Home Assistant updates its camera security token). `0` implies no refreshing. |
| `url` | |  A static image URL to be used when the `mode` is set to `url` or when a temporary image is required (e.g. may appear momentarily prior to load of a camera snapshot in the `camera` mode). Note that a `_t=[timestsamp]` query parameter will be automatically added to all URLs such that the image will not be cached by the browser. |
| `zoomable` | `true` | Whether or not the image can be zoomed and panned, via touch/pinch and mouse scroll wheel with `ctrl` held. |

?> When `mode` is set to `camera` this is effectively providing the same image as the `image` [live provider](cameras/live-provider.md) would show in the live camera carousel.

# Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
image:
  mode: url
  refresh_seconds: 0
  zoomable: true
  actions:
    entity: light.office_main_lights
    tap_action:
      action: none
    hold_action:
      action: none
    double_tap_action:
      action: none
    start_tap_action:
      action: none
    end_tap_action:
      action: none
```
