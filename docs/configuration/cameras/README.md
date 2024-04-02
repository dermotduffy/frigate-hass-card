# Cameras

The `cameras` block configures a list of cameras the card should support. The first listed camera is the default.

```yaml
cameras:
  - [...camera 0 (default camera)...]
  - [...camera 1...]
  - [...camera 2...]
```

The `cameras_global` block can be used to set defaults across multiple cameras.

```yaml
cameras_global:
   [...]
```

| Option | Default | Description |
| - | - | - |
| `camera_entity` | | The Home Assistant camera entity to use with the `frigate` live provider view. Also used to automatically detect the name of the underlying Frigate camera, and the title/icon of the camera. |
| `capabilities` | | Allows selective disabling of camera capabilities. See below. |
| `cast` | | Configuration that controls how this camera is "casted" / sent to media players. See below. |
| `dependencies` | | Other cameras that this camera should depend upon. See below. |
| `dimensions` | | Controls the dimensions and layout for media from this camera. See below. |
| `engine` | `auto` | The camera engine to use. If `auto` the card will attempt to choose the correct engine from the specified options. See [Engine](engine.md). |
| `frigate` | | Options for Frigate cameras. See [Frigate camera engine configuration](engine.md?id=frigate). |
| `icon` | Autodetected from `camera_entity` if that is specified. | The icon to use for this camera in the camera menu and in the next & previous controls when using the `icon` style. |
| `id` | `camera_entity`, `webrtc_card.entity` or `frigate.camera_name` if set (in that preference order). | An optional identifier to use throughout the card configuration to refer unambiguously to this camera. This `id` may be used in [conditions](../conditions.md), dependencies or custom [actions](../actions.md) to refer to a given camera unambiguously. |
| `live_provider` | `auto` | The choice of live stream provider. See [Live Provider](live-provider.md).|
| `title` | Autodetected from `camera_entity` if that is specified. | A friendly name for this camera to use in the card. |
| `triggers` | | Define what should cause this camera to update/trigger. See below. |
| `webrtc_card` | | The WebRTC entity/URL to use for this camera with the `webrtc-card` live provider. See below. |

## `capabilities`

The `capabilities` block allows selected disabling of auto-detected camera capabilities. This is rarely used, with substreams being a notable exception.

```yaml
cameras:
 - camera_entity: camera.office
   capabilities:
      [...]
```

| Option | Default | Description |
| - | - | - |
| `disable` | | A list of camera capabilities to disable. By default all capabilities supported by the camera are enabled. |
| `disable_except` | | A list of camera capabilities to leave enabled if supported. Everything else will be disabled. |

### Capabilities

| Capability | Purpose |
| - | - |
| `clips` | Clips can be fetched from the camera. |
| `favorite-events` | Events can be favorited. |
| `favorite-recordings` | Recordings can be favorited. |
| `live` | Live video can be received from the camera. |
| `menu` | The camera should show up in the card camera menu. |
| `ptz` | The camera can be PTZ controlled. |
| `recordings` | Recordings can be fetched from the camera. |
| `seek` | Clips can be seeked / scrubbed by the timeline. |
| `snapshots` | Snapshots can be fetched from the camera. |
| `substream` | The camera can be used as a substream on another camera. |

## `cast`

The `cast` block configures how a camera is cast / sent to media players.

```yaml
cameras:
 - camera_entity: camera.office
   cast:
     [...]
```

| Option | Default | Description |
| - | - | - |
| `dashboard` | | Configuration for the dashboard to cast. See below. |
| `method` | `standard` | Whether to use `standard` media casting to send the live view to your media player, or to instead cast a `dashboard` you have manually setup. Casting a dashboard supports a much wider variety of video media, including low latency video providers (e.g. `go2rtc`). This setting has no effect on casting non-live media. |

See the [dashboard method cast example](../../examples.md?id=cast-a-dashboard).

### Dashboard Configuration

