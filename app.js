"use strict";


const BACKEND_URL =
    (window.BUTTERFLY_CONFIG && window.BUTTERFLY_CONFIG.BACKEND_URL) ||
    "http://localhost:3000";

const WEBSOCKET_URL =
    BACKEND_URL.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");

const SESSION_STORAGE_KEY =
    "butterfly_session";

const RECONNECT_DELAY =
    2000;


let socket = null;

let reconnectTimer = null;

let shouldReconnect = true;


/* =========================================
   DOM
========================================= */

const authScreen =
    document.getElementById("authScreen");

const chatScreen =
    document.getElementById("chatScreen");

const messages =
    document.getElementById("messages");

const messageForm =
    document.getElementById("messageForm");

const messageInput =
    document.getElementById("messageInput");

const connectionStatus =
    document.getElementById("connectionStatus");


/* =========================================
   GLOBAL BUTTERFLY API
========================================= */

window.Butterfly = {

    getSocket() {
        return socket;
    },

    send(data) {

        if (
            !socket ||
            socket.readyState !==
                WebSocket.OPEN
        ) {

            return false;
        }

        socket.send(
            JSON.stringify(data)
        );

        return true;
    },

    getSession() {

        return localStorage.getItem(
            SESSION_STORAGE_KEY
        );

    },

    setSession(token) {

        localStorage.setItem(
            SESSION_STORAGE_KEY,
            token
        );

    },

    clearSession() {

        localStorage.removeItem(
            SESSION_STORAGE_KEY
        );

    },

    showAuth() {

        authScreen.classList.remove(
            "hidden"
        );

        chatScreen.classList.add(
            "hidden"
        );

    },

    showChat() {

        authScreen.classList.add(
            "hidden"
        );

        chatScreen.classList.remove(
            "hidden"
        );

    }

};


/* =========================================
   STATUS
========================================= */

function setStatus(text) {

    connectionStatus.textContent =
        text;

}


/* =========================================
   CONNECT
========================================= */

function connect() {

    if (
        socket &&
        (
            socket.readyState ===
                WebSocket.OPEN ||

            socket.readyState ===
                WebSocket.CONNECTING
        )
    ) {

        return;
    }


    setStatus(
        "Connecting..."
    );


    socket =
        new WebSocket(
            WEBSOCKET_URL
        );


    socket.addEventListener(
        "open",
        () => {

            setStatus(
                "Connected"
            );


            const session =
                window.Butterfly
                    .getSession();


            if (session) {

                window.Butterfly.send({

                    type: "session",

                    token: session

                });

            }

        }
    );


    socket.addEventListener(
        "message",
        event => {

            let data;


            try {

                data =
                    JSON.parse(
                        event.data
                    );

            } catch {

                return;
            }


            handleMessage(data);

        }
    );


    socket.addEventListener(
        "close",
        () => {

            setStatus(
                "Disconnected"
            );


            if (!shouldReconnect) {
                return;
            }


            clearTimeout(
                reconnectTimer
            );


            reconnectTimer =
                setTimeout(
                    connect,
                    RECONNECT_DELAY
                );

        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.error(
                "Butterfly:",
                error
            );

        }
    );

}


/* =========================================
   SERVER MESSAGES
========================================= */

