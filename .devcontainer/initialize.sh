#!/bin/bash

set -euxo pipefail

git submodule update --init

.devcontainer/frigate-hass-integration/.devcontainer/set_dot_env.sh