```yaml
cameras:
 - camera_entity: camera.office
   cast:
      dashboard:
         [...]
```

| Option | Default | Description |
| - | - | - |
| `dashboard_path` | | A required field that specifies the name of the dashboard to cast. You can see this name in your HA URL when you visit the dashboard. |
| `view_path` | | A required field that specifies view/"tab" on that dashboard to cast. This is the value you have specified in the `url` field of the view configuration on the dashboard. |

## `dependencies`

The `dependencies` block configures other cameras as dependents of this camera. Dependent cameras have their media fetched and merged with this camera by default, and offer their respective live views as 'substreams' of the main (depended upon) camera. Configuration is under:

```yaml
cameras:
 - camera_entity: camera.office
   dependencies:
     [...]
```

| Option | Default | Description |
| - | - | - |
| `all_cameras` | `false` | Shortcut to specify all other cameras as dependent cameras. |
| `cameras` | | An optional list of other camera identifiers (see `id` parameter). If specified the card will fetch media for this camera and *also* recursively for the named cameras by default. Live views for the involved cameras will be available as 'substreams' of the main (depended upon) camera. All dependent cameras must themselves be a configured camera in the card. This can be useful to group events for cameras that are close together, to show multiple related live  views, to always have clips/snapshots show fully merged events across all cameras or to show events for the `birdseye` camera that otherwise would not have events itself. |

## `dimensions`

The `dimensions` block configures the dimensions and layout of media of a given camera. 

```yaml
cameras:
 - camera_entity: camera.office
   dimensions:
      [...]
```

| Option | Default | Description |
| - | - | - |
| `aspect_ratio` | | An optional aspect ratio for media from this camera which will be used in `live` or media viewer related views (e.g. `clip`, `snapshot` and `recording`). Format is the same as the parameter of the same name under the [dimensions block](../dimensions.md) (which controls dimensions for the whole card), e.g. `16 / 9`. |
| `layout` | | How the media should be laid out *within* the camera dimensions. See below. |

### Layout Configuration

The `layout` block configures the fit and position of the media _within_ the camera dimensions (in order to control the dimensions for the whole card see [the card dimensions configuration](../dimensions.md) ). As the default behavior is to always expand to fit the media precisely, these options only make sense if the camera `dimensions.aspect_ratio` is set to a static value that forces a particular aspect ratio that does not match the camera media.


```yaml
cameras:
 - camera_entity: camera.office
   dimensions:
      layout:
         [...]
```

| Option | Default | Description |
| - | - | - |
| `fit` | `contain` | If `contain`, the media is contained within the card and letterboxed if necessary. If `cover`, the media is expanded proportionally (i.e. maintaining the media aspect ratio) until the card is fully covered. If `fill`, the media is stretched to fill the card (i.e. ignoring the media aspect ratio). See [CSS object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) for technical details and a visualization. |
| `position` | | A dictionary that contains an `x` and `y` percentage (`0` - `100`) to control the position of the media when the fit is `cover`. This can be effectively used to "pan" the media around. At any given time, only one of `x` and `y` will have an effect, depending on whether media width is larger than the card width (in which case `x` controls the position) or the media height is larger than the card height (in which case `y` controls the position). A value of `0` means maximally to the left or top of the media, a value of `100` means maximally to the right or bottom of the media. See [CSS object-position](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) for technical details and a visualization. |

See [media layout examples](../../examples.md?id=media-layout).

## `triggers`

The `triggers` block configures what triggers a camera. Triggering can be used
to activate an action (e.g. view a camera in live, reset the card to the default
view). See [`view.triggers`](../view.md?id=triggers) to control what happens when a
camera is triggered.

```yaml
cameras:
 - camera_entity: camera.office
   triggers:
     [...]
```

