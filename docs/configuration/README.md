# Configuration

The card supports a myriad of configuration options for simple or complex setups.

### Minimal configuration

```yaml
type: custom:frigate-card
cameras:
  - camera_entity: camera.office
```

### Configuration blocks

#### Top-level configuration blocks

Only the `cameras` option is required, all other parameters are optional.

| Option                                | Description                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`automations`](automations.md)       | Take action when conditions are met.                                                                                                                                                                    |
| [`cameras`](cameras/README.md)        | Configures the cameras to be used in the card. At least one camera must be specified.                                                                                                                   |
| [`cameras_global`](cameras/README.md) | Global defaults that apply to all cameras from the `cameras` section.                                                                                                                                   |
| `card_id`                             | An optional ID to uniquely identify this card. For use when actions are being sent to card(s) via [URL actions](../usage/url-actions.md). Must exclusively consist of these characters: `[a-zA-Z0-9_]`. |
| [`dimensions`](dimensions.md)         | Configures the overall card dimensions.                                                                                                                                                                 |
| [`elements`](elements/README.md)      | Add custom elements to the card.                                                                                                                                                                        |
| [`image`](image.md)                   | Configures the `image` view.                                                                                                                                                                            |
| [`live`](live.md)                     | Configures the `live` view.                                                                                                                                                                             |
| [`media_gallery`](media-gallery.md)   | Configures the media gallery.                                                                                                                                                                           |
| [`media_viewer`](media-viewer.md)     | Configures the media viewer.                                                                                                                                                                            |
| [`menu`](menu.md)                     | Configures the card menu.                                                                                                                                                                               |
| [`overrides`](overrides.md)           | Override card configuration when conditions are met.                                                                                                                                                    |
| [`performance`](performance.md)       | Configures the card performance.                                                                                                                                                                        |
| [`profiles`](profiles.md)             | Apply pre-configured sets of defaults to ease card configuration.                                                                                                                                       |
| [`timeline`](timeline.md)             | Configures the `timeline` view.                                                                                                                                                                         |
| [`view`](view.md)                     | Configures the default view and behavior of the card.                                                                                                                                                   |

#### Common configuration blocks

| Option                         | Description           |
| ------------------------------ | --------------------- |
| [`actions`](actions/README.md) | Configure actions.    |
| [`conditions`](conditions.md)  | Configure conditions. |
