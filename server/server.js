#!/usr/bin/env node
"use strict";

/*
 * Butterfly backend
 *
 * Node.js:
 *   - WebSocket chat
 *   - accounts/sessions
 *   - SQLite
 *   - friends
 *   - profiles
 *
 * Python Snake Mailer:
 *   - SMTP email delivery
 */

const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

const {
    db,
    getUserById,
    getUserByEmail,
    getUserByUsername
} = require("./database");

const {
    randomId,
    randomCode,
    randomToken,
    hash,
    hashPassword,
    verifyPassword,
    createSession,
    getUserFromSession,
    deleteSession,
    deleteAllSessions
} = require("./auth");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = process.env.BUTTERFLY_PUBLIC_URL || `http://localhost:${PORT}`;
const WEB_URL = (process.env.BUTTERFLY_WEB_URL ||
    "https://joaopgamer233.github.io/butterfly.github.io/").replace(/\/+$/, "");

const MAX_HISTORY = 100;
const MAX_MESSAGE_LENGTH = 500;
const MAX_AVATAR_LENGTH = 300000;
const CODE_EXPIRY = 10 * 60 * 1000;

const onlineUsers = new Map();

function send(socket, data) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function sendError(socket, message, type = "error") {
    send(socket, { type, message });
}

function broadcast(data) {
    const payload = JSON.stringify(data);
    for (const user of onlineUsers.values()) {
        if (user.socket.readyState === WebSocket.OPEN) {
            user.socket.send(payload);
        }
    }
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        avatar: user.avatar || null
    };
}

function isValidUsername(username) {
    return typeof username === "string" &&
        /^[A-Za-z0-9_-]{2,24}$/.test(username);
}

