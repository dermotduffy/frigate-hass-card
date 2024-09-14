# `engine`

## Overview

A "Camera Engine" defines what "type" of camera is being configured (e.g. `frigate`), each engine offers different capabilities:

| Engine      | Live               | Supports clips           | Supports Snapshots       | Supports Recordings      | Supports Timeline        | Supports PTZ out of the box | Supports manually configured PTZ | Favorite events          | Favorite recordings      | Detect new events        | Detect new snapshots     | Detect new clips         |
| ----------- | ------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | --------------------------- | -------------------------------- | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| `frigate`   | :white_check_mark: | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       | :white_check_mark:          | :white_check_mark:               | :white_check_mark:       | :heavy_multiplication_x: | :white_check_mark:       | :white_check_mark:       | :white_check_mark:       |
| `generic`   | :white_check_mark: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x:    | :white_check_mark:               | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: |
| `motioneye` | :white_check_mark: | :white_check_mark:       | :white_check_mark:       | :heavy_multiplication_x: | :white_check_mark:       | :heavy_multiplication_x:    | :white_check_mark:               | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: | :heavy_multiplication_x: |

#### Live providers supported per Engine

| Engine / Live Provider | `ha`               | `image`            | `jsmpeg`                 | `go2rtc`           | `webrtc-card`            |
| ---------------------- | ------------------ | ------------------ | ------------------------ | ------------------ | ------------------------ |
| `frigate`              | :white_check_mark: | :white_check_mark: | :white_check_mark:       | :white_check_mark: | :white_check_mark:       |
| `generic`              | :white_check_mark: | :white_check_mark: | :heavy_multiplication_x: | :white_check_mark: | :white_check_mark:       |
| `motioneye`            | :white_check_mark: | :white_check_mark: | :heavy_multiplication_x: | :white_check_mark: | :heavy_multiplication_x: |

See [Live Provider Configuration](live-provider.md) for more details on live providers.

## `frigate`

The `frigate` block configures options for a Frigate camera.

```yaml
cameras:
  - camera_entity: camera.office
    frigate:
      # [...]
```

| Option        | Default                                                 | Description                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camera_name` | Autodetected from `camera_entity` if that is specified. | The Frigate camera name to use when communicating with the Frigate server, e.g. for viewing clips/snapshots or the JSMPEG live view.                                                                                                                                                                                                                              |
| `client_id`   | `frigate`                                               | The Frigate client id to use. If this Home Assistant server has multiple Frigate server backends configured, this selects which server should be used. It should be set to the MQTT client id configured for this server, see [Frigate Integration Multiple Instance Support](https://docs.frigate.video/integrations/home-assistant/#multiple-instance-support). |
| `labels`      |                                                         | A list of Frigate labels used to filter events (clips & snapshots), e.g. [`person`, `car`].                                                                                                                                                                                                                                                                       |
| `url`         |                                                         | The URL of the frigate server. If set, this value will be (exclusively) used for a `Camera UI` menu button. All other communication with Frigate goes via Home Assistant.                                                                                                                                                                                         |
| `zones`       |                                                         | A list of Frigates zones used to filter events (clips & snapshots), e.g. [`front_door`, `front_steps`].                                                                                                                                                                                                                                                           |

## `motioneye`

The `motioneye` block configures options for a MotionEye camera.

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      # [...]
```

| Option   | Default | Description                                                                                                   |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `images` |         | Configure how MotionEye images are consumed. See below.                                                       |
| `movies` |         | Configure how MotionEye movies are consumed. See below.                                                       |
| `url`    |         | The URL of the MotionEye server. If set, this value will be (exclusively) used for a `Camera UI` menu button. |

### `images` / `movies`

The `images` and `movies` block configures how images and movies respectively are fetched from motionEye. The options for both blocks are the same.

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      images:
        # [...]
```

```yaml
cameras:
  - camera_entity: camera.office
    motioneye:
      movies:
        # [...]
```

| Option              | Default    | Description                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory_pattern` | `%Y-%m-%d` | The directory that motionEye is configured to store media into. May contain multiple sub-directories separated by `/`. Path must encode the date of the media using MotionEye patterns such as `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` (at least one pattern is required). Consult MotionEye help text for information on these substitutions. |
| `file_pattern`      | `%H-%M-%S` | Within a directory (as matched by `directory_pattern`) the media items must exist and match this pattern. `file_pattern` must encode the time of the media using MotionEye patterns such as `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` (at least one pattern is required). Consult MotionEye help text for information on these substitutions.    |
