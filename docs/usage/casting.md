# Casting the Card

This card can be (Chrome) casted to a device (such as a [Nest
Hub](https://store.google.com/us/product/nest_hub_2nd_gen)) through the use of
[Home Assistant Cast](https://cast.home-assistant.io/).

## Instructions

- Visit [Home Assistant Cast](https://cast.home-assistant.io/) and click `Start Casting`
- Enter your Home Assistant URL, and authorize your account.
- Click `Start Casting` and choose the device to cast to from the browser menu.
- Choose which view/dashboard to display.
- If successful, the view will be cast to the device.

## Limitations

Casting Home Assistant dashboards comes with a number of caveats:

- Home Assistant Casting does not support the HA `streaming` component
  ([source](https://cast.home-assistant.io/faq.html)). This means clips playing
  and the `ha` live provider can not work. Other live providers such as `jsmpeg`
  and `webrtc-card` function correctly.
- The Javascript fullscreen API does not work (so the fullscreen button does not
  work, but see below for an equivalent).

## The `casting` profile

The optional [casting profile](../configuration/profiles.md?id=casting) provides
some defaults to improve your casting experience. Use it like:

```yaml
profiles:
  - casting
```

## Recommended configuration for Nest Hub

Using a `panel` dashboard with the following base configuration will result in
the card consuming the entire device screen:

### Configuration

```yaml
type: custom:frigate-card
cameras:
  - camera_entity: camera.office
    live_provider: go2rtc
dimensions:
  aspect_ratio: 1024:600
  aspect_ratio_mode: static
profile:
  - casting
```

### Result

![](../images/card-on-nest-hub.jpg 'Casting on a Nest Hub :size=400')
