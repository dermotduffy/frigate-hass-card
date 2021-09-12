<!-- markdownlint-disable first-line-heading -->
<!-- markdownlint-disable fenced-code-language -->
<!-- markdownlint-disable no-inline-html -->

<img src="https://raw.githubusercontent.com/blakeblackshear/frigate-hass-integration/master/images/frigate.png"
     alt="Frigate icon"
     width="35%"
     align="right"
     style="float: right; margin: 10px 0px 20px 20px;" />
[![GitHub Release](https://img.shields.io/github/release/dermotduffy/frigate-hass-card.svg?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/releases)
[![Build Status](https://img.shields.io/github/workflow/status/dermotduffy/frigate-hass-card/Build?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/actions/workflows/build.yaml)
[![License](https://img.shields.io/github/license/dermotduffy/frigate-hass-card.svg?style=flat-square)](LICENSE)
[![hacs](https://img.shields.io/badge/HACS-default-orange.svg?style=flat-square)](https://hacs.xyz)

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu_clip.png" alt="Live viewing" width="400px">

# Frigate Lovelace Card

A full-featured Frigate Lovelace card:

* Live viewing.
* Clips and snapshot browsing via mini-gallery.
* Automatic updating to continually show latest clip / snapshot.
* Support for filtering events by zone and label.
* Arbitrary entity access via menu (e.g. motion sensor access).
* Full Lovelace editing support.
* Theme friendly.
* **Advanced**: Support for [WebRTC](https://github.com/AlexxIT/WebRTC) live viewing.

## Installation

* Use [HACS](https://hacs.xyz/) to install the card:

```
Home Assistant > HACS > Frontend > "Explore & Add Integrations" > Frigate Card
```

* Add the following to `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /hacsfiles/frigate-hass-card/frigate-hass-card.js
      type: module
```

* Restart Home Assistant.
* Add the new card to the Lovelace configuration!

## Options

### Required

| Option           | Default | Description                                         |
| ------------- | - | --------------------------------------------- |
| `camera_entity` | | The Frigate camera entity to use in the live camera view.|

### Optional

| Option           | Default | Description                                         |
| ------------- | --------------------------------------------- | - |
| `frigate_camera_name` | The string after the "camera." in the `camera_entity` option (above). | This parameter allows the camera name heuristic to be overriden for cases where the entity name does not cleanly map to the Frigate camera name (e.g. when the Frigate camera name is capitalized, but the entity name is lower case). This camera name is used for communicating with the Frigate backend, e.g. for fetching events. |
| `live_provider` | `frigate` | Whether `frigate` (the default Frigate camera in Home Assistant which uses an RTMP stream), `frigate-jsmpeg` (JSMPEG stream proxied from the Frigate backend) or `webrtc` should provide the live camera view. See [note below on the required integration version](#jsmpeg-troubleshooting) for `frigate-jsmpeg` to function.|
| `view_default` | `live` | The view to show by default. See [views](#views) below.|
| `frigate_client_id` | `frigate` | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://blakeblackshear.github.io/frigate/usage/home-assistant/#multiple-instance-support).|
| `view_timeout` | | A numbers of seconds of inactivity after which the card will reset to the default configured view. Inactivity is defined as lack of interaction with the Frigate menu.|
| `frigate_url` | | The URL of the frigate server. If set, this value will be (exclusively) used for a `Frigate UI` menu button. |
| `autoplay_clip` | `false` | Whether or not to autoplay clips in the 'clip' [view](#views). Clips manually chosen in the clips gallery will still autoplay.|

### Appearance

| Option           | Default | Description                                         |
| ------------- | --------------------------------------------- | - |
| `menu_mode` | `hidden-top` | The menu mode to show by default. See [menu modes](#menu-modes) below.|
| `menu_buttons.{frigate, live, clips, snapshots, frigate_ui}` | `true` | Whether or not to show these builtin actions in the card menu. |
| `controls.nextprev` | `thumbnails` | When viewing media, what kind of controls to show to move to the previous/next media item. Acceptable values: `thumbnails`, `chevrons`, `none` . |

### Advanced

| Option           | Default | Description                                         |
| ------------- | - | --------------------------------------------- |
| `label` | | A label used to filter events (clips & snapshots), e.g. 'person'.|
| `zone` | | A zone used to filter events (clips & snapshots), e.g. 'front_door'.|

<a name="webrtc"></a>

### WebRTC Options

WebRTC support blends the use of the ultra-realtime [WebRTC live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. A perfect combination!

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/webrtc.png" alt="Live viewing" width="400px">

| Option           | Default | Description                                         |
| ------------- | - | -------------------------------------------- |
| `webrtc.entity` | | The RTSP entity to use with WebRTC.|
| `webrtc.*`| | Any other options in a `webrtc:` YAML dictionary are silently passed through to WebRTC. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides.|


**Note**: WebRTC must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

<a name="entities"></a>

### Entities

Additional entities may be configured to trigger updates to the card, and
optionally to appear in the menu. An `entities` section may be added to the card
configuration containing a list with entries of the following format:

| Option           | Default | Description                                         |
| ------------- | - | -------------------------------------------- |
| `entity` | | Entity ID to use to trigger updates, and optionally appear in the menu. |
| `icon` | [default entity icon] | An optional manual override of the icon to use in the menu, e.g. `mdi:car`. |
| `show`| `true` | Whether or not to show the entity in the menu. When `false` the entity ID will trigger card updates only, but not appear in the menu. |

#### Example

This example allows access to the detection, recordings and snapshots switches
from the menu. It also enables a different entity to trigger a card update (but
without appearing in the menu).

```yaml
entities:
  - entity: switch.front_door_recordings
  - entity: switch.front_door_snapshots
  - entity: switch.front_door_detect
  - entity: binary_sensor.front_door_person_motion
    show: false
```

#### Specifying the WebRTC Camera

There are two ways to specify the WebRTC source camera:

* Manual setup of separate RTSP camera entities in Home Assistant. These entities will then be available for selection in the GUI card editor for the Frigate card under the WebRTC options, or can be manually specified with a `webrtc.entity` option in YAML:

```yaml
[rest of Frigate card configuration]
webrtc:
  entity: 'camera.front_door_rstp`
```
* OR manually configuring the `url` parameter as part of a manual Frigate card configuration, like the following example:

```yaml
[rest of Frigate card configuration]
webrtc:
  url: 'rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH'
```

 See [WebRTC configuration](https://github.com/AlexxIT/WebRTC#configuration) for full configuration options.


<a name="views"></a>

## Views

This card supports several different views.

| Key           | Description                                         |
| ------------- | --------------------------------------------- |
|`live` (default)| Shows the live camera view, either the name Frigate view or [WebRTC](#webrtc) if configured.|
|`snapshots`|Shows the snapshot gallery for this camera/zone/label.|
|`snapshot`|Shows the most recent snapshot for this camera/zone/label.|
|`clips`|Shows the clip gallery for this camera/zone/label.|
|`clip`|Shows the most recent clip for this camera/zone/label.|

### Automatic updates in the `clip` or `snapshot` view

Updates will occur whenever on every change of the state of the `camera_entity`
or any entity configured under `entities`. In particular, if the desire is
to have an auto-refreshing view of the most recent event, the `camera_entity`
will not be sufficient alone since the Home Assistant state for Frigate camera
entities does not change often. Instead, use the Frigate binary_sensor for that
camera (or any other entity at your discretion) to trigger the update:

```yaml
entities:
  - entity: binary_sensor.office_person_motion
```

See [entities](#entities) above.

### Getting from a snapshot to a clip

Clicking on a snapshot will take the user to a clip that was taken at the ~same
time as the snapshot (if any).

### Getting event details

More details about an event can be found by clicking the 'globe' icon in the
menu, which takes the user to the Frigate page for that event.

## Menu Modes

This card supports several menu configurations.

| Key           | Description                                         | Screenshot |
| ------------- | --------------------------------------------- | - |
|`hidden-{top,bottom,right,left}`  [default: `hidden-top`]| Hide the menu by default, expandable upon clicking the 'F' button. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-hidden.png" alt="Menu hidden" width="400px"> |
|`overlay-{top,bottom,right,left}`| Overlay the menu over the card contents. The 'F' button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-overlay.png" alt="Menu overlaid" width="400px"> |
|`hover-{top,bottom,right,left}`| Overlay the menu over the card contents when the mouse is over the card / touch on the card, otherwise it is not shown. The 'F' button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-overlay.png" alt="Menu overlaid" width="400px"> |
|`above`| Render the menu above the card. The 'F' button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-above.png" alt="Menu above" width="400px"> |
|`below`| Render the menu below the card. The 'F' button shows the default view. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-below.png" alt="Menu below" width="400px"> |
|`none`| No menu is shown. | <img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu-mode-none.png" alt="No Menu" width="400px"> |

<a name="yaml-examples"></a>

### Example YAML Configuration

A configuration that uses WebRTC for live:

```yaml
- type: 'custom:frigate-card'
  camera_entity: camera.front_door
  frigate_url: http://frigate
  live_provider: webrtc
  webrtc:
    entity: camera.front_door_rtsp
```

A configuration that shows the latest clip on load, but does not automatically play it:

```yaml
- type: 'custom:frigate-card'
  camera_entity: camera.front_door
  frigate_url: http://frigate
  view_default: clip
```

### Screenshot: Snapshot / Clip Gallery

Full viewing of clips:

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/gallery.png" alt="Gallery" width="400px">

## Card Editing

This card supports full editing via the Lovelace card editor. Additional arbitrary configuration for WebRTC may be specified in YAML mode.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/editor.png" alt="Live viewing" width="400px">

## Troubleshooting

<a name="jsmpeg-troubleshooting"></a>

### JSMPEG live camera only shows a 'spinner'

**Note:** As of 2021-09-12, no released version of the [Frigate
integration](https://github.com/blakeblackshear/frigate-hass-integration)
supports JSMPEG proxying. That functionality is already merged, and will be in
the release *after* (not including) v2.0.0. The `frigate-jsmpeg` live provider
will not work with earlier integration versions.

### Failed to fetch

**Note:** This error should no longer be possible >= v0.1.5 .

`Failed to fetch` is a generic error indicating your browser (and this card)
could not communicate with the Frigate server specified in the card
configuration. This could be for any number of reasons (e.g. incorrect URL,
incorrect port, broken DNS, etc).

If the 'globe' icon in the menu bar of the card also doesn't open the Frigate
UI, the address entered is probably incorrect/inaccessible.

#### Mixed content

**Note:** This error should no longer be possible >= v0.1.5 .

If you are accessing your Home Assistant instance over `https`, you will likely
receive this error unless you have configured the card to also communicate with
Frigate via `https` (e.g. via a reverse proxy). This is because the browser is
blocking the attempt to mix access to both `https` and `http` resources.

The javascript console ([how to access](https://javascript.info/devtools)) will
show an error such as:

```
Mixed Content: The page at '<URL>' was loaded over HTTPS, but requested an 
insecure resource '<URL>'. This request has been blocked; the content must be
served over HTTPS.
```

Accessing both Home Assistant and Frigate over `https` will likely resolve this
issue (e.g. through the use of a reverse proxy in front of Frigate).