function isValidEmail(email) {
    return typeof email === "string" &&
        email.length <= 320 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidAvatar(avatar) {
    return typeof avatar === "string" &&
        avatar.length <= MAX_AVATAR_LENGTH &&
        (/^data:image\/jpeg;base64,/.test(avatar) ||
         /^data:image\/png;base64,/.test(avatar));
}

function createCode(userId, type, payload = null) {
    const code = randomCode();

    db.prepare(`
        DELETE FROM codes WHERE user_id = ? AND type = ?
    `).run(userId, type);

    db.prepare(`
        INSERT INTO codes
        (user_id, type, code_hash, payload, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        userId,
        type,
        hash(code),
        payload,
        Date.now() + CODE_EXPIRY
    );

    return code;
}

function createTokenCode(userId, type, payload = null) {
    const token = randomToken();

    db.prepare(`
        DELETE FROM codes WHERE user_id = ? AND type = ?
    `).run(userId, type);

    db.prepare(`
        INSERT INTO codes
        (user_id, type, code_hash, payload, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        userId,
        type,
        hash(token),
        payload,
        Date.now() + CODE_EXPIRY
    );

    return token;
}

function consumeCode(userId, type, code) {
    const row = db.prepare(`
        SELECT * FROM codes
        WHERE user_id = ? AND type = ? AND expires_at > ?
        ORDER BY id DESC LIMIT 1
    `).get(userId, type, Date.now());

    if (!row || row.code_hash !== hash(code)) {
        return null;
    }

    db.prepare(`DELETE FROM codes WHERE id = ?`).run(row.id);
    return row;
}

function getFriends(userId) {
    return db.prepare(`
        SELECT u.id, u.username, u.avatar
        FROM friendships f
        JOIN users u ON (
            CASE
                WHEN f.requester_id = ? THEN f.receiver_id
                ELSE f.requester_id
            END
        ) = u.id
        WHERE (f.requester_id = ? OR f.receiver_id = ?)
          AND f.status = 'accepted'
        ORDER BY u.username COLLATE NOCASE
    `).all(userId, userId, userId);
}

function getFriendRequests(userId) {
    return db.prepare(`
        SELECT u.id, u.username, u.avatar
        FROM friendships f
        JOIN users u ON u.id = f.requester_id
        WHERE f.receiver_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
    `).all(userId);
}

function sendFriends(socket, userId) {
    send(socket, {
        type: "friends",
        friends: getFriends(userId)
    });

    send(socket, {
        type: "friend_requests",
        requests: getFriendRequests(userId)
    });
}

function broadcastUsers() {
    broadcast({
        type: "users",
        users: [...onlineUsers.values()].map(publicUser)
    });
}

function sendHistory(socket) {
    const history = db.prepare(`
        SELECT username, avatar, content, timestamp
        FROM messages
        ORDER BY id DESC
        LIMIT ?
    `).all(MAX_HISTORY).reverse();

    send(socket, {
        type: "history",
        messages: history
    });
}

function sendMail(request) {
    return new Promise((resolve, reject) => {
        const python = process.env.BUTTERFLY_PYTHON ||
            (process.platform === "win32" ? "python" : "python3");

        const script = path.join(__dirname, "email.py");
        const child = spawn(python, [script], {
            env: process.env,
            stdio: ["pipe", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", chunk => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", chunk => {
            stderr += chunk.toString();
        });

        child.on("error", error => {
            reject(error);
        });

        child.on("close", code => {
            if (code !== 0) {
                reject(new Error(stderr || stdout || `Python mailer exited with ${code}`));
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                if (!result.ok) {
                    reject(new Error(result.error || "Python mailer failed."));
                    return;
                }
                resolve(result);
            } catch {
                reject(new Error(stdout || "Python mailer returned invalid output."));
            }
        });

        child.stdin.end(JSON.stringify(request));
    });
}

function verificationUrl(token) {
    return `${WEB_URL}/?verify=${encodeURIComponent(token)}`;
}

async function sendAccountVerification(user) {
    const token = createTokenCode(user.id, "email_verification");

    await sendMail({
        to: user.email,
        subject: "Verify your Butterfly account 🦋",
        title: "Verify your Butterfly account",
        text:
            "Welcome to Butterfly! Click the button below to verify your email address. " +
            "This verification link expires after 10 minutes.",
        button_text: "Verify my email",
        button_url: verificationUrl(token)
    });
}

async function sendCodeEmail(user, code, subject, purpose) {
    await sendMail({
        to: user.email,
        subject,
        title: subject,
        text:
            `Use the code below to confirm your Butterfly ${purpose}. ` +
            "The code expires after 10 minutes.",
        code
    });
}

function requireUser(currentUser, socket) {
    if (!currentUser) {
        sendError(socket, "You must be logged in.");
        return false;
    }
    return true;
}

function removeOnline(socket, currentUser) {
    if (currentUser && onlineUsers.get(currentUser.id)?.socket === socket) {
        onlineUsers.delete(currentUser.id);
        broadcastUsers();
    }
}

const httpServer = http.createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            ok: true,
            service: "Butterfly",
            uptime: process.uptime()
        }));
        return;
    }

    if (req.url === "/") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Butterfly backend is running 🦋");
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
});

const wss = new WebSocket.Server({ server: httpServer });

