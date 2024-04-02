# Grid Layout Algorithm

When display mode (in `live` or `media_viewer` views) is set to `grid`, it will lay out cameras roughly in the order they are specified in the config (items may be moved to optimize grid 'density').

The following algorithm is used to calculate the number of columns. This attempts to offers a balance between configurability, reasonable display in a typical Lovelace card width and reasonable display in a typical fullscreen display.

- Use `grid_columns` if specified.
- Otherwise, use the largest number of columns in the range `[2 - grid_max_columns]` that will fit at least a `600px` column width.
- Otherwise, use the largest number of columns in the range `[2 - grid_max_columns]` that will fit at least a `190px` column width.
- Otherwise, there will be `1` column only.
