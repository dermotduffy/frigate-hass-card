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
[![BuyMeCoffee](https://img.shields.io/badge/buy%20me%20a%20coffee-donate-yellow.svg?style=flat-square)](https://www.buymeacoffee.com/dermotdu)

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/image-view.png" alt="Frigate card example" width="400px">

# Frigate Lovelace Card

A full-featured Frigate Lovelace card:

* Live viewing.
* Clips and snapshot browsing via mini-gallery.
* Automatic updating to continually show latest clip / snapshot.
* Support for filtering events by zone and label.
* Arbitrary entity access via menu (e.g. motion sensor access).
* Fullscreen mode.
* Lovelace visual editing support.
* Full [Picture Elements](https://www.home-assistant.io/lovelace/picture-elements/) support.
* Theme friendly.
* **Advanced**: Support for [WebRTC](https://github.com/AlexxIT/WebRTC) live viewing by embedding the WebRTC card.

## Installation

* Use [HACS](https://hacs.xyz/) to install the card:

```
Home Assistant > HACS > Frontend > "Explore & Add Integrations" > Frigate Card
```

* Add the following to `configuration.yaml` (note that `/hacsfiles/` is just an [optimized equivalent](https://hacs.xyz/docs/categories/plugins#custom-view-hacsfiles) of `/local/community/` that HACS natively supports):

```yaml
lovelace:
  resources:
    - url: /hacsfiles/frigate-hass-card/frigate-hass-card.js
      type: module
```

* Restart Home Assistant.
* Add the new card to the Lovelace configuration!

### Advanced Users: Manual Installation

* Download the `frigate-hass-card.js` attachment of the desired [release](https://github.com/dermotduffy/frigate-hass-card/releases) to a location accessible by Home Assistant.
* Add the location as a Lovelace resource via the UI, or via [YAML configuration](https://www.home-assistant.io/lovelace/dashboards/#resources)) such as:

```yaml
lovelace:
  mode: yaml
  resources:
   - url: /local/frigate-hass-card.js
     type: module
```

## Options

### Basic

| Option           | Default | Description                                         |
| ------------- | - | --------------------------------------------- |
| `camera_entity` | | The optional Frigate camera entity to use in the `frigate` live provider view. Also used to automatically detect the `frigate_camera_name`.|
| `frigate_camera_name` | Autodetected from `camera_entity` if that is specified. | The Frigate camera name to use when communicating with the Frigate server, e.g. for viewing clips/snapshots or the JSMPEG live view. To view the birdseye view set this to `birdseye` and use the `frigate-jsmpeg` live provider.|
| `view_default` | `live` | The view to show by default. See [views](#views) below.|

### Optional

| Option           | Default | Description                                         |
| ------------- | --------------------------------------------- | - |
| `live_provider` | `frigate` | The means through which the live camera view is displayed. See [Live Provider](#live-provider) below.|
| `frigate_client_id` | `frigate` | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://blakeblackshear.github.io/frigate/usage/home-assistant/#multiple-instance-support).|
| `view_timeout` | | A numbers of seconds of inactivity after which the card will reset to the default configured view. Inactivity is defined as lack of interaction with the Frigate menu.|
| `frigate_url` | | The URL of the frigate server. If set, this value will be (exclusively) used for a `Frigate UI` menu button. |
| `autoplay_clip` | `false` | Whether or not to autoplay clips in the 'clip' [view](#views). Clips manually chosen in the clips gallery will still autoplay.|
| `live_preload` | `false` | Whether or not to preload the live view. Preloading causes the live view to render in the background so it's instantly available when requested. This consumes additional network/CPU resources continually.|
| `event_viewer.lazy_load` | `true` | Whether or not to lazily load media in the event viewer carousel. Setting this will false will fetch all media immediately which may make the carousel experience smoother at a cost of (potentially) a substantial number of simultaneous media fetches on load. |

#### Live Provider

|Live Provider|Latency|Frame Rate|Installation|Description|
| -- | -- | -- | -- | -- |
|`frigate`|High|High|Builtin|Use the built-in Home Assistant camera stream from Frigate (RTMP). The camera doesn't even need to be a Frigate camera! |
|`frigate-jsmpeg`|Lower|Low|Builtin|Stream the JSMPEG stream from Frigate (proxied via the Frigate integration). See [note below on the required integration version](#jsmpeg-troubleshooting) for this live provider to function. This is the only live provider that can view the Frigate `birdseye` view.|
|`webrtc`|Lowest|High|Separate installation required|Uses [WebRTC](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup, see [below](#webrtc).|

### Appearance

| Option           | Default | Description                                         |
| ------------- | --------------------------------------------- | - |
| `menu_mode` | `hidden-top` | The menu mode to show by default. See [menu modes](#menu-modes) below.|
| `menu_buttons.{frigate, live, clips, snapshots, download, frigate_ui, fullscreen}` | `true` | Whether or not to show these builtin actions in the card menu. |
| `controls.nextprev` | `thumbnails` | When viewing media, what kind of controls to show to move to the previous/next media item. Acceptable values: `thumbnails`, `chevrons`, `none` . |
| `dimensions.aspect_ratio_mode` | `dynamic` | The aspect ratio mode to use. Acceptable values: `dynamic`, `static`, `unconstrained`. See [aspect ratios](#aspect-ratios) below.|
| `dimensions.aspect_ratio` | `16:9` | The aspect ratio  to use. Acceptable values: `<W>:<H>` or `<W>/<H>`. See [aspect ratios](#aspect-ratios) below.|
| `image` | [embedded image](https://www.flickr.com/photos/dianasch/47543120431) | A static image URL for use with the `image` [view](#views).|

<a name="aspect-ratios"></a>

#### Aspect Ratio

The card can show live cameras, stored events (clip or snapshot) and an event gallery (clips or snapshots). Of these [views](#views), the gallery views have no intrinsic aspect-ratio, whereas the other views have the aspect-ratio of the media.

The card aspect ratio can be changed with the `dimensions.aspect_ratio_mode` and `dimensions.aspect_ratio` appearance options.

If no aspect ratio is specified or available, but one is needed then `16:9` will be used by default.

#### `dimensions.aspect_ratio_mode`:

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `dynamic` | The aspect-ratio of the card will match the aspect-ratio of the last loaded media. |
| `static` | A fixed aspect-ratio (as defined by `dimensions.aspect_ratio`) will be applied to all views. |
| `unconstrained` | No aspect ratio is enforced in any view, the card will expand with the content (may be especially useful for a panel-mode dashboard). |

#### `dimensions.aspect_ratio`:

* `16 / 9` or `16:9`: Default widescreen ratio.
* `4 / 3` or `4:3`: Default fullscreen ratio.
* `<W>/<H>` or `<W>:<H>`: Any arbitrary aspect-ratio.

#### Example aspect ratio configuration

Have the card aspect-ratio dynamically follow the last loaded media, but use `4:3` as the default when there is no such media:

```yaml
dimensions:
  aspect_ratio_mode: dynamic
  aspect_ratio: '4:3'
```

<a name="advanced-options"></a>

### Advanced Options

| Option           | Default | Description                                         |
| ------------- | - | --------------------------------------------- |
| `label` | | A label used to filter events (clips & snapshots), e.g. 'person'.|
| `zone` | | A zone used to filter events (clips & snapshots), e.g. 'front_door'.|
| `update_entities` | | A list of entity ids that should cause the whole card to re-render, this can be useful in the `clip` or `snapshot` mode to (for example) cause a motion sensor to trigger a card refresh. Configurable in YAML only. Entities used in picture elements / included in the menu do not need to be explicitly included here to be kept updated. |

<a name="webrtc"></a>

### WebRTC Options

WebRTC support blends the use of the ultra-realtime [WebRTC live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. A perfect combination!

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/webrtc.png" alt="Live viewing" width="400px">

| Option           | Default | Description                                         |
| ------------- | - | -------------------------------------------- |
| `webrtc.url` | | The RTSP url to pass to WebRTC. Specify this OR `webrtc.entity` (below).|
| `webrtc.entity` | | The RTSP entity to pass WebRTC. Specify this OR `webrtc.url` (above). |
| `webrtc.*`| | Any other options in a `webrtc:` YAML dictionary are silently passed through to WebRTC. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides.|

**Note**: WebRTC must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

#### Specifying the WebRTC Camera

WebRTC does **not** support use of Frigate-provided camera entities, as it
requires an RTSP stream which Frigate does not provide. There are two ways to
specify the WebRTC source camera:

* Manual setup of separate RTSP camera entities in Home Assistant ([see
  example](https://www.home-assistant.io/integrations/generic/#live-stream)).
  These entities will then be available for selection in the GUI card editor for
  the Frigate card under the WebRTC options, or can be manually specified with a
  `webrtc.entity` option in the YAML configuration for this card:

```yaml
[rest of Frigate card configuration]
webrtc:
  entity: 'camera.front_door_rstp`
```

* OR manually entering the WebRTC camera URL parameter in the GUI card editor,
  or configuring the `url` parameter as part of a manual Frigate card
  configuration, like the following example:

```yaml
[rest of Frigate card configuration]
webrtc:
  url: 'rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH'
```

See [WebRTC configuration](https://github.com/AlexxIT/WebRTC#configuration) for full configuration options.

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

## Picture Elements / Menu customizations

This card supports the [Picture Elements configuration
syntax](https://www.home-assistant.io/lovelace/picture-elements/) to seamlessly
allow the user to add custom elements to the card, which may be configured to
perform a variety of actions on `tap`, `double_tap` and `hold`.

In the card YAML configuration, elements may be manually added under an
`elements` key.

See the [action
documentation](https://www.home-assistant.io/lovelace/actions/#hold-action) for
more information on the action options available.

### Special Elements

This card supports all [Picture Elements](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) using the same syntax. The card also supports a handful of custom special elements to add special Frigate card functionality.

| Element name | Description                                         |
| ------------- | --------------------------------------------- |
| `custom:frigate-card-menu-icon` | Add an arbitrary icon to the Frigate Card menu. Configuration is ~identical to that of the [Picture Elements Icon](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) except with a type name of `custom:frigate-card-menu-icon`.|
| `custom:frigate-card-menu-state-icon` | Add a state icon to the Frigate Card menu that represents the state of a Home Assistant entity. Configuration is ~identical to that of the [Picture Elements State Icon](https://www.home-assistant.io/lovelace/picture-elements/#state-icon) except with a type name of `custom:frigate-card-menu-state-icon`.|
| `custom:frigate-card-conditional` | Restrict a set of elements to only render when the card is showing particular a particular [view](#views). See [configuration below](#frigate-card-conditional).|

<a name="frigate-card-conditional"></a>

### `custom:frigate-card-conditional`

Parameters for the `custom:frigate-card-conditional` element:

| Parameter | Description |
| ------------- | --------------------------------------------- |
| `type` | Must be `custom:frigate-card-conditional`. |
| `conditions` | A set of conditions that must evaluate to true in order for the elements to be rendered. |
| `conditions.view` | A list of [views](#views) in which these elements should be rendered. |
| `elements` | The elements to render. Can be any supported element, include additional condition or custom elements. |

See the [PTZ example below](#frigate-card-conditional-example) for a real-world example.
### Elements Examples

#### Menu icons

You can add custom icons to the menu with arbitrary actions.

<details>
  <summary>Expand: Custom menu icon</summary>

This example adds an icon that navigates the browser to the releases page for this
card:

```yaml
  - type: custom:frigate-card-menu-icon
    icon: mdi:book
    tap_action:
      action: url
      url_path: https://github.com/dermotduffy/frigate-hass-card/releases
```
</details>

#### Menu state icons

You can add custom state icons to the menu to show the state of an entity and complete arbitrary actions.

<details>
  <summary>Expand: Custom menu state icon</summary>

This example adds an icon that represents the state of the
`light.office_main_lights` entity, that toggles the light on double click.

```yaml
elements:
  - type: custom:frigate-card-menu-state-icon
    entity: light.office_main_lights
    tap_action:
      action: toggle
```
</details>

#### State badges

You can adds a state badge to the card showing arbitrary entity states.

<details>
  <summary>Expand: State badge</summary>

This example adds a state badge showing the temperature and hides the label text:

```yaml
  - type: state-badge
    entity: sensor.kitchen_temperature
    style:
      right: '-20px'
      top: 100px
      color: rgba(0,0,0,0)
      opacity: 0.5
```

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/picture_elements_temperature.png" alt="Picture elements temperature example" width="400px">
</details>

#### Conditional menu icons

You can have icons conditionally added to the menu based on entity state.

<details>
  <summary>Expand: Conditional menu icons</summary>

This example only adds the light entity to the menu if a light is on.

```yaml
  - type: conditional
    conditions:
      - entity: light.kitchen
        state: 'on'
    elements:
      - type: custom:frigate-card-menu-state-icon
        entity: light.kitchen
        tap_action:
          action: toggle
```
</details>

<a name="frigate-card-conditional-example"></a>

#### Restricting icons to certain views

You can restrict icons to only show for certain [views](#views) using a
`custom:frigate-card-conditional` element (e.g. PTZ controls)

<details>
  <summary>Expand: View-based conditions (e.g. PTZ controls)</summary>

This example shows PTZ icons that call a PTZ service, but only in the `live` view.

```yaml
elements:
  - type: custom:frigate-card-conditional
    conditions:
      view:
        - live
    elements:
      - type: icon
        icon: mdi:arrow-up
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 25px
          bottom: 50px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: up
      - type: icon
        icon: mdi:arrow-down
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 25px
          bottom: 0px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: down
      - type: icon
        icon: mdi:arrow-left
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 50px
          bottom: 25px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: left
      - type: icon
        icon: mdi:arrow-right
        style:
          background: rgba(255, 255, 255, 0.25)
          border-radius: 5px
          right: 0px
          bottom: 25px
        tap_action:
          action: call-service
          service: amcrest.ptz_control
          service_data:
            entity_id: camera.kitchen
            movement: right
```
</details>

<a name="views"></a>

## Views

This card supports several different views:

| Key           | Description                                         |
| ------------- | --------------------------------------------- |
|`live` (default)| Shows the live camera view, either the name Frigate view or [WebRTC](#webrtc) if configured.|
|`snapshots`|Shows the snapshot gallery for this camera/zone/label.|
|`snapshot`|Shows the most recent snapshot for this camera/zone/label. Can also be accessed by holding down the `snapshots` menu icon.|
|`clips`|Shows the clip gallery for this camera/zone/label.|
|`clip`|Shows the most recent clip for this camera/zone/label.  Can also be accessed by holding down the `clips` menu icon.|
|`image`|Shows a static image specified by the `image` parameter, can be used as a discrete default view or a screensaver (via `view_timeout`).|

### Automatic updates in the `clip` or `snapshot` view

Updates will occur whenever on every change of the state of the `camera_entity`
or any entity configured under `update_entities`. In particular, if the desire is
to have an auto-refreshing view of the most recent event, the `camera_entity`
will not be sufficient alone since the Home Assistant state for Frigate camera
entities does not change often. Instead, use the Frigate binary_sensor for that
camera (or any other entity at your discretion) to trigger the update:

```yaml
update_entities:
  - binary_sensor.office_person_motion
```

See the [advanced options](#advanced-options) above.

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

You must be using a version of the [Frigate integration](https://github.com/blakeblackshear/frigate-hass-integration) >= 2.1.0
to use JSMPEG proxying. The `frigate-jsmpeg` live provider will not work with earlier
integration versions.

### Fullscreen button does not appear on iPhone

Unfortunately, [iOS does not support the Javascript fullscreen
API](https://caniuse.com/fullscreen). As a result, card-level fullscreen support
for the iPhone is not currently possible.

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
