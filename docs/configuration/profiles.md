# `profiles`

Apply pre-configured sets of defaults to ease card configuration.

```yaml
profiles:
  - [profile_1]
  - [profile_2]
```

?> Since the profiles change the _default_ value of options, setting a profile
on a pre-existing card could have limited effect if there are options already set by
the user.

?> Profiles are applied top to bottom. If multiple profiles change a configuration default, then the last one "wins"

| Profile name | Purpose |
| - | - |
| `low-performance` | Increase card performance. |
| `scrubbing` | Allow media "scrubbing". |

## `low-performance`

For low end devices, the `low-performance` profile will adjust card defaults to attempt to increase performance.

Principles used in the selection of options set by `low-profile` profile mode:

* Get 'out of the box' performance similar to the basic "Home Assistant Picture Glance" card.
* Do not break the visual aesthetic of the card.

See the [source code](https://github.com/dermotduffy/frigate-hass-card/blob/dev/src/config/profiles/low-performance.ts) for an exhaustive list of options set by this profile.

## `scrubbing`

Configures the `live` view and media viewer to allow media "scrubbing" as the timeline is dragged back and forth.

See the [source code](https://github.com/dermotduffy/frigate-hass-card/blob/dev/src/config/profiles/scrubbing.ts) for an exhaustive list of options set by this profile.

## Fully expanded reference

[](common/expanded-warning.md ':include')

```yaml
profiles:
  - low-performance
  - scrubbing
```