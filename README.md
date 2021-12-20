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
* Carousel/Swipeable media & thumbnails.
* Direct media downloads.
* Lovelace visual editing support.
* Full [Picture Elements](https://www.home-assistant.io/lovelace/picture-elements/) support.
* Theme friendly.
* **Advanced**: Support for [WebRTC](https://github.com/AlexxIT/WebRTC) live viewing by embedding the WebRTC card.

## Screenshots Below!

See more [screenshots](#screenshots) below.

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

<a name="manual-installation"></a>

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

### Basic Options

| Option | Default | Description |
| - | - | - |
| `camera_entity` | | The optional Frigate camera entity to use in the `frigate` live provider view. Also used to automatically detect the value of `frigate.camera_name`.|

### Frigate Server Options

All configuration is under:

 ```yaml
frigate:
```


| Option | Default | Description |
| - | - | - |
| `camera_name` | Autodetected from `camera_entity` if that is specified. | The Frigate camera name to use when communicating with the Frigate server, e.g. for viewing clips/snapshots or the JSMPEG live view. To view the birdseye view set this to `birdseye` and use the `frigate-jsmpeg` live provider.|
| `url` | | The URL of the frigate server. If set, this value will be (exclusively) used for a `Frigate UI` menu button. |
| `label` | | A Frigate label / object filter used to filter events (clips & snapshots), e.g. 'person'.|
| `zone` | | A Frigate zone used to filter events (clips & snapshots), e.g. 'front_door'.|
| `client_id` | `frigate` | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://docs.frigate.video/integrations/home-assistant/#multiple-instance-support).|

### View Options

All configuration is under:

 ```yaml
view:
```

| Option | Default | Description |
| - | - | - |
| `default` | `live` | The view to show in the card by default. See [views](#views) below.|
| `timeout` | | A numbers of seconds of inactivity after which the card will reset to the default configured view. Inactivity is defined as lack of interaction with the Frigate menu.|
| `actions` | | Actions to use for all views, individual actions may be overriden by view-specific actions. See [actions](#actions) below.|
| `update_force` | `false` | Whether card updates/refreshes should ignore playing media and human interaction. See [card updates](#card-updates) below for behavior and usecases.|
| `update_entities` | | **YAML only**: A list of entity ids that should cause the whole card to re-render. Entities used in picture elements / included in the menu do not need to be explicitly included here to be kept updated. See [card updates](#card-updates) below for behavior and usecases.|

### Menu Options

All configuration is under:

 ```yaml
menu:
```

| Option | Default | Description |
| - | - | - |
| `mode` | `hidden-top` | The menu mode to show by default. See [menu modes](#menu-modes) below.|
| `button_size` | `40px` | The size of the menu buttons [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|
| `buttons` | | Whether to show or hide built-in buttons. See below. |
| `conditions` | | Condition(s) that must be met in order for the menu to be displayed. These conditions use the same format as the `custom:frigate-card-conditional` card (see [Possible conditions](#frigate-card-conditions) below). If conditions are specified but not met, then the menu is not rendered.|

#### Menu Options: Buttons

All configuration is under:

```yaml
menu:
  buttons:
```

| Option | Default | Description |
| - | - | - |
| `frigate` | `true` | Whether to show the `Frigate` menu button: brings the user to the default configured view (`view.default`), or collapses/expands the menu if the `menu.mode` is `hidden-*` . |
| `cameras` | `true` | Whether to show the camera selection submenu. Will only appear if multiple cameras are configured. |
| `live` | `true` | Whether to show the `live` view menu button: brings the user to the `live` view. See [views](#views) below.|
| `clips` | `true` | Whether to show the `clips` view menu button: brings the user to the `clips` view on tap and the most-recent `clip` view on hold. See [views](#views) below.|
| `snapshots` | `true` | Whether to show the `snapshots` view menu button: brings the user to the `clips` view on tap and the most-recent `snapshot` view on hold. See [views](#views) below.|
| `image` | `false` | Whether to show the `image` view menu button: brings the user to the static `image` view. See [views](#views) below.|
| `download` | `true` | Whether to show the `download` menu button: allow direct download of the media being displayed.|
| `frigate_ui` | `true` | Whether to show the `frigate_ui` menu button: brings the user to a context-appropriate page on the Frigate UI (e.g. the camera homepage). Will only appear if the `frigate.url` option is set.|
| `fullscreen` | `true` | Whether to show the `fullscreen` menu button: expand the card to consume the fullscreen. |

### Live Options

All configuration is under:

 ```yaml
live:
```

| Option | Default | Description |
| - | - | - |
| `preload` | `false` | Whether or not to preload the live view. Preloading causes the live view to render in the background so it's instantly available when requested. This consumes additional network/CPU resources continually.|
| `provider` | `frigate` | The means through which the live camera view is displayed. See [Live Provider](#live-provider) below.|
| `actions` | | Actions to use for the `live` view. See [actions](#actions) below.|
| `controls` | | Configuration for the `live` view controls. See below. |
| `jsmpeg` | | Configuration for the `frigate-jsmpeg` live provider. See below.|
| `webrtc` | | Configuration for the `webrtc` live provider. See below.|

#### Available Live Providers

|Live Provider|Latency|Frame Rate|Installation|Description|
| -- | -- | -- | -- | -- |
|`frigate`|High|High|Builtin|Use the built-in Home Assistant camera stream from Frigate (RTMP). The camera doesn't even need to be a Frigate camera! Latency may be lowered through the use of [LL-HLS](https://www.home-assistant.io/integrations/stream/#ll-hls).|
|`frigate-jsmpeg`|Lower|Low|Builtin|Stream the JSMPEG stream from Frigate (proxied via the Frigate integration). See [note below on the required integration version](#jsmpeg-troubleshooting) for this live provider to function. This is the only live provider that can view the Frigate `birdseye` view.|
|`webrtc`|Lowest|High|Separate installation required|Uses [WebRTC](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup, see [below](#webrtc).|


#### Live Provider: JSMPEG Configuration

All configuration is under:

```yaml
live:
  jsmpeg:
```

| Option | Default | Description |
| - | - | - |
| `options` | | **Advanced users only**: Control the underlying [JSMPEG library options](https://github.com/phoboslab/jsmpeg#usage). Supports setting these JSMPEG options `{audio, video, pauseWhenHidden, disableGl, disableWebAssembly, preserveDrawingBuffer, progressive, throttled, chunkSize, maxAudioLag, videoBufferSize, audioBufferSize}`. This is not necessary for the vast majority of users: only set these flags if you know what you're doing, as you may entirely break video rendering in the card.|

#### Live Provider: WebRTC Configuration

All configuration is under:

```yaml
live:
  webrtc:
```

| Option | Default | Description |
| - | - | - |
| `entity` | | The RTSP entity to pass WebRTC. Specify this OR `webrtc.url` (above). |
| `url` | | The RTSP url to pass to WebRTC. Specify this OR `webrtc.entity` (below).|
| `*`| | Any other options in the `webrtc:` YAML dictionary are silently passed through to WebRTC. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides.|

#### Live Controls: Thumbnails

All configuration is under:

```yaml
live:
  controls:
    thumbnails:
```

| Option | Default | Description |
| - | - | - |
| `mode` | `none` | Whether to show the thumbnail carousel `below` the media, `above` the media or to hide it entirely (`none`).|
| `size` | `100px` | The size of the thumbnails in the thumbnail carousel [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|
| `media` | `clips` | Whether to show `clips` or `snapshots` in the thumbnail carousel in the `live` view.|

### Event Viewer Options

The `event_viewer` is used for viewing all `clip` and `snapshot` media, in a media carousel.

All configuration is under:

```yaml
event_viewer:
```


| Option | Default | Description |
| - | - | - |
| `autoplay_clip` | `false` | Whether or not to autoplay clips in the 'clip' [view](#views). Clips manually chosen in the clips gallery will still autoplay.|
| `lazy_load` | `true` | Whether or not to lazily load media in the event viewer carousel. Setting this will false will fetch all media immediately which may make the carousel experience smoother at a cost of (potentially) a substantial number of simultaneous media fetches on load. |
| `draggable` | `true` | Whether or not the event viewer carousel can be dragged left or right, via touch/swipe and mouse dragging. |
| `controls` | | Configuration for the event viewer. See below. |
| `actions` | | Actions to use for all views that use the `event_viewer` (e.g. `clip`, `snapshot`). See [actions](#actions) below.|

#### Event Viewer Controls: Next / Previous

All configuration is under:

```yaml
event_viewer:
  controls:
    next_previous:
```

| Option | Default | Description |
| - | - | - |
| `style` | `thumbnails` | When viewing media, what kind of controls to show to move to the previous/next media item. Acceptable values: `thumbnails`, `chevrons`, `none` . |
| `size` | `48px` | The size of the next/previous controls [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|

#### Event Viewer Controls: Thumbnails

All configuration is under:

```yaml
event_viewer:
  controls:
    thumbnails:
```

| Option | Default | Description |
| - | - | - |
| `mode` | `none` | Whether to show the thumbnail carousel `below` the media, `above` the media or to hide it entirely (`none`).|
| `size` | `100px` | The size of the thumbnails in the thumbnail carousel [in CSS Units](https://www.w3schools.com/cssref/css_units.asp).|

### Event Gallery Options

The `event_gallery` is used for providing an overview of all `clips` and `snapshots` in a thumbnail gallery.

All configuration is under:

```yaml
event_gallery:
```

| Option | Default | Description |
| - | - | - |
| `actions` | | Actions to use for all views that use the `event_gallery` (e.g. `clips`, `snapshots`). See [actions](#actions) below.|

### Image Options

All configuration is under:

```yaml
image:
```

| Option | Default | Description |
| - | - | - |
| `src` | [embedded image](https://www.flickr.com/photos/dianasch/47543120431) | A static image URL for use with the `image` [view](#views).|
| `actions` | | Actions to use for the `image` view. See [actions](#actions) below.|

### Dimension Options

All configuration is under:

```yaml
dimensions:
```

| Option | Default | Description |
| - | - | - |
| `aspect_ratio_mode` | `dynamic` | The aspect ratio mode to use. Acceptable values: `dynamic`, `static`, `unconstrained`. See [aspect ratios](#aspect-ratios) below.|
| `aspect_ratio` | `16:9` | The aspect ratio  to use. Acceptable values: `<W>:<H>` or `<W>/<H>`. See [aspect ratios](#aspect-ratios) below.|

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

<a name="aspect-ratios"></a>

#### Aspect Ratio

The card can show live cameras, stored events (clip or snapshot) and an event
gallery (clips or snapshots). Of these [views](#views), the gallery views have
no intrinsic aspect-ratio, whereas the other views have the aspect-ratio of the
media.

The card aspect ratio can be changed with the `dimensions.aspect_ratio_mode` and
`dimensions.aspect_ratio` options described above.

If no aspect ratio is specified or available, but one is needed then `16:9` will
be used by default.

<a name="webrtc"></a>

### Using WebRTC

WebRTC support blends the use of the ultra-realtime [WebRTC live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. A perfect combination!

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/webrtc.png" alt="Live viewing" width="400px">


**Note**: WebRTC must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

#### Specifying The WebRTC Camera

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
live:
  webrtc:
    entity: 'camera.front_door_rstp`
```

* OR manually entering the WebRTC camera URL parameter in the GUI card editor,
  or configuring the `url` parameter as part of a manual Frigate card
  configuration, like the following example:

```yaml
[rest of Frigate card configuration]
live:
  webrtc:
    url: 'rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH'
```

See [WebRTC configuration](https://github.com/AlexxIT/WebRTC#configuration) for full configuration options.

## Picture Elements / Menu Customizations

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
| `custom:frigate-card-menu-submenu` | Add a configurable submenu dropdown. See [configuration below](#frigate-card-menu-submenu).|
| `custom:frigate-card-conditional` | Restrict a set of elements to only render when the card is showing particular a particular [view](#views). See [configuration below](#frigate-card-conditional).|

<a name="frigate-card-submenu"></a>

#### `custom:frigate-card-menu-submenu`

Parameters for the `custom:frigate-card-menu-submenu` element are identical to the parameters of the [stock Home Assistant Icon Element](https://www.home-assistant.io/lovelace/picture-elements/#icon-element) with the exception of these parameters which differ:

| Parameter | Description |
| - | - |
| `type` | Must be `custom:frigate-card-menu-submenu`. |
| `items` | A list of menu items, as described below. | 

##### Submenu Items

| Parameter | Default | Description |
| - | - | - |
| `title` | | An optional title to display. |
| `icon` | | An optional item icon to display. |
| `entity` | | An optional Home Assistant entity from which title, icon and style can be automatically computed. |
| `state_color` | `true` | Whether or not the title and icon should be stylized based on state. |
| `style` | | Position and style the element using CSS. |
| `tap_action`, `double_tap_action` or `hold_action` | | Standard [Home Assistant action configuration](https://www.home-assistant.io/lovelace/actions). |

See the [Configuring a Submenu example](#configuring-a-submenu-example).

<a name="frigate-card-conditional"></a>

#### `custom:frigate-card-conditional`

Parameters for the `custom:frigate-card-conditional` element:

| Parameter | Description |
| ------------- | --------------------------------------------- |
| `type` | Must be `custom:frigate-card-conditional`. |
| `conditions` | A set of conditions that must evaluate to true in order for the elements to be rendered. See below. |
 `elements` | The elements to render. Can be any supported element, include additional condition or custom elements. |

<a name="frigate-card-conditions"></a>

##### Frigate Card Conditions

All variables listed are under a `conditions:` section. 

| Condition | Description |
| ------------- | --------------------------------------------- |
| `view` | A list of [views](#views) in which these elements should be rendered. |
| `fullscreen` | If `true` the elements are only rendered if the card is in fullscreen mode. If `false` the elements are only rendered if the card is **NOT** in fullscreen mode.|

See the [PTZ example below](#frigate-card-conditional-example) for a real-world example.

### Special Actions

#### `custom:frigate-card-action`

| Action name | Description |
| - | - |
| `custom:frigate-card-action` | Call a Frigate Card action. Acceptable values are `frigate`, `clip`, `clips`, `image`, `live`, `snapshot`, `snapshots`, `download`, `frigate_ui`, `fullscreen`.|

| Value | Description |
| - | - |
| `frigate` | Show/hide the menu or trigger the default view. |
| `clip`, `clips`, `image`, `live`, `snapshot`, `snapshots` | Trigger the named [view](#views).|
|`download`|Download the displayed media.|
|`frigate_ui`|Open the Frigate UI at the configured URL.|
|`fullscreen`|Toggle fullscreen.| 


<a name="views"></a>

## Views

This card supports several different views:

| Key           | Description                                         |
| ------------- | --------------------------------------------- |
|`live` (default)| Shows the live camera view, either the name Frigate view or [WebRTC](#webrtc) if configured.|
|`snapshots`|Shows an event gallery of snapshots for this camera/zone/label.|
|`snapshot`|Shows an event viewer for the most recent snapshot for this camera/zone/label. Can also be accessed by holding down the `snapshots` menu icon.|
|`clips`|Shows an event gallery of clips for this camera/zone/label.|
|`clip`|Shows an event viewer for the most recent clip for this camera/zone/label. Can also be accessed by holding down the `clips` menu icon.|
|`image`|Shows a static image specified by the `image` parameter, can be used as a discrete default view or a screensaver (via `view_timeout`).|

### Navigating From A Snapshot To A Clip

Clicking on a snapshot will take the user to a clip that was taken at the ~same
time as the snapshot (if any).

<a name="actions"></a>

## Card & View Actions

Actions may be attached to the card itself, to trigger action when the card
experiences a `tap`, `double_tap` or `hold` event. These actions can be
specified both for the overall card and for individual groups of view.

| Configuration path | Views to which it refers |
| - | - |
| `view.actions` | All (may be overriden by the below) |
| `event_viewer.actions` | `clip`, `snapshot` |
| `event_gallery.actions` | `clips`, `snapshots` |
| `live.actions` | `live` |
| `image.actions` | `image` |

If an action is configured for both the whole card (`view.actions`) and a more
specific view (e.g. `live.actions`) then the actions are merged, with the more
specific overriding the less specific (see example below).

The format for actions is the standard Home Assistant [action
format](https://www.home-assistant.io/lovelace/actions/#tap-action) as well as
the custom [Frigate card action](#frigate-card-action) to trigger Frigate card
changes.

**Note:** The card itself obviously relies on human interactions to function
(e.g. `tap` on the menu should activate that button, `tap` on a gallery thumbnail
should open that piece of media, etc). These internal actions are executed
_also_, which means that a card-wide `tap` action probably isn't that useful as
it may be disorienting to the user and will trigger on all kinds of basic
interaction on the card (e.g. tapping/clicking a menu button).


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

<a name="screenshots"></a>

## Screenshots

### Full Viewing Of Events

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/gallery.png" alt="Gallery" width="400px">

### Live Viewing With Thumbnail Carousel

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/live-thumbnails.gif" alt="Live view with event thumbnails" width="400px">

### Clip Viewing With Thumbnail Carousel

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/viewer-thumbnails.gif" alt="Viewer with event thumbnails" width="400px">

### Hover Menu / Thumbnail Next & Previous Controls

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/viewer-with-thumbnail-next-prev.gif" alt="Viewer with event thumbnails" width="400px">

## Card Editing

This card supports full editing via the Lovelace card editor. Additional arbitrary configuration for WebRTC may be specified in YAML mode.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/editor.png" alt="Live viewing" width="400px">

## Configurable Submenus

This card supports fully configurable submenus.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/submenu.gif" alt="Configurable submenus" width="400px">

## Examples

### WebRTC

<details>
  <summary>Expand: Basic WebRTC configuration</summary>

```yaml
type: 'custom:frigate-card'
camera_entity: camera.front_door
live:
  provider: webrtc
  webrtc:
    entity: camera.front_door_rtsp
```

</details>

### Static Aspect Ratios

You can set a static aspect ratio.

<details>
  <summary>Expand: Static 4:3 aspect ratios</summary>

```yaml
[...]
dimensions:
  aspect_ratio_mode: dynamic
  aspect_ratio: '4:3'
```
</details>

### Adding Menu Icons

You can add custom icons to the menu with arbitrary actions.

<details>
  <summary>Expand: Custom menu icon</summary>

This example adds an icon that navigates the browser to the releases page for this
card:

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-icon
    icon: mdi:book
    tap_action:
      action: url
      url_path: https://github.com/dermotduffy/frigate-hass-card/releases
```
</details>

### Adding Menu State Icons

You can add custom state icons to the menu to show the state of an entity and complete arbitrary actions.

<details>
  <summary>Expand: Custom menu state icon</summary>

This example adds an icon that represents the state of the
`light.office_main_lights` entity, that toggles the light on double click.

```yaml
[...]
elements:
  - type: custom:frigate-card-menu-state-icon
    entity: light.office_main_lights
    tap_action:
      action: toggle
```
</details>

### Adding State Badges

You can add a state badge to the card showing arbitrary entity states.

<details>
  <summary>Expand: State badge</summary>

This example adds a state badge showing the temperature and hides the label text:

```yaml
[...]
elements:
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

### Adding State Badges

You can have icons conditionally added to the menu based on entity state.

<details>
  <summary>Expand: Conditional menu icons</summary>

This example only adds the light entity to the menu if a light is on.

```yaml
[...]
elements:
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

### Restricting Icons To Certain Views

You can restrict icons to only show for certain [views](#views) using a
`custom:frigate-card-conditional` element (e.g. PTZ controls)

<details>
  <summary>Expand: View-based conditions (e.g. PTZ controls)</summary>

This example shows PTZ icons that call a PTZ service, but only in the `live` view.

```yaml
[...]
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

<a name="frigate-card-action"></a>

### Triggering Card Actions

You can control the card itself with the `custom:frigate-card-action` action.

<details>
  <summary>Expand: Custom fullscreen button</summary>

This example shows an icon that toggles the card fullscreen mode.

```yaml
[...]
elements:
  - type: icon
    icon: mdi:fullscreen
    style:
      left: 40px
      top: 40px
    tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
```
</details>

### Adding Card-wide Actions

You can add actions to the card to be trigger on `tap`, `double_tap` or `hold`. See [actions](#actions) above.

<details>
  <summary>Expand: Adding a card-wide action</summary>

In this example double clicking the card in any view will cause the card to go
into fullscreen mode, **except** when the view is `live` in which case the
office lights are toggled.

```yaml
[...]
view:
  actions:
    double_tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
live:
  provider: frigate-jsmpeg
  actions:
    entity: light.office_main_lights
    double_tap_action:
      action: toggle
```
</details>

### Hiding The Menu In Certain Circumstances

You can add conditions to the menu, which will hide the menu unless met.

<details>
  <summary>Expand: Hiding the menu</summary>

This example hides the menu unless the card is in fullscreen mode, and uses a card-wide action to enable fullscreen mode on `double_tap`:

```yaml
[...]
view:
  actions:
    double_tap_action:
      action: custom:frigate-card-action
      frigate_card_action: fullscreen
menu:
  conditions:
    fullscreen: true
```

</details>

<a name="configuring-a-submenu-example"></a>

### Configuring a submenu

You can add submenus to the menu -- buttons that when pressed reveal a dropdown submenu of configurable options.

<details>
  <summary>Expand: Adding a submenu</summary>

This example shows a submenu that illustrates a variety of actions.

```yaml
[...]
elements:
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
        tap_action:
          action: url
          url_path: https://www.google.com
      - title: Fullscreen
        icon: mdi:fullscreen
        tap_action:
          action: custom:frigate-card-action
          frigate_card_action: fullscreen
```

</details>

<a name="card-updates"></a>

## Card Refreshes / Updates

Automated card refreshes / updates are minimized to avoid disruption to the
user, in particular when media is playing. Three sets of flags govern when the
card will automatically re-render in the absence of human interaction.

The following table describes the behavior these 3 flags have.

### Card Update Truth Table

| `view.timeout` | `view.update_force` | `view.update_entities` | Behavior |
| :-: | :-: | :-: | - |
| Unset or `0` | *(Any value)* | Unset | Card will not automatically re-render. |
| Unset or `0` | `false` | *(Any entity)* | Card will reload **current** view when entity state changes, unless media is playing. |
| Unset or `0` | `true` | *(Any entity)* | Card will reload **current** view when entity state changes. |
| `X` seconds | `false` | Unset | Card will reload **default** view `X` seconds after human interaction stops, unless media is playing. |
| `X` seconds | `false` | *(Any entity)* | Card will reload **default** view `X` seconds after human interaction stops and reload the **current** view when entity state changes -- in both cases unless media is playing. |
| `X` seconds | `true` | Unset | Card will reload **default** view every `X` seconds. |
| `X` seconds | `true` | *(Any entity)* | Card will reload **default** view every `X` seconds and reload the **current** view when entity state changes.  |

### Usecases For Automated Refreshes

 * Refreshing the `live` thumbnails periodically.
```yaml
view:
  default: live
  timeout: 30
  force: true
```
 * Using `clip` or `snapshot` as the default view (for the most recent clip or
   snapshot respectively) and having the card automatically refresh (to fetch a
   newer clip/snapshot) when an entity state changes. Use the Frigate
   binary_sensor for that camera (or any other entity at your discretion) to
   trigger the update:
```yaml
view:
  update_entities:
    - binary_sensor.office_person_motion
```

## Troubleshooting

<a name="jsmpeg-troubleshooting"></a>

### JSMPEG Live Camera Only Shows A 'spinner'

You must be using a version of the [Frigate integration](https://github.com/blakeblackshear/frigate-hass-integration) >= 2.1.0
to use JSMPEG proxying. The `frigate-jsmpeg` live provider will not work with earlier
integration versions.

### Fullscreen Button Does Not Appear On iPhone

Unfortunately, [iOS does not support the Javascript fullscreen
API](https://caniuse.com/fullscreen). As a result, card-level fullscreen support
for the iPhone is not currently possible.

### Android Will Not Render >4 JSMPEG Live Views

Android Webview (as used by Android Chrome / Android Home Assistant Companion)
appears to severely limit the number of simultaneous OpenGL contexts that can be
opened. The JSMPEG player (that this card uses), consumes 1 OpenGL context per
rendering.

This limitation may be worked around (at a performance penalty) by disabling
OpenGL for JSMPEG live views:

```yaml
live:
  jsmpeg:
    options:
      disableGl: true
```

[This bug](https://github.com/dermotduffy/frigate-hass-card/issues/191) has some
more discussion on this topic. New ideas to address this underlying limitation
most welcome!

## Development

### Building

```sh
$ git clone https://github.com/dermotduffy/frigate-hass-card
$ cd frigate-hass-card
$ npm install
$ npm run build
```

Resultant build will be at `dist/frigate-hass-card.js`. This could be installed via the [manual installation instructions above](#manual-installation).

### Releasing

 1. Merge a PR that contains only a `package.json` and `const.ts` version number bump (see [this example](https://github.com/dermotduffy/frigate-hass-card/commit/a854187d4a354f8841ad284d75b0afbed7b634c4)).
 1. Go to the [releases page](https://github.com/dermotduffy/frigate-hass-card/releases).
 1. A release draft will automatically have been created, click 'Edit'.
 1. Use the same version number for the release title and tag.
 1. Choose 'This is a pre-release' for a beta version.
 1. Hit 'Publish release'.
