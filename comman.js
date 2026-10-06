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
      opt.setName('kenh').setDescription('Kênh chơi nối từ').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder().setName('noitustart').setDescription('Bắt đầu ván nối từ 🎉'),
  new SlashCommandBuilder().setName('noituend').setDescription('Kết thúc ván nối từ 🏁'),

  // ===== ĐỀ XUẤT =====
  new SlashCommandBuilder()
    .setName('dexuat')
    .setDescription('Đề xuất cụm mới cho từ điển 📥')
    .addStringOption(opt =>
      opt.setName('cum').setDescription('Cụm 2 tiếng (VD: hoa hồng)').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setkenhdexuat')
    .setDescription('Chọn kênh nhận đề xuất 📥')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('kenh').setDescription('Kênh nhận đề xuất').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName('duyet')
    .setDescription('Duyệt cụm đang chờ ✅')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('dsduyet')
    .setDescription('Xem danh sách chờ duyệt 📋')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ===== QUẢN LÝ TỪ ĐIỂN =====
  new SlashCommandBuilder()
    .setName('themtudien')
    .setDescription('Quản lý từ điển 📚')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('xoa').setDescription('Xóa 1 cụm')
        .addStringOption(opt => opt.setName('cum').setDescription('Cụm cần xóa').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('tim').setDescription('Tìm cụm')
        .addStringOption(opt => opt.setName('tukhoa').setDescription('Từ khóa').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('thongke').setDescription('Xem thống kê')
    ),

  // ===== TICKET =====
  new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Cài đặt hệ thống ticket 🎫')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('category').setDescription('Category chứa ticket').setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addChannelOption(opt =>
      opt.setName('logchannel').setDescription('Kênh log ticket').setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Gửi panel ticket với nút Tạo Ticket 🎫')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('tieude').setDescription('Tiêu đề panel').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('mota').setDescription('Mô tả trong panel').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('anh').setDescription('Link ảnh banner').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Đóng ticket hiện tại 🔒')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // ===== CƠ BẢN =====
  new SlashCommandBuilder().setName('help').setDescription('Xem danh sách lệnh'),
  new SlashCommandBuilder().setName('ping').setDescription('Kiểm tra ping'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Đang đăng ký slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Đăng ký slash commands THÀNH CÔNG!');
  } catch (error) { console.error('❌ Lỗi:', error); }
})();
