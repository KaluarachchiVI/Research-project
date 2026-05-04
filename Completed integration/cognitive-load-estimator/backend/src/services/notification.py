import subprocess
import logging
from datetime import datetime, timezone
from typing import Optional

from xml.sax.saxutils import escape as _xml_escape
import os
import sys
import ctypes
import traceback

logger = logging.getLogger(__name__)

# Prefer modern Windows toasts using winrt when available.
# Fall back to winotify (COM-based toast via pywin32) then win10toast,
# and finally fall back to the PowerShell NotifyIcon approach.
_HAS_WINRT = False
_HAS_WINOTIFY = False
_HAS_WIN10TOAST = False
_WIN10_TOASTER = None
try:
    from winrt.windows.ui.notifications import ToastNotificationManager, ToastNotification
    from winrt.windows.data.xml.dom import XmlDocument
    _HAS_WINRT = True
except Exception:
    _HAS_WINRT = False

try:
    # winotify provides a higher-level COM-based toast wrapper that works
    # with `pywin32` (already installed via pypiwin32/pywin32). Use this
    # when `winrt` is not available.
    from winotify import Notification as WinNotification, audio as WinAudio
    _HAS_WINOTIFY = True
except Exception:
    _HAS_WINOTIFY = False

try:
    from win10toast import ToastNotifier
    _WIN10_TOASTER = ToastNotifier()
    _HAS_WIN10TOAST = True
except Exception:
    _HAS_WIN10TOAST = False

class PushNotifier:
    def __init__(self, initial_delay_seconds: float = 240.0, initial_interval_seconds: float = 300.0) -> None:
        self.initial_delay = initial_delay_seconds
        self.interval = initial_interval_seconds
        self.last_notification_time: Optional[datetime] = None
        self.notification_count = 0

    def reset(self) -> None:
        self.last_notification_time = None
        self.notification_count = 0

    def update(self, is_study: bool, current_distraction_duration: float, now: datetime) -> None:
        # Normalize incoming 'now' to an aware UTC datetime to avoid
        # subtracting offset-naive and offset-aware datetimes.
        if now is None:
            now = datetime.now(timezone.utc)
        elif now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        if is_study or current_distraction_duration < self.initial_delay:
            self.reset()
            return
            
        # Distraction has exceeded the initial delay (e.g., 4 minutes)
        if self.last_notification_time is None:
            # First notification
            self._send_notification("Focus Reminder", f"You have been distracted for {int(current_distraction_duration/60)} minutes. Time to get back to studying!")
            self.last_notification_time = now
            self.notification_count = 1
        else:
            # Calculate dynamic interval: decreasing by 1 minute each time, minimum 1 minute
            current_interval = max(60.0, self.interval - ((self.notification_count - 1) * 60.0))

            # Normalize stored last_notification_time as aware UTC if needed
            if self.last_notification_time is None:
                last_ts = None
            elif self.last_notification_time.tzinfo is None:
                last_ts = self.last_notification_time.replace(tzinfo=timezone.utc)
            else:
                last_ts = self.last_notification_time

            if last_ts is None:
                time_since_last = float("inf")
            else:
                time_since_last = (now - last_ts).total_seconds()

            if time_since_last >= current_interval:
                self._send_notification("Focus Reminder", f"You are still distracted. It has been {int(current_distraction_duration/60)} minutes.")
                self.last_notification_time = now
                self.notification_count += 1

    def _send_notification(self, title: str, message: str) -> None:
        # Top-level handler: try winrt -> win10toast -> PowerShell NotifyIcon
        logger.info("Sending push notification: %s - %s", title, message)

        # 1) Try winrt (modern Windows Toast API)
        if _HAS_WINRT:
            try:
                safe_title = _xml_escape(title)
                safe_message = _xml_escape(message)
                xml = (
                    "<toast>"
                    "<visual>"
                    "<binding template='ToastGeneric'>"
                    f"<text>{safe_title}</text>"
                    f"<text>{safe_message}</text>"
                    "</binding>"
                    "</visual>"
                    "</toast>"
                )
                doc = XmlDocument()
                doc.load_xml(xml)
                toast = ToastNotification(doc)
                try:
                    notifier = ToastNotificationManager.create_toast_notifier("Praboth")
                except Exception:
                    notifier = ToastNotificationManager.create_toast_notifier()
                notifier.show(toast)
                logger.info("Displayed Windows toast via winrt")
                return
            except Exception:
                logger.exception("winrt toast failed, falling back")

        # 2) Try winotify (COM-based, uses pywin32)
        if _HAS_WINOTIFY:
            try:
                try:
                    # IMPORTANT: pass icon as a string (""), not None.
                    # Some winotify versions will silently fail to display
                    # the toast when icon is None.
                    toast = WinNotification(app_id="Praboth", title=title, msg=message, icon="", duration="short")
                except TypeError:
                    # Older versions of winotify had a slightly different signature
                    toast = WinNotification("Praboth", title, message)
                try:
                    toast.set_audio(WinAudio.Default, loop=False)
                except Exception:
                    pass
                toast.show()
                logger.info("Displayed Windows toast via winotify")
                # Some Windows setups can intermittently suppress toast
                # notifications for background processes. Allow an opt-in
                # extra NotifyIcon balloon to be displayed as well.
                if os.environ.get("CLE_NOTIFYICON_ALWAYS", "").strip() in {"1", "true", "True", "yes", "YES"}:
                    _send_notifyicon_balloon(title, message)
                return
            except Exception:
                logger.exception("winotify toast failed, falling back")

        # 3) Try win10toast
        if _HAS_WIN10TOAST and _WIN10_TOASTER is not None:
            try:
                # threaded so we don't block the caller; duration in seconds
                _WIN10_TOASTER.show_toast(title, message, duration=5, threaded=True)
                logger.info("Displayed toast via win10toast")
                return
            except Exception:
                logger.exception("win10toast failed, falling back")

        # 4) Fallback: PowerShell NotifyIcon (best-effort)
        if not _send_notifyicon_balloon(title, message):
            logger.error("Failed to send push notification (all methods)")


