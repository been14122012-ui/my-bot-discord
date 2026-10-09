const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "bot.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  last_xp_at INTEGER NOT NULL DEFAULT 0,
  last_daily_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS tickets (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  opened_at INTEGER NOT NULL
);
`);

const ensureUser = db.prepare(`
  INSERT INTO users (guild_id, user_id) VALUES (?, ?)
  ON CONFLICT(guild_id, user_id) DO NOTHING
`);
const getUser = db.prepare("SELECT * FROM users WHERE guild_id = ? AND user_id = ?");
const updateXP = db.prepare("UPDATE users SET xp = ?, level = ?, last_xp_at = ? WHERE guild_id = ? AND user_id = ?");
const updateCoins = db.prepare("UPDATE users SET coins = ? WHERE guild_id = ? AND user_id = ?");
const setDaily = db.prepare("UPDATE users SET coins = ?, last_daily_at = ? WHERE guild_id = ? AND user_id = ?");
const leaderboardXP = db.prepare("SELECT user_id, xp, level FROM users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10");
const leaderboardCoins = db.prepare("SELECT user_id, coins FROM users WHERE guild_id = ? ORDER BY coins DESC LIMIT 10");
const insertTicket = db.prepare("INSERT INTO tickets (channel_id, guild_id, user_id, opened_at) VALUES (?, ?, ?, ?)");
const getTicket = db.prepare("SELECT * FROM tickets WHERE channel_id = ?");
const deleteTicket = db.prepare("DELETE FROM tickets WHERE channel_id = ?");

function user(guildId, userId) {
  ensureUser.run(guildId, userId);
  return getUser.get(guildId, userId);
}
function saveXP(row, xp, level, now) {
  updateXP.run(xp, level, now, row.guild_id, row.user_id);
}
function coins(guildId, userId, amount) {
  const row = user(guildId, userId);
  const next = row.coins + amount;
  if (next < 0) throw new Error("INSUFFICIENT_FUNDS");
  updateCoins.run(next, guildId, userId);
  return next;
}
function claimDaily(guildId, userId, amount, now) {
  const row = user(guildId, userId);
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - row.last_daily_at < dayMs) return { ok: false, nextAt: row.last_daily_at + dayMs };
  setDaily.run(row.coins + amount, now, guildId, userId);
  return { ok: true, balance: row.coins + amount };
}

module.exports = {
  db, user, saveXP, coins, claimDaily, leaderboardXP, leaderboardCoins,
  insertTicket, getTicket, deleteTicket
};
