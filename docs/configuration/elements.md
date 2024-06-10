# `elements`

This card supports the [Picture Elements configuration
syntax](https://www.home-assistant.io/lovelace/picture-elements/) to seamlessly
allow the user to add custom elements to the card.

```yaml
elements:
  - [element_1]
  - [element_2]
```

?> The Frigate Card allows either a single [action](actions/README.md) (as in stock Home
Assistant) or list of [actions](actions/README.md) to be defined for each class of user interaction
(e.g. `tap`, `double_tap`, `hold`, etc). See [an example of multiple actions](../examples.md?id=multiple-actions).

## `conditional`

This element will let you show its sub-elements based on entity states. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#conditional-element).

```yaml
elements:
   - type: conditional
     [...]
```

## `custom`

Custom elements provided by a card. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#custom-elements).

```yaml
elements:
   - type: custom
     [...]
```

## `custom:frigate-card-menu-icon`

Add an arbitrary icon to the Frigate Card menu. Configuration is ~identical to that of the [Picture Elements Icon](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) except with a type name of `custom:frigate-card-menu-icon`.

```yaml
elements:
   - type: custom:frigate-card-menu-icon
     [...]
```

## `custom:frigate-card-menu-state-icon`

Add a state icon to the Frigate Card menu that represents the state of a Home Assistant entity. Configuration is ~identical to that of the [Picture Elements State Icon](https://www.home-assistant.io/lovelace/picture-elements/#state-icon) except with a type name of `custom:frigate-card-menu-state-icon`.

```yaml
elements:
   - type: custom:frigate-card-menu-icon
     [...]
```

## `custom:frigate-card-menu-submenu`

Add a configurable submenu dropdown.

```yaml
elements:
   - type: custom:frigate-card-menu-submenu
     [...]
```

Parameters for this element are identical to the parameters of the [stock Home Assistant Icon Element](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) with the exception of these parameters which differ:

| Parameter | Description                                 |
| --------- | ------------------------------------------- |
| `type`    | Must be `custom:frigate-card-menu-submenu`. |
| `items`   | A list of menu items, as described below.   |

### Submenu items

| Parameter                                                                | Default | Description                                                                                       |
| ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| `enabled`                                                                | `true`  | Whether or not to show this item as enabled / selectable.                                         |
| `entity`                                                                 |         | An optional Home Assistant entity from which title, icon and style can be automatically computed. |
| `icon`                                                                   |         | An optional item icon to display, e.g. `mdi:car`                                                  |
| `selected`                                                               | `false` | Whether or not to show this item as selected.                                                     |
| `state_color`                                                            | `true`  | Whether or not the title and icon should be stylized based on state.                              |
| `style`                                                                  |         | Position and style the element using CSS.                                                         |
| `tap_action`, `double_tap_action`, `hold_action`, `start_tap`, `end_tap` |         | The [actions](actions/README.md) to take when this item is interacted with.                       |
| `title`                                                                  |         | An optional title to display.                                                                     |

## `custom:frigate-card-menu-submenu-select`

Add a submenu based on a `select` or `input_select`. This element allows you to convert a [Home Assistant Select Entity](https://www.home-assistant.io/integrations/select/) or [Home Assistant Input Select Entity](https://www.home-assistant.io/integrations/input_select/) (an entity either starting with `select` or `input_select`) into an overridable submenu. This _could_ be done by hand using a regular submenu (above) -- this element is a convenience.

```yaml
elements:
   - type: custom:frigate-card-menu-submenu-select
     [...]
```

Parameters for the `custom:frigate-card-menu-submenu-select` element are identical to the parameters of the [stock Home Assistant State Icon Element](https://www.home-assistant.io/dashboards/picture-elements/#state-icon) with the exception of these parameters which differ:

| Parameter | Description                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`    | Must be `custom:frigate-card-menu-submenu-select`.                                                                                                                                                                                                                                 |
| `options` | An optional dictionary of overrides keyed by the option name that the given select entity supports. These options can be used to set or override submenu item parameters on a per-option basis. The format is as described in [Submenu Items](elements.md?id=submenu-items) above. |

See the `select` [submenu example](../examples.md?id=select-submenu).

## `custom:frigate-card-conditional`

Restrict a set of elements to only render when the card is matches a set of [conditions](conditions.md). This is analogous to [`conditional`](elements.md?id=conditional) element above, except supporting a rich set of Frigate Card [conditions](conditions.md).

```yaml
elements:
   - type: custom:frigate-card-conditional
     [...]
```

Parameters for the `custom:frigate-card-conditional` element:

| Parameter    | Description                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `type`       | Must be `custom:frigate-card-conditional`.                                                                 |
| `conditions` | A list of [conditions](conditions.md) that must evaluate to true in order for the elements to be rendered. |
| `elements`   | The elements to render. Can be any supported element.                                                      |

See the [conditional elements example](../examples.md?id=conditional-elements).

## `icon`

This element creates a static icon that is not linked to the state of an entity. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#icon-element).

```yaml
elements:
   - type: icon
     [...]
```

## `image`

This creates an image element that overlays the background image. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#image-element).

```yaml
elements:
   - type: image
     [...]
```

## `service-button`

This entity creates a button (with arbitrary text) that can be used to call a service. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#service-call-button).

```yaml
elements:
   - type: service-button
     [...]
```

## `state-badge`

This element creates a badge representing the state of an entity. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-badge).

```yaml
elements:
   - type: state-badge
     [...]
```

## `state-icon`

This element represents an entity state using an icon. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-icon).

```yaml
elements:
   - type: state-icon
     [...]
```

## `state-label`

This element represents an entity’s state via text. See [Home Assistant elements documentation](https://www.home-assistant.io/dashboards/picture-elements/#state-label).

```yaml
elements:
   - type: state-label
     [...]
```

## Fully expanded reference

> [Actions](actions/README.md) are omitted for simplicity.

[](common/expanded-warning.md ':include')

### Stock Home Assistant elements

Reference: [Home Assistant Picture Elements](https://www.home-assistant.io/dashboards/picture-elements/)

```yaml
elements:
  - type: state-badge
    entity: sensor.kitchen_dining_multisensor_air_temperature
    style:
      left: 100px
      top: 50px
    title: 'Temperature'
  - type: state-icon
    entity: light.office_main_lights
    icon: mdi:lamp
    state_color: true
    style:
      left: 100px
      top: 100px
  - type: state-label
    entity: sensor.kitchen_motion_sensor_battery
    attribute: battery_voltage
    prefix: Volts
    title: Battery Voltage
    style:
      left: 100px
      top: 150px
  - type: state-label
    entity: sensor.kitchen_motion_sensor_battery
    attribute: battery_voltage
    prefix: 'Volts: '
    title: Battery Voltage
    style:
      background-color: black
      left: 100px
      top: 200px
  - type: service-button
    title: Light on
    service: homeassistant.turn_on
    service_data:
      entity: light.office_main_lights
    style:
      left: 100px
      top: 250px
  - type: icon
    icon: mdi:cow
    title: Moo
    style:
      left: 100px
      top: 300px
  - type: image
    entity: light.office_main_lights
    title: Image
    state_image:
      on: 'https://picsum.photos/id/1003/1181/1772'
      off: 'https://picsum.photos/id/102/4320/3240'
    state_filter:
      'on': brightness(110%) saturate(1.2)
      'off': brightness(50%) hue-rotate(45deg)
    style:
      left: 100px
      top: 350px
      height: 50px
      width: 100px
  - type: conditional
    conditions:
      - condition: state
        entity: light.office_main_lights
        state: on
        state_not: off
      - condition: numeric_state
        entity: sensor.light_level
        above: 20
        below: 100
      - condition: user
        users:
          - 581fca7fdc014b8b894519cc531f9a04
    elements:
      - type: icon
        icon: mdi:dog
        title: Woof
        style:
          left: 100px
          top: 400px
```

### Frigate Card elements

```yaml
elements:
  - type: custom:frigate-card-menu-icon
    icon: mdi:car
    title: Vroom
  - type: custom:frigate-card-menu-state-icon
    entity: light.office_main_lights
    title: Office lights
    icon: mdi:chair-rolling
    state_color: true
  - type: custom:frigate-card-menu-submenu
    icon: mdi:menu
    items:
      - title: Lights
        icon: mdi:lightbulb
        entity: light.office_main_lights
        tap_action:
          action: toggle
      - title: Google
        icon: mdi:google
        enabled: false
        tap_action:
          action: url
          url_path: https://www.google.com
  - type: custom:frigate-card-menu-submenu-select
    icon: mdi:lamps
    entity: input_select.kitchen_scene
    options:
      scene.kitchen_cooking_scene:
        icon: mdi:chef-hat
        title: Cooking time!
      scene.kitchen_tv_scene:
        icon: mdi:television
        title: TV!
    # Show a pig icon if a variety of conditions are met.
  - type: custom:frigate-card-conditional
    elements:
      - type: icon
        icon: mdi:pig
        title: Oink
        style:
          left: 300px
          top: 100px
    conditions:
      - condition: view
        views:
          - live
      - condition: fullscreen
        fullscreen: true
      - condition: expand
        expand: true
      - condition: camera
        cameras: camera.front_door
      - condition: media_loaded
        media_loaded: true
      - condition: display_mode
        display_mode: single
      - condition: triggered
        triggered:
          - camera.front_door
      - condition: interaction
        interaction: true
      - condition: microphone
        muted: true
        connected: true
      - condition: state
        entity: light.office_main_lights
        state: on
        state_not: off
      - condition: numeric_state
        entity: sensor.light_level
        above: 20
        below: 100
      - condition: user
        users:
          - 581fca7fdc014b8b894519cc531f9a04
```
