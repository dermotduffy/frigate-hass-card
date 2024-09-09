# Patches

## `sass`

`sass` is patched to avoid printing out a noisy deprecation notice on every
build. `sass` is imported by `rollup-plugin-styler`, in a way that triggers this
message. The patch simply prevents this console spam.