wss.on("connection", socket => {
    let currentUser = null;
    let currentToken = null;

    send(socket, {
        type: "server_ready",
        webUrl: WEB_URL
    });

    socket.on("message", async raw => {
        let data;

        try {
            data = JSON.parse(raw.toString());
        } catch {
            sendError(socket, "Invalid request.");
            return;
        }

        try {
            /* ---------------- REGISTER ---------------- */
            if (data.type === "register") {
                const username = String(data.username || "").trim();
                const email = String(data.email || "").trim().toLowerCase();
                const password = String(data.password || "");

                if (!isValidUsername(username)) {
                    sendError(socket, "Username must be 2-24 characters and may contain only letters, numbers, underscores and hyphens.");
                    return;
                }

                if (!isValidEmail(email)) {
                    sendError(socket, "Invalid email address.");
                    return;
                }

                if (password.length < 8) {
                    sendError(socket, "Password must contain at least 8 characters.");
                    return;
                }

                if (getUserByUsername(username)) {
                    sendError(socket, "That username is already taken.");
                    return;
                }

                if (getUserByEmail(email)) {
                    sendError(socket, "That email is already registered.");
                    return;
                }

                const passwordData = hashPassword(password);
                const userId = randomId();

                db.prepare(`
                    INSERT INTO users
                    (id, username, email, password_salt, password_hash,
                     email_verified, avatar, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
                `).run(
                    userId,
                    username,
                    email,
                    passwordData.salt,
                    passwordData.hash,
                    Date.now()
                );

                const user = getUserById(userId);

                try {
                    await sendAccountVerification(user);
                } catch (mailError) {
                    console.error("Verification email failed:", mailError);
                    sendError(socket, "Account created, but Butterfly could not send the verification email. Use Resend Verification.");
                    send(socket, {
                        type: "registration_created",
                        email
                    });
                    return;
                }

                send(socket, {
                    type: "registration_created",
                    email,
                    message: "Account created! Check your email for the verification link."
                });
                return;
            }

            /* ---------------- RESEND VERIFICATION ---------------- */
            if (data.type === "resend_verification") {
                const email = String(data.email || "").trim().toLowerCase();
                const user = getUserByEmail(email);

                if (!user) {
                    send(socket, {
                        type: "verification_email_sent",
                        message: "If that account exists, a verification email has been sent."
                    });
                    return;
                }

                if (user.email_verified) {
                    sendError(socket, "This email is already verified.");
                    return;
                }

                try {
                    await sendAccountVerification(user);
                    send(socket, {
                        type: "verification_email_sent",
                        message: "A new verification email has been sent."
                    });
                } catch (mailError) {
                    console.error("Resend verification failed:", mailError);
                    sendError(socket, "Butterfly could not send the verification email.");
                }
                return;
            }

            /* ---------------- VERIFY LINK ---------------- */
            if (data.type === "verify_email_link") {
                const token = String(data.token || "");
                const row = db.prepare(`
                    SELECT * FROM codes
                    WHERE type = 'email_verification'
                      AND expires_at > ?
                    ORDER BY id DESC
                `).all(Date.now()).find(item => item.code_hash === hash(token));

                if (!row) {
                    sendError(socket, "This verification link is invalid or expired.");
                    return;
                }

                const user = getUserById(row.user_id);

                if (!user) {
                    sendError(socket, "Account no longer exists.");
                    return;
                }

                db.prepare(`DELETE FROM codes WHERE id = ?`).run(row.id);
                db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).run(user.id);

                send(socket, {
                    type: "verification_success",
                    message: "Email verified! You can now log in."
                });
                return;
            }

            /* ---------------- VERIFY CODE FALLBACK ---------------- */
            if (data.type === "verify_email") {
                const email = String(data.email || "").trim().toLowerCase();
                const code = String(data.code || "").trim();
                const user = getUserByEmail(email);

                if (!user) {
                    sendError(socket, "Invalid verification details.");
                    return;
                }

                const row = consumeCode(user.id, "email_verification_code", code);
                if (!row) {
                    sendError(socket, "Invalid or expired verification code.");
                    return;
                }

                db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).run(user.id);

                send(socket, {
                    type: "verification_success",
                    message: "Email verified! You can now log in."
                });
                return;
            }

            /* ---------------- LOGIN ---------------- */
            if (data.type === "login") {
                const email = String(data.email || "").trim().toLowerCase();
                const password = String(data.password || "");
                const user = getUserByEmail(email);

                if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
                    sendError(socket, "Invalid email or password.", "login_error");
                    return;
                }

                if (!user.email_verified) {
                    send(socket, {
                        type: "email_verification_required",
                        email: user.email,
                        message: "Please verify your email first."
                    });
                    return;
                }

                currentToken = createSession(db, user.id);
                currentUser = getUserById(user.id);
                onlineUsers.set(currentUser.id, {
                    socket,
                    ...currentUser
                });

                send(socket, {
                    type: "login_success",
                    token: currentToken,
                    user: publicUser(currentUser)
                });

                sendHistory(socket);
                sendFriends(socket, currentUser.id);
                broadcastUsers();
                return;
            }

            /* ---------------- SESSION ---------------- */
            if (data.type === "session") {
                const user = getUserFromSession(db, data.token);

                if (!user || !user.email_verified) {
                    send(socket, {
                        type: "session_invalid"
                    });
                    return;
                }

                currentToken = data.token;
                currentUser = user;
                onlineUsers.set(user.id, { socket, ...user });

                send(socket, {
                    type: "login_success",
                    token: currentToken,
                    user: publicUser(user)
                });

                sendHistory(socket);
                sendFriends(socket, user.id);
                broadcastUsers();
                return;
            }

            /* ---------------- PROFILE ---------------- */
            if (data.type === "update_profile") {
                if (!requireUser(currentUser, socket)) return;

                const avatar = data.avatar;

                if (avatar !== null && avatar !== "" && !isValidAvatar(avatar)) {
                    sendError(socket, "Invalid profile picture.");
                    return;
                }

                db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`)
                    .run(avatar || null, currentUser.id);

                currentUser = getUserById(currentUser.id);
                onlineUsers.set(currentUser.id, { socket, ...currentUser });

                send(socket, {
                    type: "profile_updated",
                    user: publicUser(currentUser)
                });

                broadcastUsers();
                return;
            }

            /* ---------------- USER SEARCH ---------------- */
            if (data.type === "search_users") {
                if (!requireUser(currentUser, socket)) return;

                const query = String(data.query || "").trim();
                if (!query) {
                    send(socket, { type: "search_results", users: [] });
                    return;
                }

                const users = db.prepare(`
                    SELECT id, username, avatar
                    FROM users
                    WHERE username LIKE ? COLLATE NOCASE
                      AND id != ?
                    ORDER BY username COLLATE NOCASE
                    LIMIT 20
                `).all(`%${query}%`, currentUser.id);

                send(socket, {
                    type: "search_results",
                    users
                });
                return;
            }

            /* ---------------- FRIEND REQUEST ---------------- */
            if (data.type === "friend_request") {
                if (!requireUser(currentUser, socket)) return;

                const targetId = String(data.userId || "");
                const target = getUserById(targetId);

                if (!target || target.id === currentUser.id) {
                    sendError(socket, "That user cannot receive this request.");
                    return;
                }

                const existing = db.prepare(`
                    SELECT * FROM friendships
                    WHERE (requester_id = ? AND receiver_id = ?)
                       OR (requester_id = ? AND receiver_id = ?)
                `).get(currentUser.id, targetId, targetId, currentUser.id);

                if (existing) {
                    sendError(socket, "A friendship or request already exists.");
                    return;
                }

                db.prepare(`
                    INSERT INTO friendships
                    (requester_id, receiver_id, status, created_at)
                    VALUES (?, ?, 'pending', ?)
                `).run(currentUser.id, targetId, Date.now());

                sendFriends(socket, currentUser.id);

                const targetConnection = onlineUsers.get(targetId);
                if (targetConnection) {
                    sendFriends(targetConnection.socket, targetId);
                }

                send(socket, {
                    type: "friend_action_success",
                    message: "Friend request sent."
                });
                return;
            }

            /* ---------------- FRIEND ACCEPT ---------------- */
            if (data.type === "friend_accept") {
                if (!requireUser(currentUser, socket)) return;

                const requesterId = String(data.userId || "");

                db.prepare(`
                    UPDATE friendships
                    SET status = 'accepted'
                    WHERE requester_id = ?
                      AND receiver_id = ?
                      AND status = 'pending'
                `).run(requesterId, currentUser.id);

                sendFriends(socket, currentUser.id);

                const requesterConnection = onlineUsers.get(requesterId);
                if (requesterConnection) {
                    sendFriends(requesterConnection.socket, requesterId);
                }
                return;
            }

            /* ---------------- FRIEND DECLINE ---------------- */
            if (data.type === "friend_decline") {
                if (!requireUser(currentUser, socket)) return;

                db.prepare(`
                    DELETE FROM friendships
                    WHERE requester_id = ?
                      AND receiver_id = ?
                      AND status = 'pending'
                `).run(String(data.userId), currentUser.id);

                sendFriends(socket, currentUser.id);
                return;
            }

            /* ---------------- FRIEND REMOVE ---------------- */
            if (data.type === "friend_remove") {
                if (!requireUser(currentUser, socket)) return;

                const targetId = String(data.userId);

                db.prepare(`
                    DELETE FROM friendships
                    WHERE
                        (requester_id = ? AND receiver_id = ?)
                        OR
                        (requester_id = ? AND receiver_id = ?)
                `).run(currentUser.id, targetId, targetId, currentUser.id);

                sendFriends(socket, currentUser.id);

                const targetConnection = onlineUsers.get(targetId);
                if (targetConnection) {
                    sendFriends(targetConnection.socket, targetId);
                }
                return;
            }

            /* ---------------- CHAT MESSAGE ---------------- */
            if (data.type === "message") {
                if (!requireUser(currentUser, socket)) return;

                const content = String(data.content || "").trim();

                if (!content || content.length > MAX_MESSAGE_LENGTH) {
                    sendError(socket, "Message must be 1-500 characters.");
                    return;
                }

                const message = {
                    username: currentUser.username,
                    avatar: currentUser.avatar || null,
                    content,
                    timestamp: Date.now()
                };

                db.prepare(`
                    INSERT INTO messages
                    (user_id, username, avatar, content, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    currentUser.id,
                    message.username,
                    message.avatar,
                    message.content,
                    message.timestamp
                );

                broadcast({
                    type: "message",
                    message
                });
                return;
            }

            /* ---------------- USERNAME CHANGE ---------------- */
            if (data.type === "request_username_change") {
                if (!requireUser(currentUser, socket)) return;

                const newUsername = String(data.username || "").trim();

                if (!isValidUsername(newUsername)) {
                    sendError(socket, "Username must be 2-24 characters and may contain only letters, numbers, underscores and hyphens.");
                    return;
                }

                if (newUsername.toLowerCase() === currentUser.username.toLowerCase()) {
                    sendError(socket, "That is already your username.");
                    return;
                }

                if (getUserByUsername(newUsername)) {
                    sendError(socket, "That username is already taken.");
                    return;
                }

                const code = createCode(
                    currentUser.id,
                    "username_change",
                    newUsername
                );

                try {
                    await sendCodeEmail(
                        currentUser,
                        code,
                        "Confirm your Butterfly username change",
                        "username change"
                    );

                    send(socket, {
                        type: "settings_success",
                        message: "A verification code was sent to your email."
                    });
                } catch (mailError) {
                    console.error("Username change email failed:", mailError);
                    sendError(socket, "Could not send the verification email.");
                }
                return;
            }

            if (data.type === "confirm_username_change") {
                if (!requireUser(currentUser, socket)) return;

                const row = consumeCode(
                    currentUser.id,
                    "username_change",
                    String(data.code || "").trim()
                );

                if (!row) {
                    sendError(socket, "Invalid or expired verification code.");
                    return;
                }

                const newUsername = row.payload;

                if (!isValidUsername(newUsername) || getUserByUsername(newUsername)) {
                    sendError(socket, "That username is no longer available.");
                    return;
                }

                db.prepare(`UPDATE users SET username = ? WHERE id = ?`)
                    .run(newUsername, currentUser.id);

                currentUser = getUserById(currentUser.id);
                onlineUsers.set(currentUser.id, { socket, ...currentUser });

                send(socket, {
                    type: "settings_success",
                    message: "Username changed successfully.",
                    user: publicUser(currentUser)
                });

                broadcastUsers();
                return;
            }

            /* ---------------- CHANGE PASSWORD ---------------- */
            if (data.type === "change_password") {
                if (!requireUser(currentUser, socket)) return;

                const currentPassword = String(data.currentPassword || "");
                const newPassword = String(data.newPassword || "");

                if (!verifyPassword(
                    currentPassword,
                    currentUser.password_salt,
                    currentUser.password_hash
                )) {
                    sendError(socket, "Current password is incorrect.");
                    return;
                }

                if (newPassword.length < 8) {
                    sendError(socket, "New password must contain at least 8 characters.");
                    return;
                }

                const passwordData = hashPassword(newPassword);

                db.prepare(`
                    UPDATE users
                    SET password_salt = ?, password_hash = ?
                    WHERE id = ?
                `).run(
                    passwordData.salt,
                    passwordData.hash,
                    currentUser.id
                );

                deleteAllSessions(db, currentUser.id);
                currentToken = createSession(db, currentUser.id);

                send(socket, {
                    type: "settings_success",
                    message: "Password changed successfully.",
                    token: currentToken
                });
                return;
            }

            /* ---------------- PASSWORD RESET REQUEST ---------------- */
            if (data.type === "request_password_reset") {
                const email = String(data.email || "").trim().toLowerCase();
                const user = getUserByEmail(email);

                if (user) {
                    const code = createCode(user.id, "password_reset");

                    try {
                        await sendCodeEmail(
                            user,
                            code,
                            "Reset your Butterfly password",
                            "password reset"
                        );
                    } catch (mailError) {
                        console.error("Password reset email failed:", mailError);
                    }
                }

                send(socket, {
                    type: "password_reset_requested",
                    message: "If that email belongs to a Butterfly account, a recovery code has been sent."
                });
                return;
            }

            /* ---------------- PASSWORD RESET ---------------- */
            if (data.type === "reset_password") {
                const email = String(data.email || "").trim().toLowerCase();
                const code = String(data.code || "").trim();
                const password = String(data.password || "");
                const user = getUserByEmail(email);

                if (!user || password.length < 8) {
                    sendError(socket, "Invalid recovery details.");
                    return;
                }

                const row = consumeCode(user.id, "password_reset", code);

                if (!row) {
                    sendError(socket, "Invalid or expired recovery code.");
                    return;
                }

                const passwordData = hashPassword(password);

                db.prepare(`
                    UPDATE users
                    SET password_salt = ?, password_hash = ?
                    WHERE id = ?
                `).run(
                    passwordData.salt,
                    passwordData.hash,
                    user.id
                );

                deleteAllSessions(db, user.id);

                send(socket, {
                    type: "password_reset_success",
                    message: "Password reset successfully. You can now log in."
                });
                return;
            }

            /* ---------------- DELETE ACCOUNT ---------------- */
            if (data.type === "request_account_deletion") {
                if (!requireUser(currentUser, socket)) return;

                const code = createCode(
                    currentUser.id,
                    "account_deletion"
                );

                try {
                    await sendCodeEmail(
                        currentUser,
                        code,
                        "Confirm your Butterfly account deletion",
                        "account deletion"
                    );

                    send(socket, {
                        type: "settings_success",
                        message: "A confirmation code was sent to your email."
                    });
                } catch (mailError) {
                    console.error("Account deletion email failed:", mailError);
                    sendError(socket, "Could not send the confirmation email.");
                }
                return;
            }

            if (data.type === "confirm_account_deletion") {
                if (!requireUser(currentUser, socket)) return;

                const row = consumeCode(
                    currentUser.id,
                    "account_deletion",
                    String(data.code || "").trim()
                );

                if (!row) {
                    sendError(socket, "Invalid or expired deletion code.");
                    return;
                }

                db.prepare(`DELETE FROM users WHERE id = ?`).run(currentUser.id);

                deleteAllSessions(db, currentUser.id);
                onlineUsers.delete(currentUser.id);

                currentUser = null;
                currentToken = null;

                send(socket, {
                    type: "account_deleted"
                });

                broadcastUsers();
                return;
            }

            /* ---------------- LOGOUT ---------------- */
            if (data.type === "logout") {
                if (currentToken) {
                    deleteSession(db, currentToken);
                }

                removeOnline(socket, currentUser);

                currentUser = null;
                currentToken = null;

                send(socket, {
                    type: "logout_success"
                });
                return;
            }

            sendError(socket, "Unknown request type.");
        } catch (error) {
            console.error("Butterfly request error:", error);
            sendError(socket, "Butterfly server error. Check the backend console.");
        }
    });

    socket.on("close", () => {
        removeOnline(socket, currentUser);
    });

    socket.on("error", error => {
        console.error("WebSocket error:", error);
    });
});

httpServer.listen(PORT, () => {
    console.log(`🦋 Butterfly backend running at ${PUBLIC_URL}`);
    console.log(`🌐 Web app: ${WEB_URL}`);
    console.log(`🐍 Python mailer: ${process.env.BUTTERFLY_PYTHON || (process.platform === "win32" ? "python" : "python3")}`);
});