| Option | Default | Description |
| - | - | - |
| `entities` | | Whether to not to trigger the camera when the state of any Home Assistant entity becomes active (i.e. state becomes `on` or `open`). This works for Frigate or non-Frigate cameras.|
| `events` | `[events, clips, snapshots]` | Whether to trigger the camera when `events` occur (whether or not media is available) or whenever updated `clips` or `snapshots` are detected. Detection support varies by camera [engine](engine.md). |
| `motion` | `false` | Whether to not to trigger the camera by automatically detecting and using the motion `binary_sensor` for this camera. This autodetection only works for Frigate cameras, and only when the motion `binary_sensor` entity has been enabled in Home Assistant.|
| `occupancy` | `false` | Whether to not to trigger the camera by automatically detecting and using the occupancy `binary_sensor` for this camera and its configured zones and labels. This autodetection only works for Frigate cameras, and only when the occupancy `binary_sensor` entity has been enabled in Home Assistant. If this camera has configured zones, only occupancy sensors for those zones are used -- if the overall _camera_ occupancy sensor is also required, it can be manually added to `entities`. If this camera has configured labels, only occupancy sensors for those labels are used. |

## Fully expanded reference

[](../common/expanded-warning.md ':include')

```yaml
cameras:
  - camera_entity: camera.front_Door
    live_provider: ha
    engine: auto
    frigate:
      url: http://my.frigate.local
      client_id: frigate
      camera_name: front_door
      labels:
       - person
      zones:
       - steps
    # Show events for camera-2 when this camera is viewed.
    dependencies:
      all_cameras: false
      cameras:
        - camera-2
    triggers:
      motion: false
      occupancy: true
      entities:
        - binary_sensor.front_door_sensor
    cast:
      method: standard
    dimensions:
      aspect_ratio: 16:9
      layout:
        fit: contain
        position:
          x: 50
          y: 50
  - camera_entity: camera.entrance
    live_provider: webrtc-card
    engine: auto
    frigate:
      url: http://my-other.frigate.local
      client_id: frigate-other
      camera_name: entrance
      labels:
       - car
      zones:
       - driveway
    icon: 'mdi:car'
    title: 'Front entrance'
    # Custom identifier for the camera to refer to it above.
    id: 'camera-2'
    webrtc_card:
      entity: camera.entrance_rtsp
      url: 'rtsp://username:password@camera:554/av_stream/ch0'
    triggers:
      motion: false
      occupancy: true
      entities:
        - binary_sensor.entrance_sensor
    dependencies:
      all_cameras: false
  - camera_entity: camera.sitting_room
    live_provider: go2rtc
    go2rtc:
      modes:
        - webrtc
        - mse
        - mp4
        - mjpeg
      stream: sitting_room
      url: 'https://my.custom.go2rtc.backend'
      cast:
        method: dashboard
        dashboard:
          dashboard_path: cast
          view_path: front-door
  - camera_entity: camera.sitting_room_webrtc_card
    live_provider: webrtc_card
    webrtc_card:
      # Arbitrary WebRTC Card options, see https://github.com/AlexxIT/WebRTC#configuration .
      entity: camera.sitting_room_rtsp
      ui: true
  - camera_entity: camera.kitchen
    live_provider: jsmpeg
    jsmpeg:
      options:
        audio: false
        video: true
        pauseWhenHidden: false
        disableGl: false
        disableWebAssembly: false
        preserveDrawingBuffer: false
        progressive: true
        throttled: true
        chunkSize: 1048576
        maxAudioLag: 10
        videoBufferSize: 524288
        audioBufferSize: 131072
  - camera_entity: camera.back_yard
    live_provider: image
    image:
      refresh_seconds: 1
  - camera_entity: camera.office_motioneye
    motioneye:
      images:
        directory_pattern: '%Y-%m-%d'
        file_pattern: '%H-%M-%S'
      movies:
        directory_pattern: '%Y-%m-%d'
        file_pattern: '%H-%M-%S'
cameras_global:
  live_provider: ha
```
