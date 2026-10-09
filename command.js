require("dotenv").config();
const {
  REST, Routes, SlashCommandBuilder, PermissionFlagsBits
} = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ bot"),
  new SlashCommandBuilder().setName("help").setDescription("Danh sách lệnh BeenStore"),
  new SlashCommandBuilder().setName("server").setDescription("Thông tin server"),
  new SlashCommandBuilder().setName("userinfo").setDescription("Thông tin thành viên")
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần xem")),
  new SlashCommandBuilder().setName("kick").setDescription("Kick thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("ban").setDescription("Ban thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Số phút (1-40320)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("clear").setDescription("Xóa 1-100 tin nhắn")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("Số tin nhắn").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("ticket").setDescription("Gửi bảng tạo ticket hỗ trợ"),
  new SlashCommandBuilder().setName("rank").setDescription("Xem XP và level")
    .addUserOption(o => o.setName("user").setDescription("Thành viên")),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Bảng xếp hạng")
    .addStringOption(o => o.setName("type").setDescription("Xếp hạng theo").addChoices(
      {name:"XP",value:"xp"},{name:"Coin",value:"coins"}
    )),
  new SlashCommandBuilder().setName("balance").setDescription("Xem số dư coin")
    .addUserOption(o => o.setName("user").setDescription("Thành viên")),
  new SlashCommandBuilder().setName("daily").setDescription("Điểm danh nhận coin và thưởng chuỗi ngày"),
  new SlashCommandBuilder().setName("work").setDescription("Chọn công việc để kiếm coin")
    .addStringOption(o => o.setName("job").setDescription("Công việc muốn làm").setRequired(true).addChoices(
      { name: "Rửa bát — 150 coin", value: "dishwashing" },
      { name: "Livestream — 250 coin", value: "livestream" },
      { name: "Lập trình — 300 coin", value: "programming" }
    )),
  new SlashCommandBuilder().setName("pay").setDescription("Chuyển coin cho thành viên")
    .addUserOption(o => o.setName("user").setDescription("Người nhận").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Số coin").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("shop").setDescription("Xem cửa hàng coin"),
  new SlashCommandBuilder().setName("buy").setDescription("Mua vật phẩm trong shop")
    .addStringOption(o => o.setName("item").setDescription("Vật phẩm").setRequired(true)
      .addChoices({name:"VIP màu xanh - 500 coin",value:"vipblue"},{name:"Huy hiệu BeenStore - 250 coin",value:"badge"})),
  new SlashCommandBuilder().setName("ask").setDescription("Trò chuyện với AI")
    .addStringOption(o => o.setName("question").setDescription("Câu hỏi cho AI").setRequired(true).setMaxLength(1500))
].map(c => c.toJSON());

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error("Thiếu DISCORD_TOKEN hoặc CLIENT_ID trong Railway Variables.");
  }
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Đã đăng ký ${commands.length} slash commands.`);
}
main().catch(err => {
  console.error("Đăng ký slash command thất bại:", err);
  process.exit(1);
});