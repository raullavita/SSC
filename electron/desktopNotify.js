const { Notification } = require('electron');

function showDesktopNotification({ title = 'SSC', body = 'New message' } = {}) {
  if (!Notification.isSupported()) return false;
  try {
    const note = new Notification({
      title: String(title).slice(0, 120),
      body: String(body).slice(0, 240),
      silent: false,
    });
    note.show();
    return true;
  } catch {
    return false;
  }
}

module.exports = { showDesktopNotification };