# `conditions`

`conditions` is not a top-level configuration block, but can be used as part of
multiple other blocks.

Conditions are used to conditionally take action (in `automations`), to apply
certain configurations (in `overrides`) or to display "picture elements" (in
`elements`) depending on runtime evaluation.

```yaml
[used as part of other configuration]
  conditions:
    - [condition_1]
    - [condition_2]
```

## `camera`

```yaml
conditions:
  - condition: camera
    # [...]
```

| Parameter   | Description                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `condition` | Must be `camera`.                                                                                            |
| `cameras`   | A list of camera IDs in which this condition is satisfied. See the camera [id](cameras/README.md) parameter. |

## `expand`

```yaml
conditions:
  - condition: expand
    # [...]
```

| Parameter   | Description                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `expand`.                                                                                                                                                                            |
| `expand`    | If `true` the condition is satisfied if the card is in expanded mode (in a dialog/popup). If `false` the condition is satisfied if the card is **NOT** in expanded mode (in a dialog/popup). |

## `fullscreen`

```yaml
conditions:
  - condition: fullscreen
    # [...]
```

| Parameter    | Description                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`  | Must be `fullscreen`.                                                                                                                                    |
| `fullscreen` | If `true` the condition is satisfied if the card is in fullscreen mode. If `false` the condition is satisfied if the card is **NOT** in fullscreen mode. |

## `interaction`

```yaml
conditions:
  - condition: interaction
    # [...]
```

| Parameter     | Description                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`   | Must be `interaction`.                                                                                                                                                                                                          |
| `interaction` | If `true` the condition is satisfied if the card has had human interaction within `view.interaction_seconds` elapsed seconds. If `false` the condition is satisfied if the card has **NOT** had human interaction in that time. |

## `key`

```yaml
conditions:
  - condition: key
    # [...]
```

| Parameter   | Default | Description                                                                                                                       |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `condition` | -       | Must be `key`.                                                                                                                    |
| `alt`       | `false` | An optional value to match whether the `alt` key is being held.                                                                   |
| `ctrl`      | `false` | An optional value to match whether the `ctrl` key is being held.                                                                  |
| `key`       |         | Any [keyboard key value](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values), e.g. `ArrowLeft`. |
| `meta`      | `false` | An optional value to match whether the `meta` key is being held.                                                                  |
| `shift`     | `false` | An optional value to match whether the `shift` key is being held.                                                                 |
| `state`     | `down`  | An optional value to match the state of the. Must be one of `down` or `up`.                                                       |

## `media_loaded`

```yaml
conditions:
  - condition: media_loaded
    # [...]
```

| Parameter      | Description                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`    | Must be `media_loaded`.                                                                                                                                                                                                                        |
| `media_loaded` | If `true` the condition is satisfied if there is media load**ED** (not load**ING**) in the card (e.g. a clip, snapshot or live view). This may be used to hide controls during media loading or when a message (not media) is being displayed. |

## `microphone`

```yaml
conditions:
  - condition: microphone
    # [...]
```

| Parameter   | Description                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `condition` | Must be `microphone`.                                                                                                  |
| `connected` | Optional: If `true` or `false` the condition is satisfied if the microphone is connected or disconnected respectively. |
| `muted`     | Optional: If `true` or `false` the condition is satisfied if the microphone is muted or unmuted respectively.          |

## `numeric_state`

```yaml
conditions:
  - condition: numeric_state
    # [...]
```

This stock Home Assistant condition works out of the box. See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#numeric-state).

## `screen`

```yaml
conditions:
  - condition: screen
    # [...]
```

| Parameter     | Description                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `condition`   | Must be `screen`.                                                                                                                                                                                                                                                                                                                                                              |
| `media_query` | Any valid [media query](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries) string. Media queries must start and end with parentheses. This may be used to alter card configuration based on device/media properties (e.g. viewport width, orientation). Please note that `width` and `height` refer to the entire viewport not just the card. |

See the [screen conditions examples](../examples.md?id=screen-conditions).

## `state`

```yaml
conditions:
  - condition: state
    # [...]
```

This stock Home Assistant condition works out of the box. See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#state).

## `triggered`

```yaml
conditions:
  - condition: triggered
    # [...]
```

| Parameter   | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `condition` | Must be `triggered`.                                                                              |
| `triggered` | A list of camera IDs which, if [triggered](cameras/README.md?id=triggers), satisfy the condition. |

## `user`

```yaml
conditions:
  - condition: user
    # [...]
```

This stock Home Assistant condition works out of the box. See [Home Assistant conditions documentation](https://www.home-assistant.io/dashboards/conditional/#user).

## `view`

```yaml
conditions:
  - condition: view
    # [...]
```

| Parameter   | Description                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `condition` | Must be `view`.                                                                                   |
| `views`     | A list of [views](view.md?id=supported-views) in which this condition is satified (e.g. `clips`). |

?> Internally, views associated with the media viewer (e.g. `clip`, `snapshot`,
`recording`) are translated to a special view called `media` after the relevant
media is fetched. When including views as part of a [condition](conditions.md),
you may need to refer to this special `media` view.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
conditions:
 - condition: camera
   cameras:
     - camera.office
  - condition: expand
    expand: true
  - condition: fullscreen
    fullscreen: true
  - condition: interaction
    interaction: true
  - condition: key
    alt: false
    ctrl: false
    key: F
    meta: false
    shift: false
    state: down
  - condition: media_loaded
    media_loaded: true
  - condition: microphone
    connected: true
    muted: true
  - condition: numeric_state
    entity: sensor.office_temperature
    above: 10
    below: 20
  - condition: screen
    media_query: '(orientation: landscape)'
  - condition: state
    entity: climate.office
    state: heat
    state_not: off
  - condition: triggered
    triggered:
      - camera.office
  - condition: user
    users:
      - 581fca7fdc014b8b894519cc531f9a04
  - condition: view
    views:
      - live
```
