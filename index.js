require("dotenv").config();
const {
  Client, GatewayIntentBits, Events, PermissionFlagsBits, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require("discord.js");
const db = require("./db");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Thiếu DISCORD_TOKEN. Hãy cấu hình biến môi trường trên hosting.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const xpCooldown = new Map();
const workCooldown = new Map();
const XP_COOLDOWN_MS = 60_000;
const WORK_COOLDOWN_MS = 60_000;

function safeText(text, max = 1800) {
  return String(text ?? "").slice(0, max);
}
function requiredEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}
function levelForXP(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}
function xpForNextLevel(level) {
  return (level + 1) * (level + 1) * 100;
}
function errorReply(interaction, message) {
  const payload = { content: message, ephemeral: true };
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload);
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Đã đăng nhập: ${readyClient.user.tag}`);
  console.log(`Bot đang hoạt động trên ${readyClient.guilds.cache.size} server.`);
});

client.on(Events.GuildMemberAdd, async member => {
  const channelId = requiredEnv("WELCOME_CHANNEL_ID");
  if (!channelId) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle("Chào mừng thành viên mới!")
    .setDescription(`Xin chào ${member}!\nChào mừng bạn đến với **${safeText(member.guild.name, 100)}**.`)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Thành viên thứ ${member.guild.memberCount}` })
    .setTimestamp();
  channel.send({ embeds: [embed], allowedMentions: { users: [member.id] } }).catch(console.error);
});

