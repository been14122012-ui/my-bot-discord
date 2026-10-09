const {
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Kiểm tra độ trễ của bot"),
  new SlashCommandBuilder().setName("help").setDescription("Xem danh sách lệnh"),
  new SlashCommandBuilder().setName("server").setDescription("Xem thông tin server"),
  new SlashCommandBuilder().setName("userinfo").setDescription("Xem thông tin thành viên")
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần xem")),
  new SlashCommandBuilder().setName("kick").setDescription("Kick thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("ban").setDescription("Ban thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout thành viên")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần timeout").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Số phút (1-40320)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Lý do")),
  new SlashCommandBuilder().setName("clear").setDescription("Xóa tối đa 100 tin nhắn gần đây")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("Số tin nhắn (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("ticket").setDescription("Mở ticket hỗ trợ riêng tư"),
  new SlashCommandBuilder().setName("rank").setDescription("Xem cấp độ và XP")
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần xem")),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Bảng xếp hạng")
    .addStringOption(o => o.setName("type").setDescription("Loại bảng xếp hạng").addChoices(
      { name: "XP / Level", value: "xp" }, { name: "Tiền ảo", value: "coins" }
    )),
  new SlashCommandBuilder().setName("balance").setDescription("Xem số dư tiền ảo")
    .addUserOption(o => o.setName("user").setDescription("Thành viên cần xem")),
  new SlashCommandBuilder().setName("daily").setDescription("Nhận tiền thưởng hằng ngày"),
  new SlashCommandBuilder().setName("work").setDescription("Làm việc để kiếm tiền ảo"),
  new SlashCommandBuilder().setName("pay").setDescription("Chuyển tiền ảo cho thành viên")
    .addUserOption(o => o.setName("user").setDescription("Người nhận").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Số tiền").setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName("ask").setDescription("Hỏi AI")
    .addStringOption(o => o.setName("question").setDescription("Câu hỏi (tối đa 1000 ký tự)").setRequired(true).setMaxLength(1000))
];

module.exports = commands;
