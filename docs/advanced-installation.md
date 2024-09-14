# Advanced Installation

For most users, the installation instructions in the [Getting Started](README.md) section will install the card successfully. In some rarer situations, additional steps may need to be taken.

### Manual resource management

For most users, HACS should automatically add the necessary resources. Should this auto-registration not work you will need to complete one additional step.

#### Lovelace in "Storage Mode" (default)

- Navigate:

```
Three dots menu -> "Edit Dashboard" -> Three dots menu -> "Manage resources" -> "Add Resource"
```

- URL: `/hacsfiles/frigate-hass-card/frigate-hass-card.js`
- Resource type: `JavaScript Module`

#### Lovelace in "YAML mode" (rare)

You would see`mode: yaml` under `lovelace:` in your `configuration.yaml` if this applies to you.

- Add the following to `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /hacsfiles/frigate-hass-card/frigate-hass-card.js
      type: module
```

- Restart Home Assistant.

### Manual installation

- Download the `frigate-hass-card.zip` attachment of the desired [release](https://github.com/dermotduffy/frigate-hass-card/releases) to a location accessible by Home Assistant. Note that the release will have a series of `.js` files (for HACS users) **and** a `frigate-hass-card.zip` for the convenience of manual installers.
- Unzip the file and move the contents of the `dist/` folder to any subfolder name you'd like, e.g. `frigate-card` is used in the below example.
- Add the location as a Lovelace resource via the UI, or via [YAML configuration](https://www.home-assistant.io/lovelace/dashboards/#resources) such as:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/frigate-card/frigate-hass-card.js
      type: module
```

### Unreleased versions

You can install any unreleased version of the card by leveraging the GitHub Actions artifacts that are generated on every revision. See a [video walkthrough](https://user-images.githubusercontent.com/29582865/228320074-6a2607f5-c637-48d5-b833-a553f8df8f4f.mp4) installing the latest revision of the `release-4.1.0` branch.