client.on(Events.MessageCreate, message => {
  if (!message.guild || message.author.bot) return;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  if (now - (xpCooldown.get(key) || 0) < XP_COOLDOWN_MS) return;
  xpCooldown.set(key, now);

  const row = db.user(message.guild.id, message.author.id);
  const xp = row.xp + Math.floor(Math.random() * 11) + 15;
  const level = levelForXP(xp);
  db.saveXP(row, xp, level, now);

  if (level > row.level) {
    message.channel.send(`🎉 ${message.author} đã lên cấp **${level}**!`).catch(() => {});
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "ticket_open") {
        if (!interaction.guild) return errorReply(interaction, "Lệnh này chỉ dùng trong server.");
        const existing = db.db.prepare("SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ?").get(interaction.guild.id, interaction.user.id);
        if (existing) {
          const oldChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
          if (oldChannel) return errorReply(interaction, `Bạn đã có ticket đang mở: ${oldChannel}`);
          db.deleteTicket(existing.channel_id);
        }
        const supportRoleId = requiredEnv("SUPPORT_ROLE_ID");
        const categoryId = requiredEnv("TICKET_CATEGORY_ID");
        const permissionOverwrites = [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
          { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
        ];
        if (supportRoleId) permissionOverwrites.push({
          id: supportRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90),
          type: ChannelType.GuildText,
          ...(categoryId ? { parent: categoryId } : {}),
          permissionOverwrites,
          topic: `Ticket của ${interaction.user.tag} (${interaction.user.id})`
        });
        db.insertTicket.run(channel.id, interaction.guild.id, interaction.user.id, Date.now());
        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket_close").setLabel("Đóng ticket").setStyle(ButtonStyle.Danger)
        );
        await channel.send({
          content: `${interaction.user}${supportRoleId ? ` <@&${supportRoleId}>` : ""}`,
          embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("Ticket hỗ trợ").setDescription("Hãy mô tả vấn đề của bạn. Đội ngũ hỗ trợ sẽ phản hồi tại đây.")],
          components: [closeRow],
          allowedMentions: { users: [interaction.user.id], roles: supportRoleId ? [supportRoleId] : [] }
        });
        return interaction.reply({ content: `Đã tạo ticket: ${channel}`, ephemeral: true });
      }

      if (interaction.customId === "ticket_close") {
        const ticket = db.getTicket.get(interaction.channelId);
        if (!ticket) return errorReply(interaction, "Không tìm thấy ticket này.");
        const isOwner = ticket.user_id === interaction.user.id;
        const isSupport = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
        const supportRoleId = requiredEnv("SUPPORT_ROLE_ID");
        const hasSupportRole = Boolean(supportRoleId && interaction.member?.roles?.cache?.has(supportRoleId));
        if (!isOwner && !isSupport && !hasSupportRole) {
          return errorReply(interaction, "Chỉ người mở ticket hoặc đội ngũ hỗ trợ mới có thể đóng ticket.");
        }
        await interaction.reply({ content: "Ticket sẽ bị đóng sau 3 giây." });
        db.deleteTicket(interaction.channelId);
        setTimeout(() => interaction.channel?.delete("Ticket closed").catch(() => {}), 3000);
        return;
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild } = interaction;
    if (["server", "kick", "ban", "timeout", "clear", "ticket", "rank", "leaderboard", "balance", "daily", "work", "pay"].includes(commandName) && !guild) {
      return errorReply(interaction, "Lệnh này chỉ dùng trong server.");
    }

    if (commandName === "ping") {
      return interaction.reply(`🏓 Pong! Độ trễ gateway: ${client.ws.ping}ms`);
    }
    if (commandName === "help") {
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("Danh sách lệnh")
        .setDescription([
          "`/ping`, `/help`, `/server`, `/userinfo`",
          "`/kick`, `/ban`, `/timeout`, `/clear` — quản lý server",
          "`/ticket` — mở ticket hỗ trợ",
          "`/rank`, `/leaderboard` — XP và bảng xếp hạng",
          "`/balance`, `/daily`, `/work`, `/pay` — tiền ảo",
          "`/ask` — hỏi AI (cần cấu hình API key)"
        ].join("\n"));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (commandName === "server") {
      const g = guild;
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(g.name)
        .setThumbnail(g.iconURL())
        .addFields(
          { name: "ID", value: g.id, inline: true },
          { name: "Thành viên", value: String(g.memberCount), inline: true },
          { name: "Tạo ngày", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === "userinfo") {
      const target = interaction.options.getUser("user") || interaction.user;
      const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Thông tin ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "ID", value: target.id, inline: true },
          { name: "Tạo tài khoản", value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
          ...(member?.joinedTimestamp ? [{ name: "Tham gia server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true }] : [])
        );
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === "kick" || commandName === "ban") {
      const target = interaction.options.getUser("user", true);
      const reason = safeText(interaction.options.getString("reason") || "Không nêu lý do", 400);
      if (target.id === interaction.user.id) return errorReply(interaction, "Bạn không thể tự thực hiện lệnh này lên chính mình.");
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        if (commandName === "ban") {
          await guild.members.ban(target.id, { reason: `${reason} | By ${interaction.user.tag}` });
          return interaction.reply(`🔨 Đã ban ${target.tag}. Lý do: ${reason}`);
        }
        return errorReply(interaction, "Không tìm thấy thành viên trong server.");
      }
      if (!member.moderatable && commandName === "timeout") return errorReply(interaction, "Bot không có quyền xử lý thành viên này; hãy kiểm tra thứ bậc role.");
      if (member.id === guild.ownerId) return errorReply(interaction, "Không thể xử lý chủ server.");
      if (commandName === "kick") {
        if (!member.kickable) return errorReply(interaction, "Bot không thể kick thành viên này. Kiểm tra thứ bậc role và quyền.");
        await member.kick(`${reason} | By ${interaction.user.tag}`);
        return interaction.reply(`👢 Đã kick ${target.tag}. Lý do: ${reason}`);
      }
      await guild.members.ban(target.id, { reason: `${reason} | By ${interaction.user.tag}` });
      return interaction.reply(`🔨 Đã ban ${target.tag}. Lý do: ${reason}`);
    }
    if (commandName === "timeout") {
      const target = interaction.options.getUser("user", true);
      const minutes = interaction.options.getInteger("minutes", true);
      const reason = safeText(interaction.options.getString("reason") || "Không nêu lý do", 400);
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) return errorReply(interaction, "Không tìm thấy thành viên.");
      if (!member.moderatable) return errorReply(interaction, "Bot không thể timeout thành viên này. Kiểm tra thứ bậc role.");
      await member.timeout(minutes * 60_000, `${reason} | By ${interaction.user.tag}`);
      return interaction.reply(`⏳ Đã timeout ${target.tag} trong ${minutes} phút. Lý do: ${reason}`);
    }
    if (commandName === "clear") {
      const amount = interaction.options.getInteger("amount", true);
      const messages = await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Đã xóa ${messages.size} tin nhắn. Tin nhắn cũ hơn 14 ngày không thể xóa hàng loạt.`, ephemeral: true });
    }
    if (commandName === "ticket") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_open").setLabel("Mở ticket").setStyle(ButtonStyle.Primary)
      );
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle("Trung tâm hỗ trợ").setDescription("Nhấn nút bên dưới để tạo một kênh hỗ trợ riêng tư.")],
        components: [row]
      });
    }
    if (commandName === "rank") {
      const target = interaction.options.getUser("user") || interaction.user;
      const row = db.user(guild.id, target.id);
      const next = xpForNextLevel(row.level);
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Cấp độ của ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Level", value: String(row.level), inline: true },
          { name: "XP", value: `${row.xp} / ${next}`, inline: true },
          { name: "XP còn lại", value: String(Math.max(0, next - row.xp)), inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === "leaderboard") {
      const type = interaction.options.getString("type") || "xp";
      const rows = type === "coins" ? db.leaderboardCoins.all(guild.id) : db.leaderboardXP.all(guild.id);
      const lines = rows.length ? rows.map((r, i) =>
        type === "coins" ? `**${i + 1}.** <@${r.user_id}> — 🪙 ${r.coins}` : `**${i + 1}.** <@${r.user_id}> — Level ${r.level} (${r.xp} XP)`
      ) : ["Chưa có dữ liệu."];
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(type === "coins" ? "Bảng xếp hạng tiền ảo" : "Bảng xếp hạng XP").setDescription(lines.join("\n"));
      return interaction.reply({ embeds: [embed] });
    }
    if (commandName === "balance") {
      const target = interaction.options.getUser("user") || interaction.user;
      const row = db.user(guild.id, target.id);
      return interaction.reply(`🪙 Số dư của ${target}: **${row.coins}** coin.`);
    }
    if (commandName === "daily") {
      const result = db.claimDaily(guild.id, interaction.user.id, 250, Date.now());
      if (!result.ok) return errorReply(interaction, `Bạn đã nhận daily rồi. Thử lại <t:${Math.ceil(result.nextAt / 1000)}:R>.`);
      return interaction.reply(`🎁 Bạn nhận được **250 coin**. Số dư mới: **${result.balance} coin**.`);
    }
    if (commandName === "work") {
      const key = `${guild.id}:${interaction.user.id}`;
      const now = Date.now();
      if (now - (workCooldown.get(key) || 0) < WORK_COOLDOWN_MS) {
        return errorReply(interaction, "Bạn đang nghỉ sau ca làm. Hãy thử lại sau 1 phút.");
      }
      workCooldown.set(key, now);
      const earned = Math.floor(Math.random() * 101) + 50;
      const balance = db.coins(guild.id, interaction.user.id, earned);
      return interaction.reply(`💼 Bạn làm việc chăm chỉ và kiếm được **${earned} coin**. Số dư: **${balance} coin**.`);
    }
    if (commandName === "pay") {
      const target = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      if (target.bot || target.id === interaction.user.id) return errorReply(interaction, "Bạn chỉ có thể chuyển coin cho người khác không phải bot.");
      const sender = db.user(guild.id, interaction.user.id);
      if (sender.coins < amount) return errorReply(interaction, "Bạn không đủ coin.");
      db.db.transaction(() => {
        db.coins(guild.id, interaction.user.id, -amount);
        db.coins(guild.id, target.id, amount);
      })();
      return interaction.reply(`💸 Đã chuyển **${amount} coin** cho ${target}.`);
    }
    if (commandName === "ask") {
      const apiKey = requiredEnv("AI_API_KEY");
      if (!apiKey) return errorReply(interaction, "AI chưa được bật. Chủ bot cần cấu hình AI_API_KEY trên hosting.");
      await interaction.deferReply();
      const question = interaction.options.getString("question", true);
      const baseUrl = (requiredEnv("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
      const model = requiredEnv("AI_MODEL") || "gpt-4o-mini";
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Bạn là trợ lý hữu ích trong Discord. Trả lời rõ ràng, an toàn và ngắn gọn." },
            { role: "user", content: question }
          ],
          max_tokens: 700
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        console.error("AI provider error:", response.status, details.slice(0, 500));
        return interaction.editReply("AI đang gặp lỗi hoặc API key/model chưa đúng. Chủ bot hãy kiểm tra log hosting.");
      }
      const data = await response.json();
      const answer = data?.choices?.[0]?.message?.content;
      if (!answer) return interaction.editReply("AI không trả về nội dung. Hãy thử lại.");
      return interaction.editReply({ content: safeText(answer, 1900), allowedMentions: { parse: [] } });
    }
  } catch (error) {
    console.error("Lỗi interaction:", error);
    if (error?.code === "INSUFFICIENT_FUNDS") {
      return errorReply(interaction, "Bạn không đủ coin.");
    }
    return errorReply(interaction, "Đã xảy ra lỗi khi xử lý lệnh. Hãy kiểm tra log của bot.");
  }
});

client.on("error", error => console.error("Discord client error:", error));
process.on("unhandledRejection", error => console.error("Unhandled rejection:", error));

client.login(token);
