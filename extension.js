import Clutter from 'gi://Clutter';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { initLogging, createLogger } from './logger.js';

const journal = createLogger(import.meta.url);

// ---------------------------------------------------------------------------
// Tips and reminders.
//
// Testing from a looking-glass / debug console:
//
//     Main.notify('My Extension', 'This is a notification from my GNOME extension!');
//     global.notify_error("msg", "details");
//
// Most of the visual work is done by stylesheet.css. The handler below only
// removes the timestamp label; everything else (colors, spacing, borders)
// lives in the stylesheet.
//
// To customize further from JS instead of CSS, you can reach into the actor
// tree the same way onNotificationChildAdded does and call set_style() on the
// relevant actor. See the commented example at the bottom of
// onNotificationChildAdded.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module state.
//
// Everything the extension tracks at runtime lives here, not on the Extension
// instance. The logic below is plain functions reading and writing this
// object, so there is exactly one place to look for "what state does this
// extension keep".
// ---------------------------------------------------------------------------
const state = {
  themeSignalId: 0,
};

function resetState() {
  state.themeSignalId = 0;
}

// ---------------------------------------------------------------------------
// Notification banner restyling.
//
// The whole reason for the child-added signal is that the notification
// banner's internal actor tree is only fully built once the banner has been
// added to the message tray container. At that point we reach in and drop
// the timestamp label; stylesheet.css does the rest.
//
// The index-based traversal below is fragile — it mirrors the actor tree of
// GNOME Shell's NotificationBanner as of the shell version this extension
// targets. If the shell reorders any of these children, the handler will
// silently no-op (all the ?. chains short-circuit) rather than throw. If
// that happens, this is the block to update.
//
// To find the right indices on a new shell version, use Looking Glass
// (Alt+F2, "lg") to inspect Main.messageTray.get_first_child() and walk
// the children until you find the label you want to reach.
// ---------------------------------------------------------------------------

function onNotificationChildAdded(messageTrayContainer) {
  Main.messageTray.bannerAlignment = Clutter.ActorAlign.CENTER;

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
  const messageTrayContainer = Main.messageTray.get_first_child();
  if (!messageTrayContainer) return;

  state.themeSignalId = messageTrayContainer.connect('child-added', () => {
    onNotificationChildAdded(messageTrayContainer);
  });
}

function detachFromMessageTray() {
  if (!state.themeSignalId) return;

  const messageTrayContainer = Main.messageTray.get_first_child();
  try {
    messageTrayContainer?.disconnect(state.themeSignalId);
  } catch (e) {
    // Container may already be gone if the shell is shutting down.
  }
  state.themeSignalId = 0;
}

// ---------------------------------------------------------------------------
// Extension entry point.
//
// This class exists only because GNOME Shell requires an Extension subclass
// and because enable/disable hooks and this.uuid come from it. All the real
// work is done by the module-level functions above.
// ---------------------------------------------------------------------------

export default class NotificationThemeExtension extends Extension {
  enable() {
    initLogging(this.uuid, 'both', false);
    journal(`Enabled`);

    resetState();
    attachToMessageTray();
  }

  disable() {
    detachFromMessageTray();
  }
}