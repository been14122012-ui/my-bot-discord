// ===== KEEP ALIVE SERVER =====
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('✅ Bot đang chạy!'));
app.listen(3000, () => console.log('🌐 Keep-alive server port 3000'));

// ===== IMPORTS =====
const fs = require('fs');
const {
  Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, ChannelType,
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
const FILE_TICKET = './ticket.json';

// ===== ĐỌC TỪ ĐIỂN =====
let TU_DIEN = [];
function docTuDien() {
  try {
    TU_DIEN = JSON.parse(fs.readFileSync(FILE_TU_DIEN, 'utf8')).cum || [];
    console.log(`📖 Đã tải ${TU_DIEN.length} cụm từ điển`);
  } catch (e) { TU_DIEN = []; }
}
function luuTuDien() {
  try { fs.writeFileSync(FILE_TU_DIEN, JSON.stringify({ cum: TU_DIEN }, null, 2)); return true; }
  catch (e) { return false; }
}
function cumCoTrongTuDien(cum) {
  if (TU_DIEN.length === 0) return true;
  const c = cum.toLowerCase().trim().replace(/\s+/g, ' ');
  return TU_DIEN.some(x => x.toLowerCase().trim().replace(/\s+/g, ' ') === c);
}
docTuDien();

// ===== ĐỌC HÀNG CHỜ DUYỆT =====
let CHO_DUYET = [];
function docChoDuyet() {
  try { CHO_DUYET = JSON.parse(fs.readFileSync(FILE_CHO_DUYET, 'utf8')) || []; }
  catch (e) { CHO_DUYET = []; }
  console.log(`⏳ Đang chờ duyệt: ${CHO_DUYET.length} cụm`);
}
function luuChoDuyet() {
  try { fs.writeFileSync(FILE_CHO_DUYET, JSON.stringify(CHO_DUYET, null, 2)); return true; }
  catch (e) { return false; }
}
docChoDuyet();

// ===== ĐỌC SETUP =====
let SETUP = {};
function docSetup() {
  try {
    SETUP = JSON.parse(fs.readFileSync(FILE_SETUP, 'utf8')) || {};
    for (const gid in SETUP) {
      if (typeof SETUP[gid] === 'string') SETUP[gid] = { channelId: SETUP[gid], dexuatChannelId: null };
    }
    console.log(`⚙️ Đã tải setup ${Object.keys(SETUP).length} server`);
  } catch (e) { SETUP = {}; }
}
function luuSetup() {
  try { fs.writeFileSync(FILE_SETUP, JSON.stringify(SETUP, null, 2)); return true; }
  catch (e) { return false; }
}
docSetup();

// ===== ĐỌC TICKET =====
let TICKET = {};
function docTicket() {
  try {
    TICKET = JSON.parse(fs.readFileSync(FILE_TICKET, 'utf8')) || {};
    console.log(`🎫 Đã tải ticket ${Object.keys(TICKET).length} server`);
  } catch (e) { TICKET = {}; }
}
function luuTicket() {
  try { fs.writeFileSync(FILE_TICKET, JSON.stringify(TICKET, null, 2)); return true; }
  catch (e) { return false; }
}
docTicket();

// ===== LƯU VÁN ĐANG CHƠI =====
const gameNoiTu = {};

// ===== HÀM HỖ TRỢ =====
function layTiengCuoi(cumTu) {
  const t = cumTu.trim().split(/\s+/);
  return t[t.length - 1];
}
function layTiengDau(cumTu) {
  return cumTu.trim().split(/\s+/)[0];
}
function taoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== READY =====
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot online: ${c.user.tag}`);
  console.log(`📖 Từ điển: ${TU_DIEN.length} cụm`);
});

// ===== MESSAGE CREATE =====
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

  if (noiDung.split(/\s+/).length < 2) {
    try {
      await message.react('❌');
      const w = await message.reply('❌ **Sai luật!** Phải là **cụm 2 tiếng trở lên**.');
      setTimeout(() => w.delete().catch(() => {}), 5000);
    } catch (e) {}
    return;
  }

  if (!cumCoTrongTuDien(noiDung)) {
    try {
      await message.react('📖');
      const w = await message.reply(`📖 Cụm **"${noiDung}"** không có trong từ điển!\n👉 Đề xuất bằng \`/dexuat cum: ${noiDung}\``);
      setTimeout(() => w.delete().catch(() => {}), 8000);
    } catch (e) {}
    return;
  }

  const tCuoi = layTiengCuoi(game.tuCuoi).toLowerCase();
  const tDau = layTiengDau(noiDung).toLowerCase();

  if (tDau !== tCuoi) {
    try {
      await message.react('❌');
      const w = await message.reply(`❌ **Nối sai!** Phải bắt đầu bằng **"${tCuoi}"**.`);
      setTimeout(() => w.delete().catch(() => {}), 7000);
    } catch (e) {}
    return;
  }

  if (game.lichSuTu.map(t => t.toLowerCase()).includes(noiDung.toLowerCase())) {
    try {
      await message.react('🔁');
      const w = await message.reply(`🔁 Cụm **"${noiDung}"** đã dùng rồi!`);
      setTimeout(() => w.delete().catch(() => {}), 5000);
    } catch (e) {}
    return;
  }

  game.tuCuoi = noiDung;
  game.lichSuTu.push(noiDung);
  try { await message.react('✅'); } catch (e) {}

  const tCuoiMoi = layTiengCuoi(noiDung);
  const soTu = game.lichSuTu.length;
  try {
    const w = await message.reply(
      `✅ **Hợp lệ!** Cụm: **${noiDung}**\n👉 Tiếp theo bắt đầu bằng **"${tCuoiMoi}"**\n📊 Đã nối: **${soTu}** cụm`
    );
    setTimeout(() => w.delete().catch(() => {}), 8000);
  } catch (e) {}
});

