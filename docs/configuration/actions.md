# `actions`

## Introduction to actions

`actions` is not a top-level configuration block, but can be used as part of
multiple other blocks.

Actions are pre-configured activities that can be triggered in response to a
variety of circumstances (e.g. tapping on a menu icon, double tapping on an
[element](./elements.md) or holding the mouse/tap down on a particular
[view](./view.md?id=supported-views)).

### Differences in actions between Frigate Card and Home Assistant

Both the Home Assistant frontend and the Frigate card cooperate to provide
action functionality. In general, the Frigate Card functionality is a superset
of that offered by stock Home Assistant.

Stock action functionality is used for Stock [Home Assistant picture
elements](https://www.home-assistant.io/lovelace/picture-elements/). Extended
Frigate card behavior covers all other interactions on the Frigate card (e.g.
menu icon elements, submenus and actions on the card or views).

#### Custom action types: `start_tap` and `end_tap`

The card has partial support for two special action types `start_tap` and
`end_tap` which occur when a tap is started (e.g. mouse is pressed down /
touch begins), and ended (e.g. mouse released / touch ends) respectively. This
might be useful for PTZ cameras cameras to start/stop movement on touch. Network
latency may introduce unavoidable imprecision between `end_tap` and action
actually occurring.

#### Multiple actions

Extended Frigate card behavior supports a list of actions instead of a single
action, all of which will be handled. See [an example of multiple
actions](../examples.md?id=multiple-actions).

## Card and view actions

Actions may be attached to the card itself, to trigger action when the card
experiences a `tap`, `double_tap`, `hold`, `start_tap` or `end_tap` event.
Alternatively they can be configured on a per group-of-views basis, e.g. only
when `live` view is tapped.

| Configuration path | Views to which it refers |
| - | - |
| `image.actions` | `image` |
| `live.actions` | `live` |
| `media_gallery.actions` | `clips`, `snapshots`, `recordings` |
| `media_viewer.actions` | `clip`, `snapshot`, `recording` |
| `view.actions` | All |

If an action is configured for both the whole card (`view.actions`) and a more
specific view (e.g. `live.actions`) then the actions are merged, with the more
specific overriding the less specific.

!> The card itself relies on user interactions to function (e.g. `tap` on
the menu should activate that button). Card or View actions are prevented from
being activated through standard interaction with menu buttons, next/previous
controls, thumbnails, etc, but in some cases this prevention is not possible
(e.g. embedded WebRTC card controls) -- in these cases duplicate actions may
occur with certain configurations (e.g. `tap`).

!> Card-wide actions are not supported on timelines nor when a info/error message
is being displayed.

## `call-service`

Call a service. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: call-service
[...]
```

## `custom:frigate-card-action`

Execute a Frigate Card action.

```yaml
action: custom:frigate-card-action
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | A supported Frigate Card action. See below. |

### `camera_select`

Select a given camera.

```yaml
action: custom:frigate-card-action
frigate_card_action: camera_select
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `camera_select`. |
| `camera` | The [camera ID](cameras/README.md?id=cameras) of the camera to select. |
| `triggered` | If `true` instead of `camera` being specified then a triggered camera (if any) is selected instead. |

This action will respect the value of the `view.camera_select` to choose the appropriate view on the new camera. See [`view` configuration](view.md).
  
### `camera_ui`

Download the displayed media.

```yaml
action: custom:frigate-card-action
frigate_card_action: camera_ui
```

Open the UI for the selected camera engine (e.g. the Frigate UI).

### `change_zoom`

Zoom in and/or pan for a given camera.

```yaml
action: custom:frigate-card-action
frigate_card_action: change_zoom
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `change_zoom`. |
| `target_id` | The [camera ID](cameras/README.md?id=cameras) or a media ID (e.g. `frigate` event ID) to change zoom/pam settings for. |
| `zoom` | Optional parameter that controls how much to zoom-in. See the [camera zoom parameter](cameras/README.md?id=layout-configuration). |
| `pan` | Optional parameter that controls how much to pan-x/y. See the [camera pan parameter](cameras/README.md?id=layout-configuration). |

?> If neither `zoom` nor `pan` are specified the camera will return to its default zoom and pan settings.

See [example of automatically zoom/panning based on state](../examples.md?id=automatically-zoom-based-on-state).

### `clip`, `clips`, `image`, `live`, `recording`, `recordings`, `snapshot`, `snapshots`

Change to the specified view.

```yaml
action: custom:frigate-card-action
frigate_card_action: [view]
```

### `default`

Change to the default view.

```yaml
action: custom:frigate-card-action
frigate_card_action: default
```

### `download`

Download the displayed media.

```yaml
action: custom:frigate-card-action
frigate_card_action: download
```

### `expand`

Expand the card into a dialog/popup.

```yaml
action: custom:frigate-card-action
frigate_card_action: expand
```

### `fullscreen`

Toggle fullscreen.

```yaml
action: custom:frigate-card-action
frigate_card_action: fullscreen
```

### `live_substream_select`

Select a substream.

```yaml
action: custom:frigate-card-action
frigate_card_action: live_substream_select
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `live_substream_select`. |
| `camera` | The [camera ID](cameras/README.md?id=cameras) of the substream to select. |

### `media_player`

Perform a media player action. 

```yaml
action: custom:frigate-card-action
frigate_card_action: media_player
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `media_player`. |
| `media_player` | The entity ID of the media_player on which to perform the action. |
| `media_player_action` | Either `play` or `stop` to play or stop the media in question. |

### `menu_toggle`

Show/hide the menu (for the `hidden` mode style).

```yaml
action: custom:frigate-card-action
frigate_card_action: menu_toggle
```

### `microphone_mute`, `microphone_unmute`

Mute/Unmute the microphone during [2-way audio](../usage/2-way-audio.md).

```yaml
action: custom:frigate-card-action
frigate_card_action: microphone_mute
```

```yaml
action: custom:frigate-card-action
frigate_card_action: microphone_unmute
```

### `mute`, `unmute`

Mute/Unmute the selected media.

```yaml
action: custom:frigate-card-action
frigate_card_action: mute
```

```yaml
action: custom:frigate-card-action
frigate_card_action: unmute
```

### `play`, `pause`

Play/Pause the selected media.

```yaml
action: custom:frigate-card-action
frigate_card_action: play
```

```yaml
action: custom:frigate-card-action
frigate_card_action: pause
```

### `ptz`

Execute a native PTZ action (only for native out-of-the-box PTZ camera engines, e.g. Frigate).

 Takes a required `ptz_action` parameter that is one of . 

```yaml
action: custom:frigate-card-action
frigate_card_action: ptz
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `ptz`. |
| `ptz_action` | One of `left`, `right`, `up`, `down`, `zoom_in`, `zoom_out` or `preset`. |
| `ptz_phase` | Optional parameter that is one of `start` or `stop` to start or stop the movement separately. |
| `ptz_preset` | Optional preset to execute when the `ptz_action` is `preset`. |

### `screenshot`

Take a screenshot of the selected media (e.g. a still from a video).

```yaml
action: custom:frigate-card-action
frigate_card_action: screenshot
```

### `show_ptz`

Show or hide the PTZ controls.

```yaml
action: custom:frigate-card-action
frigate_card_action: show_ptz
[...]
```

| Parameter | Description |
| - | - |
| `action` | Must be `custom:frigate-card-action`. |
| `frigate_card_action` | Must be `show_ptz`. |
| `show_ptz` | If `true` shows the PTZ controls, if `false` hides them. |

## `more-info`

Open the "more-info" dialog for an entity. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: more-info
[...]
```

## `navigate`

Navigate to a particular dashboard path. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: navigate
[...]
```

## `toggle`

Toggle an entity. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: toggle
[...]
```

## `url`

Navigate to an arbitrary URL. See [Home Assistant actions documentation](https://www.home-assistant.io/dashboards/actions/).

```yaml
action: url
[...]
```

## Fully expanded reference

[](common/expanded-warning.md ':include')

### Stock Home Assistant actions

Reference: [Home Assistant Actions](https://www.home-assistant.io/dashboards/actions/).

```yaml
elements:
  - type: icon
    icon: mdi:numeric-1-box
    title: More info action
    style:
      left: 200px
      top: 50px
    entity: light.office_main_lights
    tap_action:
      action: more-info
  - type: icon
    icon: mdi:numeric-2-box
    title: Toggle action
    style:
      left: 200px
      top: 100px
    entity: light.office_main_lights
    tap_action:
      action: toggle
  - type: icon
    icon: mdi:numeric-3-box
    title: Call Service action
    style:
      left: 200px
      top: 150px
    tap_action:
      action: call-service
      service: homeassistant.toggle
      service_data:
        entity_id: light.office_main_lights
  - type: icon
    icon: mdi:numeric-4-box
    title: Navigate action
    style:
      left: 200px
      top: 200px
    tap_action:
      action: navigate
      navigation_path: /lovelace/2
  - type: icon
    icon: mdi:numeric-5-box
    title: URL action
    style:
      left: 200px
      top: 250px
    tap_action:
      action: url
      url_path: https://www.home-assistant.io/
  - type: icon
    icon: mdi:numeric-6-box
    title: None action
    style:
      left: 200px
      top: 300px
    tap_action:
      action: none
  - type: icon
    icon: mdi:numeric-7-box
    title: Custom action
    style:
      left: 200px
      top: 350px
    tap_action:
      action: fire-dom-event
      key: value
```

### Frigate Card actions

```yaml
elements:
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-a-circle
    title: Show default view
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: default
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-b-circle
    title: Show most recent clip
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: clip
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-c-circle
    title: Show clips
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: clips
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-d-circle
    title: Show image view
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: image
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-e-circle
    title: Show live view
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: live
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-f-circle
    title: Show most recent snapshot
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: snapshot
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-g-circle
    title: Show snapshots
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: snapshots
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-h-circle
    title: Download media
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: download
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-i-circle
    title: Open Frigate UI
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: camera_ui
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-j-circle
    title: Change to fullscreen
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-k-circle
    title: Toggle hidden menu
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: menu_toggle
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-l-circle
    title: Select Front Door
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: camera_select
      camera: camera.front_door
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-m-circle
    title: Media player play
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: media_player
      media_player: media_player.nesthub50be
      media_player_action: play
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-n-circle
    title: Media player stop
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: media_player
      media_player: media_player.nesthub
      media_player_action: stop
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-o-circle
    title: Screenshot
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: screenshot
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-p-circle
    title: Show PTZ
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: show_ptz
      show_ptz: true
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-q-circle
    title: Native PTZ Preset
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: ptz
      ptz_action: preset
      ptz_preset: doorway
  - type: custom:frigate-card-menu-icon
    icon: mdi:alpha-r-circle
    title: Change Zoom
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: change_zoom
      pan:
        x: 50
        y: 50
      zoom: 1
```
