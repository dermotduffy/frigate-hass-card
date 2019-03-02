# Boilerplate Card
A community driven boilerplate of best practices from Home Assistant Lovelace custom cards

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE.md)

![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

[![Discord][discord-shield]][discord]
[![Community Forum][forum-shield]][forum]

## Options

| Name | Type | Requirement | Description
| ---- | ---- | ------- | -----------
| type | string | **Required** | `custom:boilerplate-card`
| name | string | **Optional** | Card name
| show_error | boolean | **Optional** | Show what an error looks like for the card
| show_warning | boolean | **Optional** | Show what a warning looks like for the card

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
Customize to suit your needs and contribute it back to the custom-cards org

[Troubleshooting](https://github.com/thomasloven/hass-config/wiki/Lovelace-Plugins)

[commits-shield]: https://img.shields.io/github/commit-activity/y/custom-cards/boilerplate-card.svg?style=for-the-badge
[commits]: https://github.com/custom-cards/boilerplate-card/commits/master
[discord]: https://discord.gg/5e9yvq
[discord-shield]: https://img.shields.io/discord/478094546522079232.svg?style=for-the-badge
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/c/projects/frontend
[license-shield]: https://img.shields.io/github/license/custom-cards/boilerplate-card.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/custom-cards/boilerplate-card.svg?style=for-the-badge
[releases]: https://github.com/custom-cards/boilerplate-card/releases