// ===== HÀM TẠO TICKET =====
async function taoTicket(interaction, lyDo = 'Không có lý do') {
  const guild = interaction.guild;
  const gid = guild.id;
  const cfg = TICKET[gid];

  if (!cfg || !cfg.categoryId) {
    return interaction.reply({ content: '❌ Admin chưa cài `/setticket`!', ephemeral: true });
  }

  const category = guild.channels.cache.get(cfg.categoryId);
  if (!category) return interaction.reply({ content: '❌ Không tìm thấy category!', ephemeral: true });

  const tenKenh = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const daCo = guild.channels.cache.find(c => c.name === tenKenh);

  if (daCo) {
    return interaction.reply({ content: `⚠️ Bạn đã có ticket: <#${daCo.id}>`, ephemeral: true });
  }

  try {
    const kenhTicket = await guild.channels.create({
      name: tenKenh,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `Ticket của ${interaction.user.tag} - ${lyDo}`,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    const adminRoles = guild.roles.cache.filter(r =>
      r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed
    );
    for (const role of adminRoles.values()) {
      await kenhTicket.permissionOverwrites.create(role.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      }).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor(0xF5B041)
      .setAuthor({ name: '🌙 LUNARI BOT XIN CHÀO !!!' })
      .setTitle(`**Xin chào ${interaction.user.username}!**`)
      .setDescription(
        `→ Chào <@${interaction.user.id}> đến với không gian hỗ trợ riêng.\n\n` +
        `→ Đừng lo lắng về những rắc rối bạn đang gặp phải, hãy mô tả chi tiết vấn đề để chúng mình có thể hỗ trợ một cách nhanh nhất nhé.\n\n` +
        `**📝 Lý do:** ${lyDo}`
      )
      .setFooter({ text: `Ticket của ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_dong')
        .setLabel('Đóng ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Nhận ticket')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary),
    );

    await kenhTicket.send({
      content: `<@${interaction.user.id}> ${adminRoles.first() ? `<@&${adminRoles.first().id}>` : ''}`,
      embeds: [embed],
      components: [row]
    });

    if (cfg.logChannelId) {
      const logCh = guild.channels.cache.get(cfg.logChannelId);
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎫 TICKET MỚI')
            .addFields(
              { name: '👤 User', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📁 Kênh', value: `<#${kenhTicket.id}>`, inline: true },
              { name: '📝 Lý do', value: lyDo }
            ).setTimestamp()]
        }).catch(() => {});
      }
    }

    return interaction.reply({ content: `✅ Đã tạo ticket: <#${kenhTicket.id}>`, ephemeral: true });
  } catch (err) {
    console.error('Lỗi tạo ticket:', err.message);
    return interaction.reply({ content: '❌ Không tạo được ticket! Bot thiếu quyền **Manage Channels**.', ephemeral: true });
  }
}

