#!/usr/bin/env python3
"""
Butterfly Snake Mailer 🐍📧

A tiny standard-library-only SMTP mailer. Node.js sends one JSON
request through stdin; this script sends the email and exits.
"""

import html
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage


def env(name, default=None):
    value = os.environ.get(name, default)
    if value is None or value == "":
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def send_mail(request):
    recipient = request["to"]
    subject = request["subject"]
    title = request.get("title", "Butterfly")
    text = request["text"]
    button_text = request.get("button_text")
    button_url = request.get("button_url")
    code = request.get("code")

    host = env("BUTTERFLY_SMTP_HOST")
    port = int(os.environ.get("BUTTERFLY_SMTP_PORT", "587"))
    username = env("BUTTERFLY_SMTP_USER")
    password = env("BUTTERFLY_SMTP_PASS")
    sender = os.environ.get("BUTTERFLY_EMAIL_FROM", username)
    secure = os.environ.get("BUTTERFLY_SMTP_SECURE", "false").lower() == "true"

    safe_title = html.escape(title)
    safe_text = html.escape(text).replace("\n", "<br>")
    safe_button = html.escape(button_text or "")
    safe_url = html.escape(button_url or "", quote=True)

    code_html = ""
    if code:
        code_html = (
            '<div style="font-size:30px;font-weight:700;'
            'letter-spacing:8px;margin:24px 0;">'
            f"{html.escape(str(code))}</div>"
        )

    button_html = ""
    if button_url:
        button_html = (
            f'<p style="margin:28px 0;">'
            f'<a href="{safe_url}" '
            'style="display:inline-block;padding:12px 20px;'
            'background:#6c63ff;color:#fff;text-decoration:none;'
            'border-radius:8px;font-weight:700;">'
            f"{safe_button or 'Open Butterfly'}"
            "</a></p>"
        )

    html_body = f"""<!doctype html>
<html>
<body style="margin:0;background:#f4f4f8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:14px;
padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08);">
<h1 style="margin-top:0;">🦋 {safe_title}</h1>
<p>{safe_text}</p>
{code_html}
{button_html}
<p style="color:#777;font-size:13px;">
If you did not request this email, you can safely ignore it.
</p>
</div>
</body>
</html>"""

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(text + (f"\n\nCode: {code}" if code else ""))
    message.add_alternative(html_body, subtype="html")

    if secure:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(username, password)
            smtp.send_message(message)


def main():
    raw = sys.stdin.read()
    request = json.loads(raw)
    send_mail(request)
    print(json.dumps({"ok": True}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
        sys.exit(1)
