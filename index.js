// ===== KEEP ALIVE SERVER (giữ bot 24/7) =====
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('✅ Bot đang chạy!');
});

app.listen(3000, () => {
  console.log('🌐 Keep-alive server đang chạy ở port 3000');
});

// ===== BOT DISCORD =====
const fs = require('fs');
const {
  Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===== FILE PATHS =====
const FILE_TU_DIEN = './tudien.json';
const FILE_SETUP = './setup.json';
const FILE_CHO_DUYET = './choduyet.json';

// ===== ĐỌC TỪ ĐIỂN =====
let TU_DIEN = [];

function docTuDien() {
  try {
    const data = fs.readFileSync(FILE_TU_DIEN, 'utf8');
    TU_DIEN = JSON.parse(data).cum || [];
    console.log(`📖 Đã tải ${TU_DIEN.length} cụm từ từ điển`);
  } catch (err) {
    console.log('⚠️ Không đọc được tudien.json:', err.message);
    TU_DIEN = [];
  }
}

function luuTuDien() {
  try {
    fs.writeFileSync(FILE_TU_DIEN, JSON.stringify({ cum: TU_DIEN }, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ Lỗi lưu từ điển:', err.message);
    return false;
  }
}

function cumCoTrongTuDien(cumTu) {
  if (TU_DIEN.length === 0) return true;
  const cumChuan = cumTu.toLowerCase().trim().replace(/\s+/g, ' ');
  return TU_DIEN.some(c => c.toLowerCase().trim().replace(/\s+/g, ' ') === cumChuan);
}

docTuDien();

// ===== ĐỌC HÀNG CHỜ DUYỆT =====
let CHO_DUYET = [];

function docChoDuyet() {
  try {
    const data = fs.readFileSync(FILE_CHO_DUYET, 'utf8');
    CHO_DUYET = JSON.parse(data) || [];
    console.log(`⏳ Đang chờ duyệt: ${CHO_DUYET.length} cụm`);
  } catch (err) {
    CHO_DUYET = [];
  }
}

function luuChoDuyet() {
  try {
    fs.writeFileSync(FILE_CHO_DUYET, JSON.stringify(CHO_DUYET, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ Lỗi lưu hàng chờ:', err.message);
    return false;
  }
}

docChoDuyet();

// ===== ĐỌC SETUP =====
let SETUP = {};

function docSetup() {
  try {
    const data = fs.readFileSync(FILE_SETUP, 'utf8');
    SETUP = JSON.parse(data) || {};
    for (const gid in SETUP) {
      if (typeof SETUP[gid] === 'string') {
        SETUP[gid] = { channelId: SETUP[gid], dexuatChannelId: null };
      }
    }
    console.log(`⚙️ Đã tải setup của ${Object.keys(SETUP).length} server`);
  } catch (err) {
    SETUP = {};
  }
}

function luuSetup() {
  try {
    fs.writeFileSync(FILE_SETUP, JSON.stringify(SETUP, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ Lỗi lưu setup:', err.message);
    return false;
  }
}

docSetup();

// ===== LƯU VÁN ĐANG CHƠI =====
const gameNoiTu = {};

// ===== HÀM HỖ TRỢ =====
function layTiengCuoi(cumTu) {
  const cacTieng = cumTu.trim().split(/\s+/);
  return cacTieng[cacTieng.length - 1];
}

function layTiengDau(cumTu) {
  const cacTieng = cumTu.trim().split(/\s+/);
  return cacTieng[0];
}

function taoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== READY =====
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot online: ${c.user.tag}`);
  console.log(`📖 Từ điển: ${TU_DIEN.length} cụm`);
  console.log(`⏳ Chờ duyệt: ${CHO_DUYET.length} cụm`);
  console.log(`⚙️ Setup: ${Object.keys(SETUP).length} server`);
});

// ===== LẮNG NGHE TIN NHẮN =====
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const gid = message.guild.id;
  const game = gameNoiTu[gid];
  if (!game || !game.batDau) return;

  const cfg = SETUP[gid];
  if (!cfg || !cfg.channelId) return;
  if (message.channel.id !== cfg.channelId) return;

  const noiDung = message.content.trim();

  if (noiDung.startsWith('/')) return;
  if (noiDung.startsWith('http') || noiDung.startsWith('<')) return;

  // CHECK 1: ≥ 2 tiếng
  if (noiDung.split(/\s+/).length < 2) {
    try {
      await message.react('❌');
      const warn = await message.reply(`❌ **Sai luật!** Phải là **cụm 2 tiếng trở lên** (VD: \`ngôi nhà\`).`);
      setTimeout(() => warn.delete().catch(() => {}), 5000);
    } catch (e) {}
    return;
  }

  // CHECK 2: Có trong từ điển
  if (!cumCoTrongTuDien(noiDung)) {
    try {
      await message.react('📖');
      const warn = await message.reply(
        `📖 Cụm **"${noiDung}"** không có trong từ điển!\n` +
        `👉 Đề xuất bằng \`/dexuat cum: ${noiDung}\` để admin duyệt.`
      );
      setTimeout(() => warn.delete().catch(() => {}), 8000);
    } catch (e) {}
    return;
  }

  // CHECK 3: Khớp tiếng
  const tiengCuoiTruoc = layTiengCuoi(game.tuCuoi).toLowerCase();
  const tiengDauMoi = layTiengDau(noiDung).toLowerCase();

  if (tiengDauMoi !== tiengCuoiTruoc) {
    try {
      await message.react('❌');
      const warn = await message.reply(
        `❌ **Nối sai!** Từ trước **${game.tuCuoi}** → tiếng cuối **"${tiengCuoiTruoc}"**.\n` +
        `👉 Phải bắt đầu bằng **"${tiengCuoiTruoc}"**.`
      );
      setTimeout(() => warn.delete().catch(() => {}), 7000);
    } catch (e) {}
    return;
  }

  // CHECK 4: Không trùng
  const daDung = game.lichSuTu.map(t => t.toLowerCase());
  if (daDung.includes(noiDung.toLowerCase())) {
    try {
      await message.react('🔁');
      const warn = await message.reply(`🔁 Cụm **"${noiDung}"** đã dùng rồi!`);
      setTimeout(() => warn.delete().catch(() => {}), 5000);
    } catch (e) {}
    return;
  }

  // HỢP LỆ
  game.tuCuoi = noiDung;
  game.lichSuTu.push(noiDung);

  try { await message.react('✅'); } catch (e) {}

  const tiengCuoiMoi = layTiengCuoi(noiDung);
  const soTu = game.lichSuTu.length;

  try {
    const thongBao = await message.reply(
      `✅ **Hợp lệ!** Cụm: **${noiDung}**\n` +
      `👉 Tiếp theo bắt đầu bằng **"${tiengCuoiMoi}"**\n` +
      `📊 Đã nối: **${soTu}** cụm`
    );
    setTimeout(() => thongBao.delete().catch(() => {}), 8000);
  } catch (e) {}
});

// ===== SLASH COMMANDS =====
client.on(Events.InteractionCreate, async (interaction) => {

  // ===== XỬ LÝ NÚT BẤM =====
  if (interaction.isButton()) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Chỉ Admin mới bấm được nút này.', ephemeral: true });
    }

    const [action, id] = interaction.customId.split(':');
    const index = CHO_DUYET.findIndex(x => x.id === id);

    if (index === -1) {
      return interaction.reply({ content: '⚠️ Cụm này đã được xử lý.', ephemeral: true });
    }

    const item = CHO_DUYET[index];

    // === DUYỆT ===
    if (action === 'duyet') {
      if (cumCoTrongTuDien(item.cum)) {
        CHO_DUYET.splice(index, 1);
        luuChoDuyet();
        return interaction.update({
          content: `⚠️ Cụm **"${item.cum}"** đã có trong từ điển (bỏ qua).`,
          embeds: [], components: []
        });
      }

      TU_DIEN.push(item.cum);
      luuTuDien();
      CHO_DUYET.splice(index, 1);
      luuChoDuyet();

      try {
        const nguoiGui = await client.users.fetch(item.nguoiGuiId);
        await nguoiGui.send(`✅ Cụm **"${item.cum}"** bạn đề xuất đã được **DUYỆT**!`).catch(() => {});
      } catch (e) {}

      return interaction.update({
        content: `✅ Đã **DUYỆT** cụm **"${item.cum}"** (do <@${item.nguoiGuiId}> đề xuất).\n📖 Từ điển: **${TU_DIEN.length}** cụm.`,
        embeds: [], components: []
      });
    }

    // === TỪ CHỐI ===
    if (action === 'tuchoi') {
      CHO_DUYET.splice(index, 1);
      luuChoDuyet();

      try {
        const nguoiGui = await client.users.fetch(item.nguoiGuiId);
        await nguoiGui.send(`❌ Cụm **"${item.cum}"** bạn đề xuất đã bị **TỪ CHỐI**.`).catch(() => {});
      } catch (e) {}

      return interaction.update({
        content: `❌ Đã **TỪ CHỐI** cụm **"${item.cum}"**.`,
        embeds: [], components: []
      });
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const gid = interaction.guild?.id;

  // ===== /setkenhdexuat =====
  if (interaction.commandName === 'setkenhdexuat') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Cần quyền **Administrator**.', ephemeral: true });
    }

    const kenh = interaction.options.getChannel('kenh');

    if (!SETUP[gid]) SETUP[gid] = { channelId: null, dexuatChannelId: null };
    SETUP[gid].dexuatChannelId = kenh.id;
    const ok = luuSetup();

    if (!ok) return interaction.reply({ content: '❌ Lỗi lưu setup!', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ ĐÃ ĐẶT KÊNH NHẬN ĐỀ XUẤT')
      .addFields(
        { name: '📥 Kênh đề xuất', value: `<#${kenh.id}>` }
      )
      .setDescription(
        '✅ Từ giờ khi user gõ `/dexuat`, bot sẽ gửi đề xuất vào kênh này.\n' +
        '👉 Admin xem kênh này để duyệt.'
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== /dexuat =====
  if (interaction.commandName === 'dexuat') {
    const cumRaw = interaction.options.getString('cum');
    const cum = cumRaw.trim().toLowerCase().replace(/\s+/g, ' ');

    const cfg = SETUP[gid];
    if (!cfg || !cfg.dexuatChannelId) {
      return interaction.reply({
        content: '❌ Admin chưa cài kênh nhận đề xuất! Nhờ admin dùng `/setkenhdexuat` trước.',
        ephemeral: true
      });
    }

    if (cum.split(/\s+/).length < 2) {
      return interaction.reply({ content: '❌ Cụm phải có **ít nhất 2 tiếng** (VD: `nhà cửa`).', ephemeral: true });
    }

    if (cumCoTrongTuDien(cum)) {
      return interaction.reply({ content: `⚠️ Cụm **"${cum}"** đã có trong từ điển rồi!`, ephemeral: true });
    }

    if (CHO_DUYET.some(x => x.cum === cum)) {
      return interaction.reply({ content: `⏳ Cụm **"${cum}"** đã được ai đó đề xuất và đang chờ duyệt!`, ephemeral: true });
    }

    const item = {
      id: taoId(),
      cum,
      nguoiGui: interaction.user.tag,
      nguoiGuiId: interaction.user.id,
      guildId: gid,
      thoiGian: Date.now(),
    };
    CHO_DUYET.push(item);
    luuChoDuyet();

    const kenhDeXuat = await interaction.guild.channels.fetch(cfg.dexuatChannelId).catch(() => null);

    if (!kenhDeXuat) {
      return interaction.reply({
        content: '❌ Không tìm thấy kênh đề xuất! Nhờ admin setup lại `/setkenhdexuat`.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('📥 ĐỀ XUẤT CỤM MỚI')
      .addFields(
        { name: '📝 Cụm', value: `**${cum}**` },
        { name: '👤 Người đề xuất', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)` },
        { name: '🕐 Thời gian', value: `<t:${Math.floor(item.thoiGian / 1000)}:R>` }
      )
      .setFooter({ text: `ID: ${item.id} • Admin nhấn nút bên dưới để duyệt` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`duyet:${item.id}`)
        .setLabel('✅ Duyệt')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tuchoi:${item.id}`)
        .setLabel('❌ Từ chối')
        .setStyle(ButtonStyle.Danger),
    );

    try {
      await kenhDeXuat.send({ embeds: [embed], components: [row] });

      return interaction.reply({
        content: `✅ Đã gửi đề xuất cụm **"${cum}"** vào <#${kenhDeXuat.id}> để admin duyệt!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Lỗi gửi kênh đề xuất:', err.message);
      CHO_DUYET.pop();
      luuChoDuyet();
      return interaction.reply({
        content: '❌ Không gửi được vào kênh đề xuất! Bot có thể thiếu quyền.',
        ephemeral: true
      });
    }
  }

  // ===== /duyet =====
  if (interaction.commandName === 'duyet') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Chỉ Admin dùng được.', ephemeral: true });
    }

    const dsCho = CHO_DUYET.filter(x => x.guildId === gid);

    if (dsCho.length === 0) {
      return interaction.reply({ content: '✅ Không có cụm nào đang chờ duyệt!', ephemeral: true });
    }

    const item = dsCho[0];

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('📋 DUYỆT CỤM ĐỀ XUẤT')
      .setDescription(`Còn **${dsCho.length}** cụm đang chờ duyệt.`)
      .addFields(
        { name: '📝 Cụm', value: `**${item.cum}**` },
        { name: '👤 Người đề xuất', value: `<@${item.nguoiGuiId}> (\`${item.nguoiGui}\`)` },
        { name: '🕐 Thời gian', value: `<t:${Math.floor(item.thoiGian / 1000)}:R>` }
      )
      .setFooter({ text: `ID: ${item.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`duyet:${item.id}`)
        .setLabel('✅ Duyệt')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tuchoi:${item.id}`)
        .setLabel('❌ Từ chối')
        .setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ===== /dsduyet =====
  if (interaction.commandName === 'dsduyet') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Chỉ Admin dùng được.', ephemeral: true });
    }

    const dsCho = CHO_DUYET.filter(x => x.guildId === gid);

    if (dsCho.length === 0) {
      return interaction.reply({ content: '✅ Không có cụm nào đang chờ duyệt!', ephemeral: true });
    }

    const dsText = dsCho.slice(0, 30).map((x, i) => `**${i + 1}.** \`${x.cum}\` — <@${x.nguoiGuiId}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle(`📋 DANH SÁCH CHỜ DUYỆT (${dsCho.length})`)
      .setDescription(dsText + (dsCho.length > 30 ? `\n\n_...còn ${dsCho.length - 30} cụm khác_` : ''))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ===== /themtudien =====
  if (interaction.commandName === 'themtudien') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Cần quyền **Administrator**.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'xoa') {
      const cum = interaction.options.getString('cum').trim().toLowerCase().replace(/\s+/g, ' ');
      const index = TU_DIEN.findIndex(c => c.toLowerCase() === cum);

      if (index === -1) return interaction.reply({ content: `❌ Cụm **"${cum}"** không có.`, ephemeral: true });

      TU_DIEN.splice(index, 1);
      luuTuDien();
      return interaction.reply(`✅ Đã xóa cụm **"${cum}"**. Còn **${TU_DIEN.length}** cụm.`);
    }

    if (sub === 'tim') {
      const tuKhoa = interaction.options.getString('tukhoa').trim().toLowerCase();
      const ketQua = TU_DIEN.filter(c => c.toLowerCase().includes(tuKhoa)).slice(0, 30);

      if (ketQua.length === 0) return interaction.reply({ content: `❌ Không tìm thấy **"${tuKhoa}"**.`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🔍 KẾT QUẢ: "${tuKhoa}"`)
        .setDescription(ketQua.map(c => `• \`${c}\``).join('\n'))
        .setFooter({ text: `Tìm thấy ${ketQua.length} cụm` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'thongke') {
      const cfg = SETUP[gid] || {};
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 THỐNG KÊ')
        .addFields(
          { name: '📖 Từ điển', value: `**${TU_DIEN.length}** cụm` },
          { name: '⏳ Chờ duyệt', value: `**${CHO_DUYET.filter(x => x.guildId === gid).length}**` },
          { name: '📥 Kênh đề xuất', value: cfg.dexuatChannelId ? `<#${cfg.dexuatChannelId}>` : '❌ Chưa cài' },
          { name: '🎮 Kênh chơi', value: cfg.channelId ? `<#${cfg.channelId}>` : '❌ Chưa cài' }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // ===== /noitusetup =====
  if (interaction.commandName === 'noitusetup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Cần quyền **Administrator**.', ephemeral: true });
    }

    if (TU_DIEN.length === 0) return interaction.reply({ content: '❌ Từ điển đang trống!', ephemeral: true });

    const kenh = interaction.options.getChannel('kenh');
    const daSetup = !!SETUP[gid]?.channelId;

    if (!SETUP[gid]) SETUP[gid] = { channelId: null, dexuatChannelId: null };
    SETUP[gid].channelId = kenh.id;
    luuSetup();

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(daSetup ? '🔄 ĐÃ CẬP NHẬT KÊNH CHƠI' : '🔗 ĐÃ CÀI ĐẶT NỐI TỪ')
      .addFields(
        { name: '📢 Kênh chơi', value: `<#${kenh.id}>` },
        { name: '📖 Từ điển', value: `**${TU_DIEN.length}** cụm` },
        { name: '📥 Kênh đề xuất', value: SETUP[gid].dexuatChannelId ? `<#${SETUP[gid].dexuatChannelId}>` : '_Chưa cài (`/setkenhdexuat`)_' }
      )
      .setDescription('✅ Setup xong! Gõ `/noitustart` để chơi.')
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== /noitustart =====
  if (interaction.commandName === 'noitustart') {
    const cfg = SETUP[gid];
    if (!cfg || !cfg.channelId) {
      return interaction.reply({ content: '❌ Chưa setup! Nhờ Admin dùng `/noitusetup` trước.', ephemeral: true });
    }

    const game = gameNoiTu[gid];
    if (game && game.batDau) return interaction.reply({ content: '⚠️ Ván đang chạy!', ephemeral: true });

    if (TU_DIEN.length === 0) return interaction.reply({ content: '❌ Từ điển trống!', ephemeral: true });

    const cumBatDau = TU_DIEN[Math.floor(Math.random() * TU_DIEN.length)];

    gameNoiTu[gid] = { tuCuoi: cumBatDau, lichSuTu: [cumBatDau], batDau: true };

    const tiengCuoi = layTiengCuoi(cumBatDau);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 VÁN NỐI TỪ BẮT ĐẦU!')
      .setDescription(
        `**📌 Luật:**\n` +
        `• Gõ **cụm 2 tiếng** (VD: \`ngôi nhà\`)\n` +
        `• **Tiếng đầu** phải khớp **tiếng cuối** cụm trước\n` +
        `• Không dùng lại cụm đã nối\n` +
        `• Cụm phải có trong **từ điển**\n\n` +
        `**🎲 Cụm bắt đầu:** **${cumBatDau}**\n` +
        `👉 Tiếp theo bắt đầu bằng **"${tiengCuoi}"**\n\n` +
        `📍 **Chơi tại:** <#${cfg.channelId}>`
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== /noituend =====
  if (interaction.commandName === 'noituend') {
    const game = gameNoiTu[gid];
    if (!game) return interaction.reply({ content: '❌ Chưa có ván nào!', ephemeral: true });

    const soTu = game.lichSuTu.length;
    const dsTu = game.lichSuTu.slice(-15).map((t, i) => `${i + 1}. \`${t}\``).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFF5555)
      .setTitle('🏁 KẾT THÚC VÁN NỐI TỪ')
      .addFields(
        { name: '📊 Tổng số cụm', value: `**${soTu}**` },
        { name: '🔗 15 cụm cuối', value: dsTu || '_(trống)_' }
      )
      .setDescription('💡 Chơi ván mới? Gõ `/noitustart`!')
      .setTimestamp();

    delete gameNoiTu[gid];
    return interaction.reply({ embeds: [embed] });
  }

  // ===== /help =====
  if (interaction.commandName === 'help') {
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 DANH SÁCH LỆNH')
      .addFields(
        { name: '🔗 Nối từ', value:
          '`/noitustart` — Bắt đầu ván\n' +
          '`/noituend` — Kết thúc ván'
        },
        { name: '📥 Đề xuất (Mọi người)', value:
          '`/dexuat` — Gửi cụm mới để admin duyệt'
        }
      );

    if (isAdmin) {
      embed.addFields({
        name: '👑 Quản lý (Admin)',
        value:
          '`/noitusetup` — Cài kênh chơi\n' +
          '`/setkenhdexuat` — Chọn kênh nhận đề xuất\n' +
          '`/duyet` — Duyệt cụm chờ\n' +
          '`/dsduyet` — Xem danh sách chờ\n' +
          '`/themtudien xoa` — Xóa cụm\n' +
          '`/themtudien tim` — Tìm cụm\n' +
          '`/themtudien thongke` — Thống kê'
      });
    }

    embed.addFields({ name: '⚙️ Cơ bản', value: '`/help` `/ping`' });
    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'ping') {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }
});

client.login(process.env.DISCORD_TOKEN);