// ===== INTERACTION CREATE =====
client.on(Events.InteractionCreate, async (interaction) => {
  const gid = interaction.guild?.id;

  // ===== MODAL SUBMIT =====
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_tao_ticket') {
      const lyDo = interaction.fields.getTextInputValue('lydo');
      return taoTicket(interaction, lyDo);
    }
    return;
  }

  // ===== BUTTON =====
  if (interaction.isButton()) {
    // Nút Tạo Ticket
    if (interaction.customId === 'tao_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('modal_tao_ticket')
        .setTitle('Tạo Ticket Hỗ Trợ');

      const input = new TextInputBuilder()
        .setCustomId('lydo')
        .setLabel('Lý do mở ticket')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('VD: Bot bị lỗi khi chạy lệnh /noitustart...')
        .setRequired(true)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    // Nút Đóng Ticket
    if (interaction.customId === 'ticket_dong') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Chỉ Admin mới đóng được.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('🔒 ĐANG ĐÓNG TICKET').setDescription('Ticket sẽ bị xoá sau **5 giây**...')]
      });

      const cfg = TICKET[interaction.guild.id];
      if (cfg && cfg.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
        if (logCh) {
          await logCh.send({
            embeds: [new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('🔒 TICKET ĐÓNG')
              .addFields(
                { name: '📁 Kênh', value: `\`${interaction.channel.name}\``, inline: true },
                { name: '👤 Admin', value: `<@${interaction.user.id}>`, inline: true }
              ).setTimestamp()]
          }).catch(() => {});
        }
      }

      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    // Nút Claim Ticket
    if (interaction.customId === 'ticket_claim') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Chỉ Admin mới nhận ticket.', ephemeral: true });
      }
      return interaction.reply({ content: `📜 **${interaction.user.username}** đã nhận ticket này!` });
    }

    // Nút duyệt/từ chối cụm từ
    const [action, id] = interaction.customId.split(':');
    if (action === 'duyet' || action === 'tuchoi') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Chỉ Admin mới bấm được nút này.', ephemeral: true });
      }

      const index = CHO_DUYET.findIndex(x => x.id === id);
      if (index === -1) return interaction.reply({ content: '⚠️ Cụm này đã được xử lý.', ephemeral: true });

      const item = CHO_DUYET[index];

      if (action === 'duyet') {
        if (cumCoTrongTuDien(item.cum)) {
          CHO_DUYET.splice(index, 1);
          luuChoDuyet();
          return interaction.update({ content: `⚠️ Cụm **"${item.cum}"** đã có trong từ điển.`, embeds: [], components: [] });
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

      if (action === 'tuchoi') {
        CHO_DUYET.splice(index, 1);
        luuChoDuyet();
        try {
          const nguoiGui = await client.users.fetch(item.nguoiGuiId);
          await nguoiGui.send(`❌ Cụm **"${item.cum}"** bạn đề xuất đã bị **TỪ CHỐI**.`).catch(() => {});
        } catch (e) {}
        return interaction.update({ content: `❌ Đã **TỪ CHỐI** cụm **"${item.cum}"**.`, embeds: [], components: [] });
      }
    }
    return;
  }

  // ===== SLASH COMMANDS =====
  if (!interaction.isChatInputCommand()) return;

  // ===== /setticket =====
  if (interaction.commandName === 'setticket') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Cần quyền **Administrator**.', ephemeral: true });

    const category = interaction.options.getChannel('category');
    const logChannel = interaction.options.getChannel('logchannel');

    if (!TICKET[gid]) TICKET[gid] = { categoryId: null, logChannelId: null };
    TICKET[gid].categoryId = category.id;
    if (logChannel) TICKET[gid].logChannelId = logChannel.id;
    luuTicket();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ ĐÃ CÀI ĐẶT TICKET')
        .addFields(
          { name: '📁 Category', value: `<#${category.id}>` },
          { name: '📢 Log channel', value: logChannel ? `<#${logChannel.id}>` : '_Chưa cài_' }
        )
        .setDescription('👉 Bước tiếp: Gõ `/ticketpanel` trong kênh bạn muốn làm panel.')
        .setTimestamp()]
    });
  }

  // ===== /ticketpanel =====
  if (interaction.commandName === 'ticketpanel') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Cần quyền **Administrator**.', ephemeral: true });

    const cfg = TICKET[gid];
    if (!cfg || !cfg.categoryId)
      return interaction.reply({ content: '❌ Chưa cài `/setticket`!', ephemeral: true });

    const tieuDe = interaction.options.getString('tieude') || 'GẶP GỠ ĐỘI NGŨ HỖ TRỢ';
    const moTa = interaction.options.getString('mota') ||
      'Chào mừng bạn đến với kênh hỗ trợ chính thức!\n\n' +
      'Tại đây chúng mình tiếp nhận các vấn đề sau:\n\n' +
      '• **Báo lỗi (Bug Report)**: Giúp bot hoàn thiện hơn.\n' +
      '• **Góp ý (Suggestions)**: Muốn bot có thêm tính năng gì?\n' +
      '• **Hỗ trợ (Support)**: Hỗ trợ sử dụng bot.\n\n' +
      '📩 Nhấn vào nút **"Tạo Ticket"** bên dưới để bắt đầu.';
    const anh = interaction.options.getString('anh');

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({ name: '✦ ◦ 9ε ---------- LUNARI BOT ---------- 9ε ◦ ✦' })
      .setTitle(`🎫 ${tieuDe}`)
      .setDescription(moTa)
      .setFooter({ text: 'Welcome to Lunari Bot!' })
      .setTimestamp();

    if (anh) embed.setImage(anh);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tao_ticket')
        .setLabel('Tạo Ticket')
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Đã gửi panel ticket!', ephemeral: true });
  }

  // ===== /close =====
  if (interaction.commandName === 'close') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Chỉ Admin.', ephemeral: true });

    if (!interaction.channel.name.startsWith('ticket-'))
      return interaction.reply({ content: '❌ Chỉ dùng trong kênh ticket.', ephemeral: true });

    await interaction.reply('🔒 Đang đóng ticket sau **5 giây**...');

    const cfg = TICKET[gid];
    if (cfg && cfg.logChannelId) {
      const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
      if (logCh) {
        await logCh.send(`🔒 **Ticket đóng** bởi <@${interaction.user.id}>: \`${interaction.channel.name}\``).catch(() => {});
      }
    }

    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    return;
  }

  // ===== /dexuat =====
  if (interaction.commandName === 'dexuat') {
    const cumRaw = interaction.options.getString('cum');
    const cum = cumRaw.trim().toLowerCase().replace(/\s+/g, ' ');

    const cfg = SETUP[gid];
    if (!cfg || !cfg.dexuatChannelId)
      return interaction.reply({ content: '❌ Admin chưa cài `/setkenhdexuat`!', ephemeral: true });

    if (cum.split(/\s+/).length < 2)
      return interaction.reply({ content: '❌ Cụm phải có **ít nhất 2 tiếng**.', ephemeral: true });

    if (cumCoTrongTuDien(cum))
      return interaction.reply({ content: `⚠️ Cụm **"${cum}"** đã có trong từ điển!`, ephemeral: true });

    if (CHO_DUYET.some(x => x.cum === cum))
      return interaction.reply({ content: `⏳ Cụm **"${cum}"** đang chờ duyệt!`, ephemeral: true });

    const item = {
      id: taoId(), cum,
      nguoiGui: interaction.user.tag,
      nguoiGuiId: interaction.user.id,
      guildId: gid,
      thoiGian: Date.now(),
    };
    CHO_DUYET.push(item);
    luuChoDuyet();

    const kenhDeXuat = await interaction.guild.channels.fetch(cfg.dexuatChannelId).catch(() => null);
    if (!kenhDeXuat)
      return interaction.reply({ content: '❌ Không tìm thấy kênh đề xuất!', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('📥 ĐỀ XUẤT CỤM MỚI')
      .addFields(
        { name: '📝 Cụm', value: `**${cum}**` },
        { name: '👤 Người đề xuất', value: `<@${interaction.user.id}>` },
        { name: '🕐 Thời gian', value: `<t:${Math.floor(item.thoiGian / 1000)}:R>` }
      )
      .setFooter({ text: `ID: ${item.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duyet:${item.id}`).setLabel('✅ Duyệt').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`tuchoi:${item.id}`).setLabel('❌ Từ chối').setStyle(ButtonStyle.Danger),
    );

    try {
      await kenhDeXuat.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Đã gửi đề xuất cụm **"${cum}"**!`, ephemeral: true });
    } catch (err) {
      CHO_DUYET.pop();
      luuChoDuyet();
      return interaction.reply({ content: '❌ Không gửi được!', ephemeral: true });
    }
  }

  // ===== /setkenhdexuat =====
  if (interaction.commandName === 'setkenhdexuat') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Cần **Administrator**.', ephemeral: true });

    const kenh = interaction.options.getChannel('kenh');
    if (!SETUP[gid]) SETUP[gid] = { channelId: null, dexuatChannelId: null };
    SETUP[gid].dexuatChannelId = kenh.id;
    luuSetup();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ ĐÃ ĐẶT KÊNH ĐỀ XUẤT')
        .addFields({ name: '📥 Kênh', value: `<#${kenh.id}>` })
        .setTimestamp()]
    });
  }

  // ===== /duyet =====
  if (interaction.commandName === 'duyet') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Chỉ Admin.', ephemeral: true });

    const dsCho = CHO_DUYET.filter(x => x.guildId === gid);
    if (dsCho.length === 0)
      return interaction.reply({ content: '✅ Không có cụm nào chờ duyệt!', ephemeral: true });

    const item = dsCho[0];
    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('📋 DUYỆT CỤM')
      .setDescription(`Còn **${dsCho.length}** cụm.`)
      .addFields(
        { name: '📝 Cụm', value: `**${item.cum}**` },
        { name: '👤 Người đề xuất', value: `<@${item.nguoiGuiId}>` }
      )
      .setFooter({ text: `ID: ${item.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duyet:${item.id}`).setLabel('✅ Duyệt').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`tuchoi:${item.id}`).setLabel('❌ Từ chối').setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  // ===== /dsduyet =====
  if (interaction.commandName === 'dsduyet') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Chỉ Admin.', ephemeral: true });

    const dsCho = CHO_DUYET.filter(x => x.guildId === gid);
    if (dsCho.length === 0)
      return interaction.reply({ content: '✅ Không có cụm nào chờ duyệt!', ephemeral: true });

    const dsText = dsCho.slice(0, 30).map((x, i) => `**${i + 1}.** \`${x.cum}\` — <@${x.nguoiGuiId}>`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle(`📋 DANH SÁCH CHỜ DUYỆT (${dsCho.length})`)
      .setDescription(dsText)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ===== /themtudien =====
  if (interaction.commandName === 'themtudien') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Cần **Administrator**.', ephemeral: true });

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
      const ticketCfg = TICKET[gid] || {};
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 THỐNG KÊ')
        .addFields(
          { name: '📖 Từ điển', value: `**${TU_DIEN.length}** cụm` },
          { name: '⏳ Chờ duyệt', value: `**${CHO_DUYET.filter(x => x.guildId === gid).length}**` },
          { name: '📥 Kênh đề xuất', value: cfg.dexuatChannelId ? `<#${cfg.dexuatChannelId}>` : '❌ Chưa cài' },
          { name: '🎮 Kênh chơi', value: cfg.channelId ? `<#${cfg.channelId}>` : '❌ Chưa cài' },
          { name: '🎫 Category ticket', value: ticketCfg.categoryId ? `<#${ticketCfg.categoryId}>` : '❌ Chưa cài' },
          { name: '📢 Log ticket', value: ticketCfg.logChannelId ? `<#${ticketCfg.logChannelId}>` : '❌ Chưa cài' }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // ===== /noitusetup =====
  if (interaction.commandName === 'noitusetup') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '❌ Cần **Administrator**.', ephemeral: true });

    if (TU_DIEN.length === 0)
      return interaction.reply({ content: '❌ Từ điển đang trống!', ephemeral: true });

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
        { name: '📥 Kênh đề xuất', value: SETUP[gid].dexuatChannelId ? `<#${SETUP[gid].dexuatChannelId}>` : '_Chưa cài_' }
      )
      .setDescription('✅ Setup xong! Gõ `/noitustart` để chơi.')
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ===== /noitustart =====
  if (interaction.commandName === 'noitustart') {
    const cfg = SETUP[gid];
    if (!cfg || !cfg.channelId)
      return interaction.reply({ content: '❌ Chưa setup!', ephemeral: true });

    const game = gameNoiTu[gid];
    if (game && game.batDau)
      return interaction.reply({ content: '⚠️ Ván đang chạy!', ephemeral: true });

    if (TU_DIEN.length === 0)
      return interaction.reply({ content: '❌ Từ điển trống!', ephemeral: true });

    const cumBatDau = TU_DIEN[Math.floor(Math.random() * TU_DIEN.length)];
    gameNoiTu[gid] = { tuCuoi: cumBatDau, lichSuTu: [cumBatDau], batDau: true };
    const tiengCuoi = layTiengCuoi(cumBatDau);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 VÁN NỐI TỪ BẮT ĐẦU!')
      .setDescription(
        `**📌 Luật:**\n` +
        `• Gõ **cụm 2 tiếng**\n` +
        `• **Tiếng đầu** phải khớp **tiếng cuối** cụm trước\n` +
        `• Không dùng lại cụm đã nối\n\n` +
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
        { name: '📥 Đề xuất', value:
          '`/dexuat` — Gửi cụm mới để admin duyệt'
        },
        { name: '🎫 Ticket', value:
          'Nhấn nút **Tạo Ticket** trong kênh hỗ trợ'
        }
      );

    if (isAdmin) {
      embed.addFields({
        name: '👑 Quản lý (Admin)',
        value:
          '`/noitusetup` — Cài kênh chơi\n' +
          '`/setkenhdexuat` — Cài kênh đề xuất\n' +
          '`/duyet` — Duyệt cụm chờ\n' +
          '`/dsduyet` — Xem danh sách chờ\n' +
          '`/themtudien` — Quản lý từ điển\n' +
          '`/setticket` — Cài hệ thống ticket\n' +
          '`/ticketpanel` — Gửi panel ticket\n' +
          '`/close` — Đóng ticket'
      });
    }

    embed.addFields({ name: '⚙️ Cơ bản', value: '`/help` `/ping`' });
    return interaction.reply({ embeds: [embed] });
  }

  // ===== /ping =====
  if (interaction.commandName === 'ping') {
    return interaction.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }
});

client.login(process.env.DISCORD_TOKEN);
