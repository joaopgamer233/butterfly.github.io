"use strict";

const crypto = require("crypto");

const SESSION_TIME = 1000 * 60 * 60 * 24 * 30;

function randomId() {
    return crypto.randomBytes(16).toString("hex");
}

function randomCode() {
    return String(crypto.randomInt(100000, 1000000));
}

function randomToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hash(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    return {
        salt,
        hash: crypto.scryptSync(password, salt, 64).toString("hex")
    };
}

function verifyPassword(password, salt, expected) {
    try {
        const actual = crypto.scryptSync(password, salt, 64).toString("hex");
        const a = Buffer.from(actual, "hex");
        const b = Buffer.from(expected, "hex");
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function createSession(db, userId) {
    const token = randomToken();
    const now = Date.now();

    db.prepare(`
        INSERT INTO sessions
        (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(hash(token), userId, now, now + SESSION_TIME);

    return token;
}

function getUserFromSession(db, token) {
    if (!token) return null;

    const tokenHash = hash(token);
    const session = db.prepare(`
        SELECT * FROM sessions WHERE token_hash = ?
    `).get(tokenHash);

    if (!session) return null;

    if (session.expires_at <= Date.now()) {
        deleteSession(db, token);
        return null;
    }

    return db.prepare(`
        SELECT * FROM users WHERE id = ?
    `).get(session.user_id);
}

function deleteSession(db, token) {
    if (!token) return;
    db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hash(token));
}

function deleteAllSessions(db, userId) {
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

module.exports = {
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
};
