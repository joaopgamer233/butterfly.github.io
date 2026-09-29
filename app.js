"use strict";

const config = window.BUTTERFLY_CONFIG || {};
const BACKEND_URL = String(config.BACKEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const WEBSOCKET_URL = BACKEND_URL.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");

const SESSION_STORAGE_KEY = "butterfly_session";
const RECONNECT_DELAY = 2500;

let socket = null;
let reconnectTimer = null;
let shouldReconnect = true;
let verificationTokenHandled = false;

const authScreen = document.getElementById("authScreen");
const chatScreen = document.getElementById("chatScreen");
const messages = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const connectionStatus = document.getElementById("connectionStatus");

window.Butterfly = {
    getSocket() {
        return socket;
    },

    send(data) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        socket.send(JSON.stringify(data));
        return true;
    },

    getSession() {
        return localStorage.getItem(SESSION_STORAGE_KEY);
    },

    setSession(token) {
        localStorage.setItem(SESSION_STORAGE_KEY, token);
    },

    clearSession() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    },

    getBackendURL() {
        return BACKEND_URL;
    },

    showAuth() {
        authScreen.classList.remove("hidden");
        chatScreen.classList.add("hidden");
    },

    showChat() {
        authScreen.classList.add("hidden");
        chatScreen.classList.remove("hidden");
    }
};

function setStatus(text) {
    connectionStatus.textContent = text;
}

function connect() {
    if (socket &&
        (socket.readyState === WebSocket.OPEN ||
         socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    setStatus("Connecting...");

    try {
        socket = new WebSocket(WEBSOCKET_URL);
    } catch (error) {
        console.error(error);
        setStatus("Disconnected");
        scheduleReconnect();
        return;
    }

    socket.addEventListener("open", () => {
        setStatus("Connected");

        const session = window.Butterfly.getSession();
        if (session) {
            window.Butterfly.send({
                type: "session",
                token: session
            });
        }

        const params = new URLSearchParams(window.location.search);
        const token = params.get("verify");

        if (token && !verificationTokenHandled) {
            verificationTokenHandled = true;
            window.Butterfly.send({
                type: "verify_email_link",
                token
            });

            const cleanUrl = `${window.location.origin}${window.location.pathname}`;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    });

    socket.addEventListener("message", event => {
        let data;

        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        handleMessage(data);
    });

    socket.addEventListener("close", () => {
        setStatus("Disconnected");
        scheduleReconnect();
    });

    socket.addEventListener("error", error => {
        console.error("Butterfly connection error:", error);
    });
}

function scheduleReconnect() {
    if (!shouldReconnect) return;

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
}

function handleMessage(data) {
    switch (data.type) {
        case "login_success":
            window.Butterfly.showChat();

            if (data.token) {
                window.Butterfly.setSession(data.token);
            }

            window.ButterflyAccount?.setUser(data.user);
            break;

        case "login_error":
            window.ButterflyAccount?.showError(data.message);
            break;

        case "session_invalid":
            window.Butterfly.clearSession();
            window.Butterfly.showAuth();
            break;

        case "registration_created":
            window.ButterflyAccount?.showVerification(data.email, data.message);
            break;

        case "verification_email_sent":
            window.ButterflyAccount?.showVerification(data.email, data.message);
            break;

        case "email_verification_required":
            window.ButterflyAccount?.showVerification(data.email, data.message);
            break;

        case "verification_success":
            window.ButterflyAccount?.showLogin(data.message || "Email verified! You can now log in.");
            break;

        case "password_reset_requested":
            window.ButterflyAccount?.showRecoveryCode(data.message);
            break;

        case "password_reset_success":
            window.ButterflyAccount?.showLogin(data.message);
            break;

        case "history":
            messages.innerHTML = "";
            for (const message of data.messages || []) {
                addMessage(message);
            }
            scrollMessages();
            break;

        case "message":
            addMessage(data.message);
            scrollMessages();
            break;

        case "system":
            addSystemMessage(data.message);
            scrollMessages();
            break;

        case "users":
            window.ButterflyFriends?.setOnlineUsers(data.users || []);
            break;

        case "profile_updated":
            window.ButterflyProfile?.update(data.user);
            break;

        case "friends":
            window.ButterflyFriends?.setFriends(data.friends || []);
            break;

        case "friend_requests":
            window.ButterflyFriends?.setRequests(data.requests || []);
            break;

        case "search_results":
            window.ButterflyFriends?.setSearchResults(data.users || []);
            break;

        case "friend_action_success":
            window.ButterflyAccount?.showError(data.message);
            break;

        case "settings_success":
            window.ButterflyAccount?.showError(data.message);
            if (data.token) {
                window.Butterfly.setSession(data.token);
            }
            if (data.user) {
                window.ButterflyProfile?.update(data.user);
            }
            break;

        case "account_deleted":
            window.Butterfly.clearSession();
            shouldReconnect = false;
            socket?.close();
            window.Butterfly.showAuth();
            break;

        case "logout_success":
            window.Butterfly.clearSession();
            shouldReconnect = false;
            socket?.close();
            window.Butterfly.showAuth();
            break;

        case "error":
            window.ButterflyAccount?.showError(data.message || "Butterfly encountered an error.");
            break;
    }
}

function addMessage(message) {
    if (!message) return;

    const element = document.createElement("div");
    element.className = "message";

    const avatar = document.createElement("img");
    avatar.className = "avatar avatar-message";
    avatar.src = message.avatar || "resources/images/logo.png";
    avatar.alt = message.username || "User";

    const content = document.createElement("div");
    content.className = "message-content";

    const author = document.createElement("strong");
    author.textContent = message.username || "User";

    const text = document.createElement("p");
    text.textContent = message.content || "";

    content.append(author, text);
    element.append(avatar, content);
    messages.appendChild(element);
}

function addSystemMessage(text) {
    const element = document.createElement("div");
    element.className = "system-message";
    element.textContent = text;
    messages.appendChild(element);
}

function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
}

messageForm.addEventListener("submit", event => {
    event.preventDefault();

    const content = messageInput.value.trim();
    if (!content) return;

    if (window.Butterfly.send({
        type: "message",
        content
    })) {
        messageInput.value = "";
    } else {
        window.ButterflyAccount?.showError("Butterfly is not connected.");
    }
});

document.getElementById("shareButton")?.addEventListener("click", async () => {
    const shareData = {
        title: "Butterfly",
        text: "Join me on Butterfly!",
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(window.location.href);
            window.ButterflyAccount?.showError("Butterfly link copied!");
        }
    } catch {
        // User cancelled the share dialog.
    }
});

connect();
