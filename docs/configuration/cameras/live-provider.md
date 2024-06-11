# `live_provider`

## Overview

The `live_provider` parameter determines what provides the live stream for a camera. Each provider offers different capabilities:

| Live Provider                      | Latency | Frame Rate | Loading Time | Installation                   | Description                                                                                                                                                                                                     |
| ---------------------------------- | ------- | ---------- | ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go2rtc`                           | Best    | High       | Better       | Builtin                        | Uses [go2rtc](https://github.com/AlexxIT/go2rtc) to stream live feeds. This is supported by Frigate &gt;= `0.12`.                                                                                               |
| `ha` (default HA configuration)    | Poor    | High       | Better       | Builtin                        | Use the built-in Home Assistant camera stream. The camera doesn't even need to be a Frigate camera!                                                                                                             |
| `ha` (Native WebRTC)               | Best    | High       | Better       | Builtin                        | Use the built-in Home Assistant camera streams -- can be configured to use [native WebRTC](https://www.home-assistant.io/integrations/rtsp_to_webrtc/) offering a very low-latency feed direct to your browser. |
| `ha` (when configured with LL-HLS) | Better  | High       | Better       | Builtin                        | Use the built-in Home Assistant camera streams -- can be configured to use an [LL-HLS](https://www.home-assistant.io/integrations/stream/#ll-hls) feed for lower latency.                                       |
| `image`                            | Poor    | Poor       | Best         | Builtin                        | Use refreshing snapshots of the built-in Home Assistant camera streams.                                                                                                                                         |
| `jsmpeg`                           | Better  | Low        | Poor         | Builtin                        | Use a the JSMPEG stream.                                                                                                                                                                                        |
| `webrtc-card`                      | Best    | High       | Better       | Separate installation required | Embed's [AlexxIT's WebRTC Card](https://github.com/AlexxIT/WebRTC) to stream live feed, requires manual extra setup. See below. Not to be confused with native Home Assistant WebRTC (use the `ha` provider).   |

## `go2rtc`

The `go2rtc` block configures use of the `go2rtc` live provider. This configuration is included as part of a camera entry in the `cameras` list.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
    go2rtc:
      # [...]
```

| Option   | Default                                                                                                                                              | Description                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modes`  | `[webrtc, mse, mp4, mjpeg]`                                                                                                                          | An ordered list of `go2rtc` modes to use. Valid values are `webrtc`, `mse`, `mp4` or `mjpeg` values.                                                                             |
| `stream` | Determined by camera engine (e.g. `frigate` camera name).                                                                                            | A valid `go2rtc` stream name.                                                                                                                                                    |
| `url`    | Determined by camera engine (e.g. the `frigate` engine will automatically generate a URL for the go2rtc backend that runs in the Frigate container). | The root `go2rtc` URL the card should stream the video from. This is only needed for non-Frigate usecases, or advanced Frigate usecases. Example: `http://my-custom-go2rtc:1984` |

## `image`

All configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: image
    image:
      # [...]
```

| Option            | Default | Description                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refresh_seconds` | 1       | The image will be refreshed at least every `refresh_seconds`. `0` implies no refreshing.                                                                                                                                                                                                                                                                             |
| `url`             |         | **Advanced**: A static image URL to be fetched in lieu of the Home Assistant image for the given camera. This may be useful for advanced configurations where the camera image is being provided by some non-Home Assistant system. This will also set the temporary loading image used when `show_image_during_load` is set to true under the `live` configuration. |

## `jsmpeg`

All configuration is under:

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: jsmpeg
    jsmpeg:
      # [...]
```

| Option    | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options` |         | **Advanced users only**: Control the underlying [JSMPEG library options](https://github.com/phoboslab/jsmpeg#usage). Supports setting these JSMPEG options `{audio, video, pauseWhenHidden, disableGl, disableWebAssembly, preserveDrawingBuffer, progressive, throttled, chunkSize, maxAudioLag, videoBufferSize, audioBufferSize}`. This is not necessary for the vast majority of users: only set these flags if you know what you're doing, as you may entirely break video rendering in the card. |

## `webrtc_card`

WebRTC Card support blends the use of the ultra-realtime [WebRTC card live
view](https://github.com/AlexxIT/WebRTC) with convenient access to Frigate
events/snapshots/UI. AlexxIT's WebRTC Integration/Card must be installed and configured separately (see [details](https://github.com/AlexxIT/WebRTC)) before it can be used with this card.

```yaml
cameras:
  - camera_entity: camera.office
    live_provider: webrtc-card
    webrtc_card:
      # [...]
```

| Option   | Default                                                                                                                                                                                                             | Description                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity` |                                                                                                                                                                                                                     | The RTSP camera entity to pass to the WebRTC Card for this camera.                                                                                                                                                                                                                              |
| `url`    | Depends on the camera engine (e.g. Frigate cameras will automatically use the camera name since this is the [recommended setup](https://deploy-preview-4055--frigate-docs.netlify.app/guides/configuring_go2rtc/)). | The RTSP url to pass to the WebRTC Card, e.g. `rtsp://USERNAME:PASSWORD@CAMERA:554/RTSP_PATH`                                                                                                                                                                                                   |
| `*`      |                                                                                                                                                                                                                     | Any options specified in the `webrtc_card:` YAML dictionary are silently passed through to the AlexxIT's WebRTC Card. See [WebRTC Configuration](https://github.com/AlexxIT/WebRTC#configuration) for full details this external card provides, e.g. `ui: true` will enable the WebRTC Card UI. |
