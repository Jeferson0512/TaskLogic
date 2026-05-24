const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const Database = require("better-sqlite3");

let db = null;

function getDatabasePath() {
    const userData = app.getPath("userData");
    return path.join(userData, "tasklogic.sqlite");
}

function getSchemaPath() {
    return path.join(__dirname, "../../database/schema.sql");
}

function initDatabase() {
    const dbPath = getDatabasePath();
    db = new Database(dbPath);

    db.pragma("foreign_keys = ON");

    const schema = fs.readFileSync(getSchemaPath(), "utf8");
    db.exec(schema);

    return db;
}

function getDb() {
    if (!db) return initDatabase();
    return db;
}

module.exports = {
    initDatabase,
    getDb,
};