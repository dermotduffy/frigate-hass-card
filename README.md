<img src="https://raw.githubusercontent.com/blakeblackshear/frigate-hass-integration/master/frigate.png"
     alt="Frigate icon"
     width="35%"
     align="right"
     style="float: right; margin: 10px 0px 20px 20px;" />
     
[![GitHub Release](https://img.shields.io/github/release/dermotduffy/frigate-hass-card.svg?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/releases)
[![Build Status](https://img.shields.io/github/workflow/status/dermotduffy/frigate-hass-card/Build?style=flat-square)](https://github.com/dermotduffy/frigate-hass-card/actions/workflows/build.yaml)
[![License](https://img.shields.io/github/license/dermotduffy/frigate-hass-card.svg?style=flat-square)](LICENSE)
[![hacs](https://img.shields.io/badge/HACS-custom-orange.svg?style=flat-square)](https://hacs.xyz)

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/menu_clip.png" alt="Live viewing" width="400px">

# Frigate Lovelace Card

A full-featured Frigate Lovelace card:
   * Live viewing.
   * Clips and snapshot browsing via mini-gallery.
   * Automatic updating to continually show latest clip / snapshot.
   * Support for filtering events by zone and label.
   * Motion sensor access.
   * Full Lovelace editing support.
   * **Advanced**: Support for [WebRTC](https://github.com/AlexxIT/WebRTC) live viewing.

## Options

### Required

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `camera_entity` | The Frigate camera entity to show by default on the card.|
| `frigate_url` | The URL of the frigate server. Must be manually specified, as the URL from the underlying device is not available to Lovelace cards.|

### Optional

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `motion_entity` | A binary sensor to show in the menu (e.g. a Frigate motion binary sensor) and to use to trigger card updates.|
| `frigate_camera_name` | By default, the Frigate camera name is assumed to be the string after the `camera.` in the entity name. This parameter allows that heuristic to be overriden for cases where the entity name does not cleanly map to the Frigate camera name.|
| `view_default` | The view to show by default. See [views](#views) below.|
| `view_timeout` | A numbers of seconds of inactivity after which the card will reset to the default configured view. Inactivity is defined as lack of interaction with the Frigate menu.|

### Advanced

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `label` | A label used to filter events (clips & snapshots), e.g. 'person'.|
| `zone` | A zone used to filter events (clips & snapshots), e.g. 'front_door'.|

<a name="webrtc"></a>
### WebRTC Options

WebRTC support allows the use of the ultra-realtime [WebRTC live view](https://github.com/AlexxIT/WebRTC) along with the event browsing of Frigate. A perfect combination!

Note: WebRTC must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)).

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/webrtc.png" alt="Live viewing" width="400px">

| Option           | Description                                         |
| ------------- | --------------------------------------------- |
| `live_provider` | Whether `frigate` or `webrtc` should provide the live camera view.|
| `webrtc.entity` | The RTSP entity to use with WebRTC.|
| `webrtc.*`| Any other options in a `webrtc:` YAML dictionary are silently passed through to WebRTC. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides.|

<a name="views"></a>
## Views

| Key           | Description                                         |
| ------------- | --------------------------------------------- |
|`live`| Shows the live camera view, either the name Frigate view or [WebRTC](#webrtc) if configured.|
|`snapshots`|Shows the snapshot gallery for this camera/zone/label.|
|`snapshot`|Shows the most recent snapshot for this camera/zone/label.|
|`clips`|Shows the clip gallery for this camera/zone/label.|
|`clip`|Shows the most recent clip for this camera/zone/label.|

For the `clip` or `snapshot` view, the most recent clip/snapshot is rendered. This will automatically update whenever the state of the `camera_entity` or `motion_entity` changes. In particular, if the desire is to have a live view of the most recent event, you should configure `motion_entity` to a Frigate binary sensor associated with that camera in order to trigger updates more regularly (the underlying camera entity state does not change often, the motion binary sensors do).

### Screenshot: Snapshot / Clip Gallery

Full viewing of clips 

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/gallery.png" alt="Gallery" width="400px">

## Card Editing

This card supports full editing via the Lovelace card editor. Additional arbitrary configuration for WebRTC may be specified in YAML mode.

<img src="https://raw.githubusercontent.com/dermotduffy/frigate-hass-card/main/images/editor.png" alt="Live viewing" width="400px">
