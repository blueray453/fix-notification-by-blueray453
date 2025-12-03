import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { setLogging, setLogFn, journal } from './utils.js'

export default class NotificationThemeExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._themeSignalId = null;
  }

  enable() {
    // Main.notify('My Extension', 'This is a notification from my GNOME extension!');
    // global.notify_error("msg", "details");
    // Nothing to do; stylesheet.css handles everything

    setLogFn((msg, error = false) => {
      let level;
      if (error) {
        level = GLib.LogLevelFlags.LEVEL_CRITICAL;
      } else {
        level = GLib.LogLevelFlags.LEVEL_MESSAGE;
      }

      GLib.log_structured(
        'fix-notification-by-blueray453',
        level,
        {
          MESSAGE: `${msg}`,
          SYSLOG_IDENTIFIER: 'fix-notification-by-blueray453',
          CODE_FILE: GLib.filename_from_uri(import.meta.url)[0]
        }
      );
    });

    setLogging(true);

    // journalctl -f -o cat SYSLOG_IDENTIFIER=fix-notification-by-blueray453
    journal(`Enabled`);

    Main.messageTray.bannerAlignment = Clutter.ActorAlign.CENTER;

    const messageTrayContainer = Main.messageTray.get_first_child();

    this._themeSignalId = messageTrayContainer?.connect("child-added", () => {
      const notificationContainer = messageTrayContainer?.get_first_child();
      const notification = notificationContainer?.get_first_child();

      const header = notification?.get_child_at_index(0);
      const headerContent = header?.get_child_at_index(1);
      const headerContentSource = headerContent?.get_child_at_index(0);
      const headerContentTime = headerContent?.get_child_at_index(1);

      const content = notification?.get_child_at_index(1);
      const contentContent = content?.get_child_at_index(1);
      const contentContentTitle = contentContent?.get_child_at_index(0);
      const contentContentBody = contentContent?.get_child_at_index(1).get_first_child();

      headerContentTime.destroy();

      // const bgColor = notificationContainer.get_theme_node().get_background_color();
      // const bgColorHex = this.coglColorToHex(bgColor);

      // headerContentTime.set_style(`color: ${bgColorHex};`);
      // // headerContentSource.set_style('color: #00ff00;');
      // // contentContentTitle.set_style('color: #ffff00;');
      // // contentContentBody.set_style('color: #0000ff;');
      // // notificationContainer.set_style('background-color: #6a0dad; border-radius: 12px;');
    });
  }

  disable() {
    if (this._themeSignalId) {
      const messageTrayContainer = Main.messageTray.get_first_child();
      messageTrayContainer?.disconnect(this._themeSignalId);
      this._themeSignalId = null;
    }

  }
}
