import { z } from 'zod';

const keyboardShortcut = z.object({
  key: z.string(),
  ctrl: z.boolean().optional(),
  shift: z.boolean().optional(),
  alt: z.boolean().optional(),
  meta: z.boolean().optional(),
});
export type KeyboardShortcut = z.infer<typeof keyboardShortcut>;

export const keyboardShortcutsDefault = {
  enabled: true,
  ptz_left: { key: 'ArrowLeft' },
  ptz_right: { key: 'ArrowRight' },
  ptz_up: { key: 'ArrowUp' },
  ptz_down: { key: 'ArrowDown' },
  ptz_zoom_in: { key: '+' },
  ptz_zoom_out: { key: '-' },
  ptz_home: { key: 'h' },
};

export const keyboardShortcutsSchema = z.object({
  enabled: z.boolean().default(keyboardShortcutsDefault.enabled),
  ptz_left: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_left),
  ptz_right: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_right),
  ptz_up: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_up),
  ptz_down: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_down),
  ptz_zoom_in: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_zoom_in),
  ptz_zoom_out: keyboardShortcut
    .nullable()
    .default(keyboardShortcutsDefault.ptz_zoom_out),
  ptz_home: keyboardShortcut.nullable().default(keyboardShortcutsDefault.ptz_home),
});
export type KeyboardShortcuts = z.infer<typeof keyboardShortcutsSchema>;

const KEYBOARD_SHORTCUT_PTZ_NAMES = [
  'ptz_down',
  'ptz_home',
  'ptz_left',
  'ptz_right',
  'ptz_up',
  'ptz_zoom_in',
  'ptz_zoom_out',
] as const;
export type PTZKeyboardShortcutName = (typeof KEYBOARD_SHORTCUT_PTZ_NAMES)[number];
