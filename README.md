# 🦋 Butterfly

Butterfly is a real-time online chat platform.

## Architecture

```text
GitHub Pages
https://joaopgamer233.github.io/butterfly.github.io/
        │
        │ HTTPS / WSS
        ▼
Node.js Butterfly backend
        │
        ├── SQLite
        ├── authentication
        ├── friends
        ├── profiles
        └── chat
             │
             ▼
        Python Snake Mailer 🐍📧
             │
             ▼
        Gmail / Outlook / other SMTP
```

## Frontend

GitHub Pages loads:

```text
index.html
style.css
config.js
app.js
account.js
profile.js
friends.js
settings.js
resources/
```

`config.js` contains the public backend URL. It must never contain SMTP passwords or other secrets.

## Backend

The Node.js backend is:

```text
server/server.js
server/database.js
server/auth.js
server/email.py
```

Node.js handles the real-time application and Python handles email delivery.

## Python Snake Mailer

`server/email.py` uses only Python's standard library.

It reads one JSON request from stdin and sends the email through SMTP.

It supports Gmail, Outlook, and other SMTP providers.

### Gmail

Use a Google **App Password** instead of your normal Google account password.

Configure `.env`:

```text
BUTTERFLY_SMTP_HOST=smtp.gmail.com
BUTTERFLY_SMTP_PORT=587
BUTTERFLY_SMTP_SECURE=false
BUTTERFLY_SMTP_USER=yourgmail@gmail.com
BUTTERFLY_SMTP_PASS=your_gmail_app_password
BUTTERFLY_EMAIL_FROM=yourgmail@gmail.com
```

## Account verification

```text
Register
   ↓
Node creates account
   ↓
Python Snake Mailer sends email
   ↓
User clicks "Verify my email"
   ↓
GitHub Pages opens with ?verify=TOKEN
   ↓
app.js sends token to Node backend
   ↓
Node verifies token
   ↓
Account becomes verified
   ↓
User can log in
```

Verification tokens expire after 10 minutes.

## Password recovery

Password recovery uses a six-digit email code.

## Username changes

Changing a username requires a six-digit code sent to the account email.

## Account deletion

Deleting an account requires a six-digit code sent to the account email.

## Profile pictures

Profile pictures are resized in the browser to 256×256 JPEG before being sent to the server.

The WebSocket message is:

```js
{
    type: "update_profile",
    avatar: "..."
}
```

## Local setup

Install Node.js and Python.

Then:

```powershell
npm.cmd install
```

Copy:

```text
.env.example
```

to:

```text
.env
```

Configure the SMTP settings.

Start Butterfly:

```powershell
npm.cmd start
```

The backend will run on:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## GitHub Pages setup

Edit:

```text
config.js
```

and replace:

```js
BACKEND_URL: "http://localhost:3000"
```

with the public HTTPS URL of your deployed Butterfly backend.

For example:

```js
window.BUTTERFLY_CONFIG = {
    BACKEND_URL: "https://your-butterfly-backend.example.com"
};
```

The production WebSocket connection automatically becomes `wss://`.

## Important

Never put these in GitHub Pages:

```text
.env
SMTP passwords
Gmail App Passwords
database files
private API keys
session secrets
```

GitHub Pages is the frontend. The Node.js server is the backend.

© 2026 Studio Gimmicks