def _send_notifyicon_balloon(title: str, message: str) -> bool:
    """Best-effort tray balloon fallback. Returns True if the command was launched."""
    try:
        # Escape single quotes for safe insertion into single-quoted PowerShell literals
        safe_message = message.replace("'", "''")
        safe_title = title.replace("'", "''")

        script = f'''
            [void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
            $balloon = New-Object System.Windows.Forms.NotifyIcon
            try {{ $path = (Get-Process -id $pid).Path }} catch {{ $path = $null }}
            try {{ if ($path) {{ $balloon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path) }} }} catch {{ }}
            $balloon.BalloonTipIcon = 'Warning'
            $balloon.BalloonTipText = '{safe_message}'
            $balloon.BalloonTipTitle = '{safe_title}'
            $balloon.Visible = $true
            $balloon.ShowBalloonTip(5000)
            # Keep the process alive briefly so the balloon has time to display
            Start-Sleep -Seconds 6
            try {{ $balloon.Dispose() }} catch {{ }}
        '''

        subprocess.Popen([
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        return True
    except Exception:
        logger.debug("NotifyIcon balloon failed: %s", traceback.format_exc())
        return False


# --- Windows AppID / Start Menu shortcut helpers ---
def _set_process_appid(app_id: str) -> None:
    try:
        if os.name != "nt":
            return
        # Attempt to set the current process AppUserModelID so toasts are
        # attributed to our app id. This helps Windows route notifications
        # consistently when combined with a Start Menu shortcut.
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
        logger.debug("Set process AppUserModelID to %s", app_id)
    except Exception:
        logger.debug("SetCurrentProcessExplicitAppUserModelID not available: %s", traceback.format_exc())


def _ensure_start_menu_shortcut(app_id: str, link_name: str = "Praboth") -> None:
    if os.name != "nt":
        return
        appdata = os.environ.get("APPDATA")
        if not appdata:
            logger.debug("APPDATA not set; cannot create Start Menu shortcut")
            return

        start_menu = os.path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs")
        os.makedirs(start_menu, exist_ok=True)
        link_path = os.path.join(start_menu, f"{link_name}.lnk")

        # Create a simple shortcut pointing to the venv Python (or system python)
        target = sys.executable or os.path.join(sys.prefix, "python.exe")
        args = ""
        cwd = os.getcwd()
        try:
            from win32com.client import Dispatch
            shell = Dispatch("WScript.Shell")
            shortcut = shell.CreateShortcut(link_path)
            # Only set basic metadata if link doesn't already exist
            if not os.path.exists(link_path):
                shortcut.TargetPath = target
                shortcut.Arguments = args
                shortcut.WorkingDirectory = cwd
                try:
                    shortcut.IconLocation = target
                except Exception:
                    pass
                shortcut.save()
                logger.info("Created Start Menu shortcut: %s", link_path)
        except Exception:
            logger.debug("Failed to create .lnk via WScript.Shell: %s", traceback.format_exc())

        # Try to set the AppUserModelID on the shortcut using propsys if available
        try:
            # Try common import locations for the propsys helpers
            propsys = None
            pscon = None
            try:
                from win32com.propsys import propsys as _propsys
                from win32com.propsys import pscon as _pscon
                propsys = _propsys
                pscon = _pscon
            except Exception:
                try:
                    from win32comext.propsys import propsys as _propsys
                    from win32comext.propsys import pscon as _pscon
                    propsys = _propsys
                    pscon = _pscon
                except Exception:
                    propsys = None

            if propsys is not None:
                try:
                    pstore = propsys.SHGetPropertyStoreFromParsingName(link_path, None, 0, propsys.IID_IPropertyStore)
                    pv = propsys.PROPVARIANTType(app_id)
                    pstore.SetValue(pscon.PKEY_AppUserModel_ID, pv)
                    pstore.Commit()
                    logger.info("Set AppUserModelID on shortcut: %s -> %s", link_path, app_id)
                except Exception:
                    logger.debug("Failed to set AppUserModelID on shortcut: %s", traceback.format_exc())
        except Exception:
            logger.debug("propsys not available to set AppUserModelID: %s", traceback.format_exc())


# Ensure AppUserModelID is set for this process and a Start Menu shortcut exists.
try:
    _APP_ID = "Praboth"
    _set_process_appid(_APP_ID)
    _ensure_start_menu_shortcut(_APP_ID, link_name="Praboth")
except Exception:
    logger.debug("Failed to ensure Start Menu shortcut/AppID: %s", traceback.format_exc())
