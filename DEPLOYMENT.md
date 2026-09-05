# Butterfly — real online deployment

Butterfly uses a static frontend plus a Node.js backend. GitHub Pages hosts the frontend; the backend must run on a server/host that supports Node.js and WebSockets.

## 1. Deploy the backend

A simple option is Render. Create a Web Service from the repository and use:

- Build: `npm ci`
- Start: `node server/server.js`
- Health check: `/health`

Set these environment variables on the backend host:

`BUTTERFLY_PUBLIC_URL` = the backend HTTPS URL
`BUTTERFLY_FRONTEND_URL` = your GitHub Pages HTTPS URL
`BUTTERFLY_SMTP_HOST` = `smtp.gmail.com`
`BUTTERFLY_SMTP_PORT` = `587`
`BUTTERFLY_SMTP_SECURE` = `false`
`BUTTERFLY_SMTP_USER` = your Gmail address
`BUTTERFLY_SMTP_PASS` = your Gmail App Password
`BUTTERFLY_EMAIL_FROM` = your Gmail address

Never put SMTP credentials in `config.js`, GitHub Pages, or browser JavaScript.

## 2. Point the GitHub Pages frontend at the backend

Edit `config.js`:

```js
window.BUTTERFLY_CONFIG = {
    BACKEND_URL: "https://YOUR-BACKEND.example.com"
};
```

Commit and push the frontend. Because GitHub Pages uses HTTPS, Butterfly will automatically use `wss://` for WebSockets.

## 3. Database persistence

Butterfly currently uses SQLite. A production deployment needs persistent storage for `data/butterfly.db`. If the hosting provider gives the service only ephemeral storage, database contents can be lost after a redeploy/restart. Attach persistent storage or migrate the database layer to a managed PostgreSQL database before treating the service as production.

## 4. Test

Open the GitHub Pages site, register a new account, and check the Gmail inbox. The verification link points to the backend and then returns the user to the frontend.

The backend also exposes `/health` for a simple uptime check.
