require("dotenv").config();
const { REST, Routes } = require("discord.js");
const commands = require("./commands");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong .env");
  process.exit(1);
}
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    await rest.put(route, { body: commands.map(c => c.toJSON()) });
    console.log(`Đã đăng ký ${commands.length} slash commands ${GUILD_ID ? "cho server test" : "toàn cục"}.`);
  } catch (error) {
    console.error("Không đăng ký được lệnh:", error);
    process.exitCode = 1;
  }
})();
