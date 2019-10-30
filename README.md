# Boilerplate Card by [@iantrich](https://www.github.com/iantrich)

A community driven boilerplate of best practices for Home Assistant Lovelace custom cards

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)
[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg?style=for-the-badge)](https://github.com/custom-components/hacs)

![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

## Options

| Name | Type | Requirement | Description | Default
| ---- | ---- | ------- | ----------- | -------
| type | string | **Required** | `custom:boilerplate-card`
| name | string | **Optional** | Card name | `Boilerplate`
| show_error | boolean | **Optional** | Show what an error looks like for the card | `false`
| show_warning | boolean | **Optional** | Show what a warning looks like for the card | `false`
| entity | string | **Optional** | Home Assistant entity ID. | `none`
| tap_action | object | **Optional** | Action to take on tap | `action: more-info`
| hold_action | object | **Optional** | Action to take on hold | `none`

## Action Options

| Name | Type | Requirement | Description | Default
| ---- | ---- | ------- | ----------- | -------
| action | string | **Required** | Action to perform (more-info, toggle, call-service, navigate url, none) | `more-info`
| navigation_path | string | **Optional** | Path to navigate to (e.g. /lovelace/0/) when action defined as navigate | `none`
| url | string | **Optional** | URL to open on click when action is url. The URL will open in a new tab | `none`
| service | string | **Optional** | Service to call (e.g. media_player.media_play_pause) when action defined as call-service | `none`
| service_data | object | **Optional** | Service data to include (e.g. entity_id: media_player.bedroom) when action defined as call-service | `none`
| haptic | string | **Optional** | Haptic feedback for the [Beta IOS App](http://home-assistant.io/ios/beta) _success, warning, failure, light, medium, heavy, selection_ | `none`

## Starting a new card from boilerplate-card

### Step 1

Clone this repo

### Step 2

Install necessary modules
`yarn install` or `npm install`

### Step 3

Do a test lint & build on the project. You can see available scripts in the package.json
`npm run build`

### Step 4

Search the repo for all instances of "TODO" and handle the changes/suggestions

### Step 5

Customize to suit your needs and contribute it back to the community

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/boilerplate-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/boilerplate-card/commits/master
[discord]: https://discord.gg/5e9yvq
[discord-shield]: https://img.shields.io/discord/330944238910963714.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/c/projects/frontend
[license-shield]: https://img.shields.io/github/license/custom-cards/boilerplate-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/maintenance/yes/2019.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/boilerplate-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/boilerplate-card/releases
