"use strict";


const fs =
    require("node:fs");

const path =
    require("node:path");


/* Load a local .env file without requiring another package. */
const envPath =
    path.join(__dirname, "..", ".env");

if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const equals = trimmed.indexOf("=");
        if (equals === -1) continue;
        const key = trimmed.slice(0, equals).trim();
        let value = trimmed.slice(equals + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}


const http =
    require("node:http");

const WebSocket =
    require("ws");

const {
    db,
    getUserById,
    getUserByEmail,
    getUserByUsername
} = require("./database");

const {
    randomId,
    randomCode,
    hash,
    hashPassword,
    verifyPassword,
    createSession,
    getUserFromSession,
    deleteSession,
    deleteAllSessions
} = require("./auth");

const {
    sendCode,
    sendVerificationEmail
} = require("./email");


const PORT = Number(process.env.PORT || 3000);

const MAX_HISTORY = 100;

const MAX_MESSAGE_LENGTH = 500;

const MAX_AVATAR_LENGTH = 300000;

const CODE_EXPIRY =
    10 * 60 * 1000;

const PUBLIC_URL =
    (process.env.BUTTERFLY_PUBLIC_URL ||
        `http://localhost:${PORT}`)
        .replace(/\/$/, "");

const FRONTEND_URL =
    (process.env.BUTTERFLY_FRONTEND_URL || "http://localhost:5500")
        .replace(/\/$/, "");


/* =========================================
   HTTP + WEBSOCKET SERVER
========================================= */

