# 🦋 Butterfly

**Butterfly** is a web-based real-time chat platform.

## 📁 Main Files

Butterfly uses three main frontend files:

```text
butterfly.github.io/
├── index.html
├── style.css
└── app.js
```

### `index.html`

The main webpage for Butterfly.

It loads the user interface and connects the other frontend files:

```html
<link rel="stylesheet" href="style.css">
<script src="app.js"></script>
```

### `style.css`

Contains the visual design of Butterfly, including:

* Layout
* Colors
* Buttons
* Chat interface
* Login/register screens
* Profiles
* Settings
* Responsive design

It is loaded by `index.html` using:

```html
<link rel="stylesheet" href="style.css">
```

### `app.js`

Contains the main JavaScript functionality for Butterfly.

It is loaded by `index.html` using:

```html
<script src="app.js"></script>
```

It handles things such as:

* Chat functionality
* User interface interactions
* WebSocket communication
* Login/session handling
* Sending and receiving messages

## ▶️ Running Butterfly

You can run Butterfly using a local web server or host it using **GitHub Pages**.

### GitHub Pages

Butterfly is available at:

**https://joaopgamer233.github.io/butterfly.github.io/**

GitHub Pages serves `index.html`, which then loads:

```text
index.html
   │
   ├── style.css
   │
   └── app.js
```

Make sure all three files are located in the same directory.

## 🛠️ Development

When modifying Butterfly:

1. Edit `index.html` for the webpage structure.
2. Edit `style.css` for the appearance.
3. Edit `app.js` for the functionality.
4. Refresh the webpage to see your changes.

## 🦋 Project

**Butterfly**
© 2026 Studio Gimmicks

A real-time web chat platform.
