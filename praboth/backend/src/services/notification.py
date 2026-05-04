import subprocess
import logging
from datetime import datetime, timezone
from typing import Optional

from xml.sax.saxutils import escape as _xml_escape

logger = logging.getLogger(__name__)

# Prefer modern Windows toasts using winrt when available. Fall back to
# win10toast if winrt isn't installed, and finally fall back to the
# PowerShell NotifyIcon approach used previously.
_HAS_WINRT = False
_HAS_WIN10TOAST = False
_WIN10_TOASTER = None
try:
    from winrt.windows.ui.notifications import ToastNotificationManager, ToastNotification
    from winrt.windows.data.xml.dom import XmlDocument
    _HAS_WINRT = True
except Exception:
    _HAS_WINRT = False

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

        # 2) Try win10toast
        if _HAS_WIN10TOAST and _WIN10_TOASTER is not None:
            try:
                # threaded so we don't block the caller; duration in seconds
                _WIN10_TOASTER.show_toast(title, message, duration=5, threaded=True)
                logger.info("Displayed toast via win10toast")
                return
            except Exception:
                logger.exception("win10toast failed, falling back")

        # 3) Fallback: PowerShell NotifyIcon (best-effort)
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
        except Exception as e:
            logger.error("Failed to send push notification (all methods): %s", e)
