import Clutter from 'gi://Clutter';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { initLogging, createLogger } from './logger.js';

const journal = createLogger(import.meta.url);

// ---------------------------------------------------------------------------
// Tips and reminders.
//
// Testing from Looking Glass (Alt+F2, "lg"):
//
//     Main.notify('My Extension', 'This is a notification from my GNOME extension!');
//     global.notify_error("msg", "details");
//
// Most of the visual work is done by stylesheet.css. This file only:
//   1. forces banners to stay centered, and
//   2. removes the timestamp label from each banner.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module state.
// ---------------------------------------------------------------------------
const state = {
  bin: null,              // Main.messageTray's banner container (_bannerBin)
  childAddedId: 0,
  alignId: 0,
  originalAlignment: null,
};

function resetState() {
  state.bin = null;
  state.childAddedId = 0;
  state.alignId = 0;
  state.originalAlignment = null;
}

// ---------------------------------------------------------------------------
// Banner alignment.
//
// MessageTray.bannerAlignment is only a JS getter/setter wrapping
// _bannerBin.set_x_align(), so it emits no signal. We watch the real
// GObject property 'x-align' on _bannerBin instead.
//
// If something else (another extension, a theme tweak) pushes the banners to
// the left, we log a stack trace showing who did it, then re-center.
// ---------------------------------------------------------------------------

function enforceCenterAlignment() {
  const bin = Main.messageTray?._bannerBin;
  if (!bin) {
    journal('messageTray._bannerBin not found; cannot enforce alignment');
    return;
  }

  state.bin = bin;
  state.originalAlignment = bin.x_align;
  bin.x_align = Clutter.ActorAlign.CENTER;

  state.alignId = bin.connect('notify::x-align', () => {
    if (bin.x_align === Clutter.ActorAlign.CENTER) return;

    journal(`x-align changed to ${bin.x_align}\n${new Error().stack}`);
    bin.x_align = Clutter.ActorAlign.CENTER;
  });
}

function releaseAlignment() {
  const bin = state.bin;
  if (!bin) return;

  try {
    if (state.alignId) bin.disconnect(state.alignId);
    if (state.originalAlignment !== null) bin.x_align = state.originalAlignment;
  } catch (e) {
    // Container may already be gone if the shell is shutting down.
  }
  state.alignId = 0;
}

// ---------------------------------------------------------------------------
// Notification banner restyling.
//
// The child-added signal fires when a banner is added to the tray container,
// at which point its internal actor tree is fully built. We reach in and drop
// the timestamp label; stylesheet.css does the rest.
//
// The index-based traversal is fragile: it mirrors the actor tree of GNOME
// Shell's NotificationBanner for the targeted shell version. If the shell
// reorders these children, the ?. chains short-circuit and the handler
// silently no-ops. If that happens, this is the block to update. Use
// Looking Glass to inspect Main.messageTray.get_first_child() and walk the
// children to find the label.
// ---------------------------------------------------------------------------

function onNotificationChildAdded(messageTrayContainer) {
  const notificationContainer = messageTrayContainer?.get_first_child();
  const notification = notificationContainer?.get_first_child();

  const header = notification?.get_child_at_index(0);
  const headerContent = header?.get_child_at_index(1);
  const headerContentTime = headerContent?.get_child_at_index(1);

  headerContentTime?.destroy();

  // ---- Further customization (not currently used) ----
  //
  // Once the tree traversal above is expanded to also reach the source icon,
  // title, and body, you can style any of them directly. Example, using the
  // banner's own background color as the timestamp's text color — a trick
  // that makes the label invisible without removing it:
  //
  //     const bgColor = notificationContainer.get_theme_node().get_background_color();
  //     const bgColorHex = this.coglColorToHex(bgColor);
  //     headerContentTime.set_style(`color: ${bgColorHex};`);
  //
  // Other arbitrary styles, for reference:
  //
  //     headerContentSource.set_style('color: #00ff00;');
  //     contentContentTitle.set_style('color: #ffff00;');
  //     contentContentBody.set_style('color: #0000ff;');
  //     notificationContainer.set_style('background-color: #6a0dad; border-radius: 12px;');
  //
  // Note: the commented block above referenced headerContentSource,
  // contentContentTitle, and contentContentBody, which the current handler
  // does not extract. Re-add the corresponding traversal steps if you want
  // to use them. Remember that coglColorToHex was a helper on the Extension
  // class in the original file and would need to be reintroduced as a
  // module-level function if the bgColor approach is used.
}

function attachToMessageTray() {
  const container = state.bin ?? Main.messageTray?.get_first_child();
  if (!container) return;

  state.bin = container;
  state.childAddedId = container.connect('child-added', () => {
    onNotificationChildAdded(container);
  });
}

function detachFromMessageTray() {
  const container = state.bin;
  if (!container || !state.childAddedId) return;

  try {
    container.disconnect(state.childAddedId);
  } catch (e) {
    // Container may already be gone if the shell is shutting down.
  }
  state.childAddedId = 0;
}

// ---------------------------------------------------------------------------
// Extension entry point.
// ---------------------------------------------------------------------------

export default class NotificationThemeExtension extends Extension {
  enable() {
    initLogging(this.uuid, 'file', false);
    journal(`Enabled`);

    resetState();
    enforceCenterAlignment();
    attachToMessageTray();
  }

  disable() {
    detachFromMessageTray();
    releaseAlignment();
    resetState();
  }
}