function handleMessage(data) {

    switch (data.type) {


        case "login_success":

            window.Butterfly.showChat();

            if (data.token) {

                window.Butterfly.setSession(
                    data.token
                );

            }


            if (
                window.ButterflyAccount
            ) {

                window.ButterflyAccount.setUser(
                    data.user
                );

            }

            break;


        case "login_error":

            if (
                window.ButterflyAccount
            ) {

                window.ButterflyAccount.showError(
                    data.message
                );

            }

            break;


        case "email_verification_required":

            if (
                window.ButterflyAccount
            ) {

                window.ButterflyAccount.showVerification();
            }

            break;


        case "verification_success":

            if (
                window.ButterflyAccount
            ) {

                window.ButterflyAccount.showLogin(
                    "Email verified! You can now log in."
                );

            }

            break;


        case "verification_email_sent":

            if (
                window.ButterflyAccount
            ) {

                window.ButterflyAccount.showError(
                    "Verification email sent! Check your Gmail inbox and Spam folder."
                );

            }

            break;


        case "history":

            messages.innerHTML = "";


            for (
                const message
                of data.messages || []
            ) {

                addMessage(
                    message
                );

            }


            scrollMessages();

            break;


        case "message":

            addMessage(
                data.message
            );

            scrollMessages();

            break;


        case "system":

            addSystemMessage(
                data.message
            );

            scrollMessages();

            break;


        case "users":

            if (
                window.ButterflyFriends
            ) {

                window.ButterflyFriends.setOnlineUsers(
                    data.users || []
                );

            }

            break;


        case "profile_updated":

            if (
                window.ButterflyProfile
            ) {

                window.ButterflyProfile.update(
                    data.user
                );

            }

            break;


        case "friends":

            if (
                window.ButterflyFriends
            ) {

                window.ButterflyFriends.setFriends(
                    data.friends || []
                );

            }

            break;


        case "friend_requests":

            if (
                window.ButterflyFriends
            ) {

                window.ButterflyFriends.setRequests(
                    data.requests || []
                );

            }

            break;


        case "search_results":

            if (
                window.ButterflyFriends
            ) {

                window.ButterflyFriends.setSearchResults(
                    data.users || []
                );

            }

            break;


        case "settings_success":

            alert(
                data.message ||
                "Settings updated."
            );

            if (data.user) {

                if (
                    window.ButterflyProfile
                ) {

                    window.ButterflyProfile.update(
                        data.user
                    );

                }

            }

            break;


        case "account_deleted":

            window.Butterfly.clearSession();

            shouldReconnect = false;

            if (socket) {
                socket.close();
            }

            window.Butterfly.showAuth();

            break;


        case "logout_success":

            window.Butterfly.clearSession();

            shouldReconnect = false;

            if (socket) {
                socket.close();
            }

            window.Butterfly.showAuth();

            break;


        case "error":

            alert(
                data.message ||
                "Butterfly encountered an error."
            );

            break;

    }

}


/* =========================================
   MESSAGE
========================================= */

function addMessage(message) {

    if (!message) {
        return;
    }


    const element =
        document.createElement("div");

    element.className =
        "message";


    const avatar =
        document.createElement("img");

    avatar.className =
        "avatar avatar-message";

    avatar.src =
        message.avatar ||
        "resources/images/logo.png";

    avatar.alt =
        message.username ||
        "User";


    const content =
        document.createElement("div");

    content.className =
        "message-content";


    const author =
        document.createElement("strong");

    author.textContent =
        message.username;


    const text =
        document.createElement("p");

    text.textContent =
        message.content;


    content.appendChild(
        author
    );

    content.appendChild(
        text
    );


    element.appendChild(
        avatar
    );

    element.appendChild(
        content
    );


    messages.appendChild(
        element
    );

}


function addSystemMessage(text) {

    const element =
        document.createElement("div");

    element.className =
        "system-message";

    element.textContent =
        text;

    messages.appendChild(
        element
    );

}


function scrollMessages() {

    messages.scrollTop =
        messages.scrollHeight;

}


/* =========================================
   SEND CHAT MESSAGE
========================================= */

messageForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const content =
            messageInput.value.trim();


        if (!content) {
            return;
        }


        if (
            window.Butterfly.send({

                type: "message",

                content

            })
        ) {

            messageInput.value = "";

        }

    }
);


/* =========================================
   SHARE
========================================= */

document
    .getElementById("shareButton")
    .addEventListener(
        "click",
        async () => {

            const shareData = {

                title:
                    "Butterfly",

                text:
                    "Join me on Butterfly!",

                url:
                    window.location.href

            };


            try {

                if (
                    navigator.share
                ) {

                    await navigator.share(
                        shareData
                    );

                } else {

                    await navigator.clipboard.writeText(
                        window.location.href
                    );

                    alert(
                        "Butterfly link copied!"
                    );

                }

            } catch (error) {

                console.log(
                    "Share cancelled."
                );

            }

        }
    );


/* =========================================
   START
========================================= */

connect();