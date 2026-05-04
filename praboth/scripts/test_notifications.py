#!/usr/bin/env python3
"""
Test notifications: attempts winrt, winotify, win10toast, PowerShell fallback,
and then calls `PushNotifier._send_notification` to exercise the full stack.
Run from the repository root with the project's venv Python.
"""
import logging
import time

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
print('Starting notifications test')


def try_winrt():
    try:
        from winrt.windows.ui.notifications import ToastNotificationManager, ToastNotification
        from winrt.windows.data.xml.dom import XmlDocument
        print("winrt available")
        xml = "<toast><visual><binding template='ToastGeneric'><text>Test winrt</text><text>Hello from winrt</text></binding></visual></toast>"
        doc = XmlDocument()
        doc.load_xml(xml)
        toast = ToastNotification(doc)
        try:
            notifier = ToastNotificationManager.create_toast_notifier("Praboth")
        except Exception:
            notifier = ToastNotificationManager.create_toast_notifier()
        notifier.show(toast)
        print("winrt toast shown")
    except Exception as e:
        print("winrt not available or failed:", repr(e))


def try_winotify():
    try:
        from winotify import Notification, audio
        print("winotify available")
        toast = Notification(app_id="Praboth", title="Test winotify", msg="Hello from winotify", duration="short")
        try:
            toast.set_audio(audio.Default, loop=False)
        except Exception:
            pass
        toast.show()
        print("winotify toast shown")
    except Exception as e:
        print("winotify not available or failed:", repr(e))


def try_win10toast():
    try:
        from win10toast import ToastNotifier
        print("win10toast available")
        t = ToastNotifier()
        t.show_toast("Test win10toast", "Hello from win10toast", duration=3, threaded=False)
        print("win10toast shown")
    except Exception as e:
        print("win10toast not available or failed:", repr(e))


def try_ps_fallback():
    import subprocess
    try:
        print("trying PowerShell fallback")
        title = "PS Test"
        message = "Hello from PowerShell fallback toast"
        safe_message = message.replace("'", "''")
        safe_title = title.replace("'", "''")
        script = f"""
            [void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
            $balloon = New-Object System.Windows.Forms.NotifyIcon
            try {{ $path = (Get-Process -id $pid).Path }} catch {{ $path = $null }}
            try {{ if ($path) {{ $balloon.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($path) }} }} catch {{ }}
            $balloon.BalloonTipIcon = 'Info'
            $balloon.BalloonTipText = '{safe_message}'
            $balloon.BalloonTipTitle = '{safe_title}'
            $balloon.Visible = $true
            $balloon.ShowBalloonTip(5000)
            Start-Sleep -Seconds 6
            try {{ $balloon.Dispose() }} catch {{ }}
        """
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
        print("PS fallback invoked")
    except Exception as e:
        print("PS fallback failed:", repr(e))


def try_pushnotifier():
    try:
        from backend.src.services.notification import PushNotifier
        p = PushNotifier()
        print("PushNotifier available")
        p._send_notification("PushNotifier Test", "Message from PushNotifier._send_notification")
        print("PushNotifier invoked")
    except Exception as e:
        print("PushNotifier failed:", repr(e))


if __name__ == "__main__":
    try_winrt()
    time.sleep(1)
    try_winotify()
    time.sleep(1)
    try_win10toast()
    time.sleep(1)
    try_ps_fallback()
    time.sleep(1)
    try_pushnotifier()
    print("Done. Wait a few seconds for notifications to appear.")
    time.sleep(8)
