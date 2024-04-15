#!/bin/bash

WIDTH=800

URL_FIT="https://docs.google.com/drawings/d/e/2PACX-1vTq0SVS8HWs3jGC0jjNpJoYfMbZS6P27CYyPlDhSa9OhdB_3jEb0HTLLYwu8Nv3J1TdjAJppcjTiVNy/pub?w=$WIDTH"
URL_THINNER_THAN_WIDTH="https://docs.google.com/drawings/d/e/2PACX-1vRkMd89N0tkZt5IghPKhR6gs8zMhB-5_hx5QfP6BCxbsSIga_h44IczP06Sj_YnKkxhe0lRdeR-uh04/pub?w=$WIDTH"
URL_SHORTER_THAN_HEIGHT="https://docs.google.com/drawings/d/e/2PACX-1vTKVsXEWIbj9lYKrCeugdLKcK_rOwAZZDK8IzhPdHH4wMwV2v7kEI0nsn2Qgugb00qDVHsE7kE8CBIC/pub?w=$WIDTH"
URL_VIEW_BOX="https://docs.google.com/drawings/d/e/2PACX-1vRpPNsaStxW2ENmv1kfUQg41cua9XQ2sQziq2PC8LdRCtkvjHSKYH3CyPO1Pz7kOdiQ2yQKrBX88-TF/pub?w=$WIDTH"

DIR_MEDIA_LAYOUT_IMAGES="./docs/images/media_layout"

wget -q -O "$DIR_MEDIA_LAYOUT_IMAGES/fit.png" "$URL_FIT" && \
  wget -q -O "$DIR_MEDIA_LAYOUT_IMAGES/position-thinner-than-width.png" "$URL_THINNER_THAN_WIDTH" && \
  wget -q -O "$DIR_MEDIA_LAYOUT_IMAGES/position-shorter-than-height.png" "$URL_SHORTER_THAN_HEIGHT" && \
  wget -q -O "$DIR_MEDIA_LAYOUT_IMAGES/view-box.png" "$URL_VIEW_BOX"

