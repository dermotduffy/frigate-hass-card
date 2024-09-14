# `menu`

Configures how the card menu behaves.

```yaml
menu:
  # [...]
```

| Option        | Default  | Description                                                                                                                                                                                                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alignment`   | `left`   | Whether to align the menu buttons to the `left`, `right`, `top` or `bottom` of the menu. Some selections may have no effect depending on the value of `position` (e.g. it doesn't make sense to `left` align icons on a menu with `position` to the `left`). |
| `button_size` | `40`     | The size of the menu buttons in pixels. Must be &gt;= `20`.                                                                                                                                                                                                  |
| `buttons`     |          | Whether to show or hide built-in buttons. See below.                                                                                                                                                                                                         |
| `position`    | `top`    | Whether to show the menu on the `left`, `right`, `top` or `bottom` side of the card. Note that for the `outside` style only the `top` and `bottom` positions have an effect.                                                                                 |
| `style`       | `hidden` | The menu style to show by default, one of `none`, `hidden`, `hover`, `hover-card`, `overlay`, or `outside`. See below.                                                                                                                                       |

## `buttons`

All configuration is under:

```yaml
menu:
  buttons:
    [button]:
      # [...]
```

### Available Buttons

| Button name    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_ui`    | The `camera_ui` menu button: brings the user to a context-appropriate page on the UI of their camera engine (e.g. the Frigate camera homepage). Will only appear if the camera engine supports a camera UI (e.g. if `frigate.url` option is set for `frigate` engine users).                                                                                                                                                                                                                          |
| `cameras`      | The camera selection submenu. Will only appear if multiple cameras are configured.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `clips`        | The `clips` view menu button: brings the user to the `clips` view on tap and the most-recent `clip` view on hold.                                                                                                                                                                                                                                                                                                                                                                                     |
| `display_mode` | The `display_mode` button allows changing between single and grid views.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `download`     | The `download` menu button: allow direct download of the media being displayed.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `expand`       | The `expand` menu button: expand the card into a popup/dialog.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `frigate`      | The `Frigate` menu button: brings the user to the default configured view (`view.default`), or collapses/expands the menu if the `menu.style` is `hidden` .                                                                                                                                                                                                                                                                                                                                           |
| `fullscreen`   | The `fullscreen` menu button: expand the card to consume the fullscreen.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `image`        | The `image` view menu button: brings the user to the static `image` view.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `live`         | The `live` view menu button: brings the user to the `live` view.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `media_player` | The `media_player` menu button: sends the visible media to a remote media player. Supports Frigate clips, snapshots and live camera (only for cameras that specify a `camera_entity` and only using the default HA stream (equivalent to the `ha` live provider)). `jsmpeg` or `webrtc-card` are not supported, although live can still be played as long as `camera_entity` is specified. In the player list, a `tap` will send the media to the player, a `hold` will stop the media on the player. |
| `microphone`   | The `microphone` button allows usage of 2-way audio in certain configurations. See [Using 2-way audio](../usage/2-way-audio.md).                                                                                                                                                                                                                                                                                                                                                                      |
| `ptz_controls` | The `ptz_controls` button shows or hides the PTZ controls.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ptz_home`     | The `ptz_home` button allows easily returning the camera to default home position.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `recordings`   | The `recordings` view menu button: brings the user to the `recordings` view on tap and the most-recent `recording` view on hold.                                                                                                                                                                                                                                                                                                                                                                      |
| `screenshot`   | The `screenshot` menu button: take a screenshot of the loaded media (e.g. a still from a video).                                                                                                                                                                                                                                                                                                                                                                                                      |
| `snapshots`    | The `snapshots` view menu button: brings the user to the `clips` view on tap and the most-recent `snapshot` view on hold.                                                                                                                                                                                                                                                                                                                                                                             |
| `timeline`     | The `timeline` menu button: show the event timeline.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Options for each button

| Option      | Default                                                                                                                                                                                                                                                                                | Description                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alignment` | `matching`                                                                                                                                                                                                                                                                             | Whether this button should have an alignment that is `matching` the menu alignment or `opposing` the menu. Can be used to create two separate groups of buttons on the menu. `priority` orders buttons within a given `alignment`.                                    |
| `enabled`   | `true` for `frigate`, `cameras`, `substreams`, `live`, `clips`, `snapshots`, `timeline`, `download`, `camera_ui`, `fullscreen`, `media_player`, `display_mode` and `ptz_home`. `false` for `image`, `expand`, `microphone`, `mute`, `play`, `recordings`, `screenshot`, `ptz_controls` | Whether or not to show the button.                                                                                                                                                                                                                                    |
| `icon`      |                                                                                                                                                                                                                                                                                        | An icon to overriding the default for that button, e.g. `mdi:camera-front`.                                                                                                                                                                                           |
| `priority`  | `50`                                                                                                                                                                                                                                                                                   | The button priority. Higher priority buttons are ordered closer to the start of the menu alignment (i.e. a button with priority `70` will order further to the left than a button with priority `60`, when the menu alignment is `left`). Minimum `0`, maximum `100`. |

## `style`

This card supports several menu styles.

| Key          | Description                                                                                                                                                | Screenshot                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `hidden`     | Hide the menu by default, expandable upon clicking the Frigate button.                                                                                     | ![](../images/menu-mode-hidden.png 'Menu hidden :size=400')      |
| `hover-card` | Overlay the menu over the card contents when the mouse is over the **card**, otherwise it is not shown. The Frigate button shows the default view.         | ![](../images/menu-mode-overlay.png 'Menu hover-card :size=400') |
| `hover`      | Overlay the menu over the card contents when the mouse is over the **menu**, otherwise it is not shown. The Frigate button shows the default view.         | ![](../images/menu-mode-overlay.png 'Menu hover :size=400')      |
| `none`       | No menu is shown.                                                                                                                                          | ![](../images/menu-mode-none.png 'No menu :size=400')            |
| `outside`    | Render the menu outside the card (i.e. above it if `position` is `top`, or below it if `position` is `bottom`). The Frigate button shows the default view. | ![](../images/menu-mode-above.png 'Menu outside :size=400')      |
| `overlay`    | Overlay the menu over the card contents. The Frigate button shows the default view.                                                                        | ![](../images/menu-mode-overlay.png 'Menu hidden :size=400')     |

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
menu:
  alignment: left
  buttons:
    frigate:
      priority: 50
      enabled: true
      alignment: matching
      # Default icon is an internal coded Frigate icon. Note
      # absence of 'mdi' here (mdi has no Frigate icon).
      icon: frigate
    cameras:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:video-switch
    substreams:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:video-input-component
    live:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:cctv
    clips:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:filmstrip
    snapshots:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:camera
    image:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:image
    timeline:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:chart-gantt
    download:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:download
    camera_ui:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:web
    fullscreen:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:fullscreen
    expand:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:arrow-expand-all
    media_player:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:cast
    microphone:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:microphone
      type: momentary
    mute:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:volume-off
    play:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:play
    ptz_controls:
      priority: 50
      enabled: false
      alignment: matching
      icon: mdi:pan
    ptz_home:
      priority: 50
      enabled: true
      alignment: matching
      icon: mdi:home
  button_size: 40
  position: top
  style: hidden
```