const httpServer =
    http.createServer(
        (request, response) => {

            const url =
                new URL(
                    request.url,
                    `http://${request.headers.host || "localhost"}`
                );


            if (
                request.method === "GET" &&
                url.pathname === "/verify"
            ) {

                const token =
                    url.searchParams.get("token") || "";

                let verified = false;
                let message =
                    "This verification link is invalid or expired.";

                if (token) {

                    const row =
                        db.prepare(`
                            SELECT *
                            FROM codes
                            WHERE type = ?
                            AND code_hash = ?
                            AND expires_at > ?
                            ORDER BY id DESC
                            LIMIT 1
                        `).get(
                            "email_verification_link",
                            hash(token),
                            Date.now()
                        );


                    if (row) {

                        const user =
                            getUserById(row.user_id);

                        if (user) {

                            db.prepare(`
                                UPDATE users
                                SET email_verified = 1
                                WHERE id = ?
                            `).run(user.id);

                            db.prepare(`
                                DELETE FROM codes
                                WHERE user_id = ?
                                AND type IN (?, ?)
                            `).run(
                                user.id,
                                "email_verification",
                                "email_verification_link"
                            );

                            verified = true;
                            message =
                                "Your Butterfly account has been verified!";
                        }
                    }
                }

                response.writeHead(
                    200,
                    {
                        "Content-Type": "text/html; charset=utf-8",
                        "Cache-Control": "no-store"
                    }
                );

                response.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Butterfly - Email Verification</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#171722;color:#fff;font-family:Arial,sans-serif}
.card{width:min(90%,460px);padding:36px;border-radius:20px;background:#242438;text-align:center;box-sizing:border-box}
h1{margin-top:0}p{color:#c9c9d8;line-height:1.6}.ok{font-size:48px}a{display:inline-block;margin-top:14px;padding:12px 20px;border-radius:10px;background:#fff;color:#171722;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<div class="card">
<div class="ok">${verified ? "✓" : "!"}</div>
<h1>${verified ? "Email Verified!" : "Verification Failed"}</h1>
<p>${message}</p>
${verified ? `<a href="${FRONTEND_URL}/?verified=1">Open Butterfly</a>` : `<a href="${FRONTEND_URL}">Return to Butterfly</a>`}
</div>
</body>
</html>`);

                return;
            }


            if (request.method === "GET" && url.pathname === "/health") {
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify({ ok: true, service: "butterfly" }));
                return;
            }


            response.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });
            response.end("Butterfly server");
        }
    );


const wss =
    new WebSocket.Server({
        server: httpServer
    });


httpServer.listen(
    PORT,
    () => {
        console.log(`Butterfly server running at ${PUBLIC_URL}`);
        console.log(`WebSocket server listening on port ${PORT}`);
    }
);


/* =========================================
   ONLINE USERS
========================================= */

const onlineUsers =
    new Map();


/* =========================================
   HELPERS
========================================= */

function send(socket, data) {

    if (
        socket.readyState ===
        WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(data)
        );

    }

}


function broadcast(data) {

    const payload =
        JSON.stringify(data);


    for (
        const user
        of onlineUsers.values()
    ) {

        if (
            user.socket.readyState ===
            WebSocket.OPEN
        ) {

            user.socket.send(
                payload
            );

        }

    }

}


function publicUser(user) {

    return {

        id:
            user.id,

        username:
            user.username,

        avatar:
            user.avatar || null

    };

}


function isValidUsername(username) {
    return (
        typeof username === "string" &&
        username.length >= 2 &&
        username.length <= 24 &&
        /^[A-Za-z0-9_-]+$/.test(username)
    );
}


function isValidEmail(email) {

    return (
        typeof email === "string" &&

        email.length <= 320 &&

        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email)
    );

}


function isValidAvatar(avatar) {

    return (
        typeof avatar === "string" &&

        avatar.length <=
            MAX_AVATAR_LENGTH &&

        (
            avatar.startsWith(
                "data:image/jpeg;base64,"
            ) ||

            avatar.startsWith(
                "data:image/png;base64,"
            )
        )
    );

}


/* =========================================
   CODES
========================================= */

function createCode(
    userId,
    type,
    payload = null
) {

    const code =
        randomCode();


    db.prepare(`
        DELETE FROM codes
        WHERE user_id = ?
        AND type = ?
    `).run(
        userId,
        type
    );


    db.prepare(`
        INSERT INTO codes
        (
            user_id,
            type,
            code_hash,
            payload,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(

        userId,

        type,

        hash(code),

        payload,

        Date.now() +
            CODE_EXPIRY

    );


    return code;

}


function createVerificationLinkToken(userId) {

    const token =
        require("./auth").randomToken();

    db.prepare(`
        DELETE FROM codes
        WHERE user_id = ?
        AND type = ?
    `).run(
        userId,
        "email_verification_link"
    );

    db.prepare(`
        INSERT INTO codes
        (
            user_id,
            type,
            code_hash,
            payload,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        userId,
        "email_verification_link",
        hash(token),
        null,
        Date.now() + CODE_EXPIRY
    );

    return token;

}


function consumeCode(
    userId,
    type,
    code
) {

    const row =
        db.prepare(`
            SELECT *
            FROM codes
            WHERE user_id = ?
            AND type = ?
            AND expires_at > ?
            ORDER BY id DESC
            LIMIT 1
        `).get(

            userId,

            type,

            Date.now()

        );


    if (!row) {
        return null;
    }


    if (
        row.code_hash !==
        hash(code)
    ) {

        return null;
    }


    db.prepare(`
        DELETE FROM codes
        WHERE id = ?
    `).run(
        row.id
    );


    return row;

}


/* =========================================
   FRIENDS
========================================= */

function getFriends(userId) {

    return db.prepare(`
        SELECT
            u.id,
            u.username,
            u.avatar
        FROM friendships f
        JOIN users u
            ON (
                CASE
                    WHEN f.requester_id = ?
                    THEN f.receiver_id
                    ELSE f.requester_id
                END
            ) = u.id
        WHERE
            (
                f.requester_id = ?
                OR
                f.receiver_id = ?
            )
            AND f.status = 'accepted'
    `).all(
        userId,
        userId,
        userId
    );

}


function getFriendRequests(userId) {

    return db.prepare(`
        SELECT
            u.id,
            u.username,
            u.avatar
        FROM friendships f
        JOIN users u
            ON u.id = f.requester_id
        WHERE
            f.receiver_id = ?
            AND f.status = 'pending'
    `).all(
        userId
    );

}


function sendFriends(
    socket,
    userId
) {

    send(
        socket,
        {
            type:
                "friends",

            friends:
                getFriends(
                    userId
                )
        }
    );


    send(
        socket,
        {
            type:
                "friend_requests",

            requests:
                getFriendRequests(
                    userId
                )
        }
    );

}


/* =========================================
   BROADCAST ONLINE USERS
========================================= */

function broadcastUsers() {

    broadcast({

        type:
            "users",

        users:
            Array
                .from(
                    onlineUsers.values()
                )
                .map(
                    publicUser
                )

    });

}


/* =========================================
   SEND HISTORY
========================================= */

function sendHistory(socket) {

    const history =
        db.prepare(`
            SELECT
                username,
                avatar,
                content,
                timestamp
            FROM messages
            ORDER BY id DESC
            LIMIT ?
        `).all(
            MAX_HISTORY
        ).reverse();


    send(
        socket,
        {
            type:
                "history",

            messages:
                history
        }
    );

}


/* =========================================
   CONNECTION
========================================= */

wss.on(
    "connection",
    socket => {

        let currentUser = null;

        let currentToken = null;


        socket.on(
            "message",
            async raw => {

                let data;


                try {

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                } catch {

                    send(
                        socket,
                        {
                            type:
                                "error",

                            message:
                                "Invalid request."
                        }
                    );

                    return;
                }


                try {

                    /* =========================
                       REGISTER
                    ========================= */

                    if (
                        data.type ===
                        "register"
                    ) {

                        const username =
                            String(
                                data.username ||
                                ""
                            ).trim();

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim()
                            .toLowerCase();

                        const password =
                            String(
                                data.password ||
                                ""
                            );


                        if (
                            !isValidUsername(
                                username
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Username may contain letters, numbers, underscores and hyphens only."
                                }
                            );

                            return;
                        }


                        if (
                            !isValidEmail(
                                email
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid email address."
                                }
                            );

                            return;
                        }


                        if (
                            password.length <
                            8
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Password must contain at least 8 characters."
                                }
                            );

                            return;
                        }


                        if (
                            getUserByUsername(
                                username
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "That username is already taken."
                                }
                            );

                            return;
                        }


                        if (
                            getUserByEmail(
                                email
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "That email is already registered."
                                }
                            );

                            return;
                        }


                        const passwordData =
                            hashPassword(
                                password
                            );


                        const userId =
                            randomId();


                        db.prepare(`
                            INSERT INTO users
                            (
                                id,
                                username,
                                email,
                                password_salt,
                                password_hash,
                                email_verified,
                                avatar,
                                created_at
                            )
                            VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
                        `).run(

                            userId,

                            username,

                            email,

                            passwordData.salt,

                            passwordData.hash,

                            Date.now()

                        );


                        const code =
                            createCode(
                                userId,
                                "email_verification"
                            );

                        const verificationToken =
                            createVerificationLinkToken(
                                userId
                            );

                        const verificationUrl =
                            `${PUBLIC_URL}/verify?token=${encodeURIComponent(verificationToken)}`;

                        try {

                            await sendVerificationEmail(
                                email,
                                verificationUrl,
                                code
                            );

                        } catch (emailError) {

                            db.prepare(`
                                DELETE FROM users
                                WHERE id = ?
                            `).run(userId);

                            throw emailError;
                        }


                        send(
                            socket,
                            {
                                type:
                                    "email_verification_required"
                            }
                        );


                        return;
                    }


                    /* =========================
                       VERIFY EMAIL
                    ========================= */

                    if (
                        data.type ===
                        "verify_email"
                    ) {

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim()
                            .toLowerCase();


                        const user =
                            getUserByEmail(
                                email
                            );


                        if (!user) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid verification request."
                                }
                            );

                            return;
                        }


                        const result =
                            consumeCode(

                                user.id,

                                "email_verification",

                                String(
                                    data.code ||
                                    ""
                                )

                            );


                        if (!result) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid or expired verification code."
                                }
                            );

                            return;
                        }


                        db.prepare(`
                            UPDATE users
                            SET email_verified = 1
                            WHERE id = ?
                        `).run(
                            user.id
                        );


                        send(
                            socket,
                            {
                                type:
                                    "verification_success"
                            }
                        );


                        return;
                    }


                    /* =========================
                       RESEND VERIFICATION EMAIL
                    ========================= */

                    if (
                        data.type ===
                        "resend_verification"
                    ) {

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim().toLowerCase();

                        const user =
                            getUserByEmail(email);

                        if (!user) {
                            send(socket, {
                                type: "error",
                                message: "No Butterfly account was found for that email."
                            });
                            return;
                        }

                        if (user.email_verified) {
                            send(socket, {
                                type: "error",
                                message: "That email is already verified."
                            });
                            return;
                        }

                        const code =
                            createCode(
                                user.id,
                                "email_verification"
                            );

                        const verificationToken =
                            createVerificationLinkToken(
                                user.id
                            );

                        const verificationUrl =
                            `${PUBLIC_URL}/verify?token=${encodeURIComponent(verificationToken)}`;

                        await sendVerificationEmail(
                            email,
                            verificationUrl,
                            code
                        );

                        send(socket, {
                            type: "verification_email_sent"
                        });

                        return;
                    }


                    /* =========================
                       LOGIN
                    ========================= */

                    if (
                        data.type ===
                        "login"
                    ) {

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim()
                            .toLowerCase();


                        const password =
                            String(
                                data.password ||
                                ""
                            );


                        const user =
                            getUserByEmail(
                                email
                            );


                        if (
                            !user ||
                            !verifyPassword(
                                password,
                                user.password_salt,
                                user.password_hash
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "login_error",

                                    message:
                                        "Invalid email or password."
                                }
                            );

                            return;
                        }


                        if (
                            !user.email_verified
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "login_error",

                                    message:
                                        "Please verify your email first."
                                }
                            );

                            return;
                        }


                        const token =
                            createSession(
                                db,
                                user.id
                            );


                        currentUser =
                            user;

                        currentToken =
                            token;


                        onlineUsers.set(
                            user.id,
                            {
                                ...publicUser(
                                    user
                                ),

                                socket
                            }
                        );


                        send(
                            socket,
                            {
                                type:
                                    "login_success",

                                token,

                                user:
                                    publicUser(
                                        user
                                    )
                            }
                        );


                        sendHistory(
                            socket
                        );


                        sendFriends(
                            socket,
                            user.id
                        );


                        broadcastUsers();


                        return;
                    }


                    /* =========================
                       SESSION
                    ========================= */

                    if (
                        data.type ===
                        "session"
                    ) {

                        const user =
                            getUserFromSession(
                                db,
                                data.token
                            );


                        if (!user) {

                            send(
                                socket,
                                {
                                    type:
                                        "login_error",

                                    message:
                                        "Session expired."
                                }
                            );

                            return;
                        }


                        currentUser =
                            user;

                        currentToken =
                            data.token;


                        onlineUsers.set(
                            user.id,
                            {
                                ...publicUser(
                                    user
                                ),

                                socket
                            }
                        );


                        send(
                            socket,
                            {
                                type:
                                    "login_success",

                                user:
                                    publicUser(
                                        user
                                    )
                            }
                        );


                        sendHistory(
                            socket
                        );


                        sendFriends(
                            socket,
                            user.id
                        );


                        broadcastUsers();


                        return;
                    }


                    /* =========================
                       AUTH CHECK
                    ========================= */

                    if (!currentUser) {

                        send(
                            socket,
                            {
                                type:
                                    "error",

                                message:
                                    "You must be logged in."
                            }
                        );

                        return;
                    }


                    /* =========================
                       UPDATE PROFILE
                    ========================= */

                    if (
                        data.type ===
                        "update_profile"
                    ) {

                        const avatar =
                            data.avatar;


                        if (
                            avatar !== null &&
                            avatar !== "" &&
                            !isValidAvatar(
                                avatar
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid profile picture."
                                }
                            );

                            return;
                        }


                        db.prepare(`
                            UPDATE users
                            SET avatar = ?
                            WHERE id = ?
                        `).run(

                            avatar || null,

                            currentUser.id

                        );


                        currentUser =
                            getUserById(
                                currentUser.id
                            );


                        onlineUsers.set(
                            currentUser.id,
                            {
                                ...publicUser(
                                    currentUser
                                ),

                                socket
                            }
                        );


                        send(
                            socket,
                            {
                                type:
                                    "profile_updated",

                                user:
                                    publicUser(
                                        currentUser
                                    )
                            }
                        );


                        broadcastUsers();

                        return;
                    }


                    /* =========================
                       SEARCH USERS
                    ========================= */

                    if (
                        data.type ===
                        "search_users"
                    ) {

                        const query =
                            String(
                                data.query ||
                                ""
                            ).trim();


                        if (!query) {
                            return;
                        }


                        const users =
                            db.prepare(`
                                SELECT
                                    id,
                                    username,
                                    avatar
                                FROM users
                                WHERE username LIKE ?
                                AND id != ?
                                LIMIT 20
                            `).all(

                                `%${query}%`,

                                currentUser.id

                            );


                        send(
                            socket,
                            {
                                type:
                                    "search_results",

                                users
                            }
                        );


                        return;
                    }


                    /* =========================
                       FRIEND REQUEST
                    ========================= */

                    if (
                        data.type ===
                        "friend_request"
                    ) {

                        const targetId =
                            String(
                                data.userId ||
                                ""
                            );


                        if (
                            targetId ===
                            currentUser.id
                        ) {

                            return;
                        }


                        const target =
                            getUserById(
                                targetId
                            );


                        if (!target) {
                            return;
                        }


                        const existing =
                            db.prepare(`
                                SELECT *
                                FROM friendships
                                WHERE
                                (
                                    requester_id = ?
                                    AND receiver_id = ?
                                )
                                OR
                                (
                                    requester_id = ?
                                    AND receiver_id = ?
                                )
                            `).get(

                                currentUser.id,
                                targetId,

                                targetId,
                                currentUser.id

                            );


                        if (existing) {

                            return;
                        }


                        db.prepare(`
                            INSERT INTO friendships
                            (
                                requester_id,
                                receiver_id,
                                status,
                                created_at
                            )
                            VALUES (?, ?, 'pending', ?)
                        `).run(

                            currentUser.id,

                            targetId,

                            Date.now()

                        );


                        const targetOnline =
                            onlineUsers.get(
                                targetId
                            );


                        if (targetOnline) {

                            send(
                                targetOnline.socket,
                                {
                                    type:
                                        "friend_requests",

                                    requests:
                                        getFriendRequests(
                                            targetId
                                        )
                                }
                            );

                        }


                        return;
                    }


                    /* =========================
                       ACCEPT FRIEND
                    ========================= */

                    if (
                        data.type ===
                        "friend_accept"
                    ) {

                        const requesterId =
                            String(
                                data.userId ||
                                ""
                            );


                        db.prepare(`
                            UPDATE friendships
                            SET status = 'accepted'
                            WHERE
                                requester_id = ?
                                AND receiver_id = ?
                                AND status = 'pending'
                        `).run(

                            requesterId,

                            currentUser.id

                        );


                        sendFriends(
                            socket,
                            currentUser.id
                        );


                        const requesterOnline =
                            onlineUsers.get(
                                requesterId
                            );


                        if (requesterOnline) {

                            sendFriends(
                                requesterOnline.socket,
                                requesterId
                            );

                        }


                        return;
                    }


                    /* =========================
                       DECLINE
                    ========================= */

                    if (
                        data.type ===
                        "friend_decline"
                    ) {

                        db.prepare(`
                            DELETE FROM friendships
                            WHERE
                                requester_id = ?
                                AND receiver_id = ?
                                AND status = 'pending'
                        `).run(

                            String(
                                data.userId
                            ),

                            currentUser.id

                        );


                        sendFriends(
                            socket,
                            currentUser.id
                        );


                        return;
                    }


                    /* =========================
                       REMOVE FRIEND
                    ========================= */

                    if (
                        data.type ===
                        "friend_remove"
                    ) {

                        const targetId =
                            String(
                                data.userId
                            );


                        db.prepare(`
                            DELETE FROM friendships
                            WHERE
                            (
                                requester_id = ?
                                AND receiver_id = ?
                            )
                            OR
                            (
                                requester_id = ?
                                AND receiver_id = ?
                            )
                        `).run(

                            currentUser.id,
                            targetId,

                            targetId,
                            currentUser.id

                        );


                        sendFriends(
                            socket,
                            currentUser.id
                        );


                        const targetOnline =
                            onlineUsers.get(
                                targetId
                            );


                        if (targetOnline) {

                            sendFriends(
                                targetOnline.socket,
                                targetId
                            );

                        }


                        return;
                    }


                    /* =========================
                       MESSAGE
                    ========================= */

                    if (
                        data.type ===
                        "message"
                    ) {

                        const content =
                            String(
                                data.content ||
                                ""
                            ).trim();


                        if (
                            !content ||
                            content.length >
                                MAX_MESSAGE_LENGTH
                        ) {

                            return;
                        }


                        db.prepare(`
                            INSERT INTO messages
                            (
                                user_id,
                                username,
                                avatar,
                                content,
                                timestamp
                            )
                            VALUES (?, ?, ?, ?, ?)
                        `).run(

                            currentUser.id,

                            currentUser.username,

                            currentUser.avatar ||
                                null,

                            content,

                            Date.now()

                        );


                        const message = {

                            username:
                                currentUser.username,

                            avatar:
                                currentUser.avatar ||
                                null,

                            content,

                            timestamp:
                                Date.now()

                        };


                        broadcast({

                            type:
                                "message",

                            message

                        });


                        db.prepare(`
                            DELETE FROM messages
                            WHERE id NOT IN
                            (
                                SELECT id
                                FROM messages
                                ORDER BY id DESC
                                LIMIT ?
                            )
                        `).run(
                            MAX_HISTORY
                        );


                        return;
                    }


                    /* =========================
                       USERNAME CHANGE REQUEST
                    ========================= */

                    if (
                        data.type ===
                        "request_username_change"
                    ) {

                        const newUsername =
                            String(
                                data.username ||
                                ""
                            ).trim();


                        if (
                            !isValidUsername(
                                newUsername
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid username."
                                }
                            );

                            return;
                        }


                        if (
                            getUserByUsername(
                                newUsername
                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "That username is already taken."
                                }
                            );

                            return;
                        }


                        const code =
                            createCode(

                                currentUser.id,

                                "username_change",

                                newUsername

                            );


                        await sendCode(

                            currentUser.email,

                            code,

                            "Confirm your Butterfly username change",

                            "username change"

                        );


                        send(
                            socket,
                            {
                                type:
                                    "settings_success",

                                message:
                                    "A confirmation code was sent to your email."
                            }
                        );


                        return;
                    }


                    /* =========================
                       CONFIRM USERNAME CHANGE
                    ========================= */

                    if (
                        data.type ===
                        "confirm_username_change"
                    ) {

                        const result =
                            consumeCode(

                                currentUser.id,

                                "username_change",

                                String(
                                    data.code ||
                                    ""
                                )

                            );


                        if (!result) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid or expired code."
                                }
                            );

                            return;
                        }


                        const newUsername =
                            result.payload;


                        if (
                            getUserByUsername(
                                newUsername
                            )
                        ) {

                            return;
                        }


                        db.prepare(`
                            UPDATE users
                            SET username = ?
                            WHERE id = ?
                        `).run(

                            newUsername,

                            currentUser.id

                        );


                        currentUser =
                            getUserById(
                                currentUser.id
                            );


                        send(
                            socket,
                            {
                                type:
                                    "profile_updated",

                                user:
                                    publicUser(
                                        currentUser
                                    )
                            }
                        );


                        return;
                    }


                    /* =========================
                       CHANGE PASSWORD
                    ========================= */

                    if (
                        data.type ===
                        "change_password"
                    ) {

                        if (
                            !verifyPassword(

                                String(
                                    data.currentPassword ||
                                    ""
                                ),

                                currentUser.password_salt,

                                currentUser.password_hash

                            )
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Current password is incorrect."
                                }
                            );

                            return;
                        }


                        const newPassword =
                            String(
                                data.newPassword ||
                                ""
                            );


                        if (
                            newPassword.length <
                            8
                        ) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "New password must contain at least 8 characters."
                                }
                            );

                            return;
                        }


                        const passwordData =
                            hashPassword(
                                newPassword
                            );


                        db.prepare(`
                            UPDATE users
                            SET
                                password_salt = ?,
                                password_hash = ?
                            WHERE id = ?
                        `).run(

                            passwordData.salt,

                            passwordData.hash,

                            currentUser.id

                        );


                        send(
                            socket,
                            {
                                type:
                                    "settings_success",

                                message:
                                    "Password changed."
                            }
                        );


                        return;
                    }


                    /* =========================
                       PASSWORD RECOVERY
                    ========================= */

                    if (
                        data.type ===
                        "request_password_reset"
                    ) {

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim()
                            .toLowerCase();


                        const user =
                            getUserByEmail(
                                email
                            );


                        if (user) {

                            const code =
                                createCode(

                                    user.id,

                                    "password_reset"

                                );


                            await sendCode(

                                user.email,

                                code,

                                "Reset your Butterfly password",

                                "password reset"

                            );

                        }


                        return;
                    }


                    if (
                        data.type ===
                        "reset_password"
                    ) {

                        const email =
                            String(
                                data.email ||
                                ""
                            ).trim()
                            .toLowerCase();


                        const user =
                            getUserByEmail(
                                email
                            );


                        if (!user) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid or expired recovery code."
                                }
                            );

                            return;
                        }


                        const result =
                            consumeCode(

                                user.id,

                                "password_reset",

                                String(
                                    data.code ||
                                    ""
                                )

                            );


                        if (!result) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid or expired recovery code."
                                }
                            );

                            return;
                        }


                        const newPassword =
                            String(
                                data.password ||
                                ""
                            );


                        if (
                            newPassword.length <
                            8
                        ) {

                            return;
                        }


                        const passwordData =
                            hashPassword(
                                newPassword
                            );


                        db.prepare(`
                            UPDATE users
                            SET
                                password_salt = ?,
                                password_hash = ?
                            WHERE id = ?
                        `).run(

                            passwordData.salt,

                            passwordData.hash,

                            user.id

                        );


                        deleteAllSessions(
                            db,
                            user.id
                        );


                        send(
                            socket,
                            {
                                type:
                                    "settings_success",

                                message:
                                    "Password reset successfully. Please log in again."
                            }
                        );


                        return;
                    }


                    /* =========================
                       ACCOUNT DELETION REQUEST
                    ========================= */

                    if (
                        data.type ===
                        "request_account_deletion"
                    ) {

                        const code =
                            createCode(

                                currentUser.id,

                                "account_deletion"

                            );


                        await sendCode(

                            currentUser.email,

                            code,

                            "Confirm your Butterfly account deletion",

                            "account deletion"

                        );


                        send(
                            socket,
                            {
                                type:
                                    "settings_success",

                                message:
                                    "A deletion confirmation code was sent to your email."
                            }
                        );


                        return;
                    }


                    /* =========================
                       CONFIRM ACCOUNT DELETION
                    ========================= */

                    if (
                        data.type ===
                        "confirm_account_deletion"
                    ) {

                        const result =
                            consumeCode(

                                currentUser.id,

                                "account_deletion",

                                String(
                                    data.code ||
                                    ""
                                )

                            );


                        if (!result) {

                            send(
                                socket,
                                {
                                    type:
                                        "error",

                                    message:
                                        "Invalid or expired code."
                                }
                            );

                            return;
                        }


                        deleteAllSessions(
                            db,
                            currentUser.id
                        );


                        db.prepare(`
                            DELETE FROM users
                            WHERE id = ?
                        `).run(
                            currentUser.id
                        );


                        onlineUsers.delete(
                            currentUser.id
                        );


                        currentUser = null;


                        send(
                            socket,
                            {
                                type:
                                    "account_deleted"
                            }
                        );


                        broadcastUsers();

                        return;
                    }


                    /* =========================
                       LOGOUT
                    ========================= */

                    if (
                        data.type ===
                        "logout"
                    ) {

                        deleteSession(
                            db,
                            currentToken
                        );


                        onlineUsers.delete(
                            currentUser.id
                        );


                        currentUser = null;

                        currentToken = null;


                        send(
                            socket,
                            {
                                type:
                                    "logout_success"
                            }
                        );


                        broadcastUsers();

                        return;
                    }

                } catch (error) {

                    console.error(
                        "Butterfly request error:",
                        error
                    );


                    send(
                        socket,
                        {
                            type:
                                "error",

                            message:
                                "Server error."
                        }
                    );

                }

            }
        );


        /* =====================================
           DISCONNECT
        ===================================== */

        socket.on(
            "close",
            () => {

                if (
                    currentUser
                ) {

                    const online =
                        onlineUsers.get(
                            currentUser.id
                        );


                    if (
                        online &&
                        online.socket ===
                            socket
                    ) {

                        onlineUsers.delete(
                            currentUser.id
                        );


                        broadcast({

                            type:
                                "system",

                            message:
                                `${currentUser.username} left Butterfly.`

                        });


                        broadcastUsers();

                    }

                }

            }
        );

    }
);


console.log(
    `🦋 Butterfly server running on ws://localhost:${PORT}`
);