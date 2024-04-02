# `overrides`

Various parts of card configuration may [conditionally](conditions.md) be
overridden (e.g. to hide the menu in fullscreen mode).

```yaml
overrides:
  - conditions:
       [condition]
    overrides:
       [override]
```

Not all configuration parameters are overriddable, some because it doesn't make
sense for that parameter to vary, and many because of the extra complexity of
supporting overriding given the lack of compelling usecases ([please request new
overridable parameters
here!](https://github.com/dermotduffy/frigate-hass-card/issues/new/choose)).

Each entry under the top-level `overrides` configuration block should be a list
item, that has both of the following parameters set:

| Option | Default | Description |
| - | - | - |
| `conditions` | | A list of [conditions](conditions.md) that must evaluate to `true` in order for the overrides to be applied. |
| `overrides` | | Configuration overrides to be applied. Any configuration parameter matching [Overrideable parameters](overrides.md?id=overrideable-parameters) can be overridden. |

## Overrideable parameters

| Configuration Key | Overrideable |
| - | - |
| [`cameras.*`](cameras/README.md) | :white_check_mark: |
| [`cameras_global.*`](cameras/README.md) | :white_check_mark: |
| [`dimensions.*`](dimensions.md) | :white_check_mark: |
| [`image.*`](image.md) | :white_check_mark: |
| [`live.controls.*`](live.md?id=controls), [`live.display.*`](live.md?id=display), [`live.microphone.*`](live.md?id=microphone), [`live.show_image_during_load`](live.md), [`live.zoomable`](live.md) | :white_check_mark: |
| [`menu.*`](menu.md) | :white_check_mark: |
| [`view.*`](view.md) | :white_check_mark: |
| *(Everything else)* | :heavy_multiplication_x: |
