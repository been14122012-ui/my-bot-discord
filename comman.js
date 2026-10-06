require('dotenv').config();
const {
  REST, Routes, SlashCommandBuilder,
  PermissionFlagsBits, ChannelType,
} = require('discord.js');

const commands = [
  // ===== NỐI TỪ =====
  new SlashCommandBuilder()
    .setName('noitusetup')
    .setDescription('Cài đặt kênh chơi nối từ (1 lần) 🔗')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('kenh')
        .setDescription('Kênh chơi nối từ')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName('noitustart')
    .setDescription('Bắt đầu ván nối từ 🎉'),

  new SlashCommandBuilder()
    .setName('noituend')
    .setDescription('Kết thúc ván nối từ 🏁'),

  // ===== ĐỀ XUẤT (MỌI NGƯỜI) =====
  new SlashCommandBuilder()
    .setName('dexuat')
    .setDescription('Đề xuất cụm mới cho từ điển 📥')
    .addStringOption(opt =>
      opt.setName('cum')
        .setDescription('Cụm 2 tiếng (VD: hoa hồng)')
        .setRequired(true)
    ),

  // ===== KÊNH NHẬN ĐỀ XUẤT (ADMIN) =====
  new SlashCommandBuilder()
    .setName('setkenhdexuat')
    .setDescription('Chọn kênh nhận đề xuất 📥')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('kenh')
        .setDescription('Kênh nhận đề xuất từ user')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  // ===== DUYỆT (ADMIN) =====
  new SlashCommandBuilder()
    .setName('duyet')
    .setDescription('Duyệt cụm đang chờ ✅')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('dsduyet')
    .setDescription('Xem danh sách cụm đang chờ duyệt 📋')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ===== QUẢN LÝ TỪ ĐIỂN (ADMIN) =====
  new SlashCommandBuilder()
    .setName('themtudien')
    .setDescription('Quản lý từ điển 📚')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('xoa')
        .setDescription('Xóa 1 cụm')
        .addStringOption(opt =>
          opt.setName('cum')
            .setDescription('Cụm cần xóa')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('tim')
        .setDescription('Tìm cụm')
        .addStringOption(opt =>
          opt.setName('tukhoa')
            .setDescription('Từ khóa')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('thongke')
        .setDescription('Xem thống kê')
    ),

  // ===== CƠ BẢN =====
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Xem danh sách lệnh'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Kiểm tra ping'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Đang đăng ký slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Đăng ký slash commands THÀNH CÔNG!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
})();
