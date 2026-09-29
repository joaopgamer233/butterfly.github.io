"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDirectory = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const dbPath = path.join(dataDirectory, "butterfly.db");
const db = new DatabaseSync(dbPath);

db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        email TEXT COLLATE NOCASE UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified INTEGER NOT NULL DEFAULT 0,
        avatar TEXT,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        payload TEXT,
        expires_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(requester_id, receiver_id),
        FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        avatar TEXT,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

function columns(table) {
    return db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
}

// Migration for older Butterfly databases.
// This prevents the previous "no such column: email" crash.
const userColumns = columns("users");

if (!userColumns.includes("email")) {
    db.exec(`ALTER TABLE users ADD COLUMN email TEXT`);
}

if (!userColumns.includes("email_verified")) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
}

if (!userColumns.includes("avatar")) {
    db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
}

function getUserById(id) {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

function getUserByEmail(email) {
    return db.prepare(`
        SELECT * FROM users WHERE email = ? COLLATE NOCASE
    `).get(email);
}

function getUserByUsername(username) {
    return db.prepare(`
        SELECT * FROM users WHERE username = ? COLLATE NOCASE
    `).get(username);
}

module.exports = {
    db,
    getUserById,
    getUserByEmail,
    getUserByUsername
};
