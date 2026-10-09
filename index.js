require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Events, PermissionFlagsBits, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Thiếu DISCORD_TOKEN. Hãy thêm token trong Railway > Variables.");
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "beenstore-data.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      users: parsed.users || {},
      tickets: parsed.tickets || {}
    };
  } catch {
    return { users: {}, tickets: {} };
  }
}
const data = loadData();
let saveTimer;
function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const temp = DATA_FILE + ".tmp";
      fs.writeFileSync(temp, JSON.stringify(data, null, 2));
      fs.renameSync(temp, DATA_FILE);
    } catch (e) {
      console.error("Không lưu được dữ liệu:", e.message);
    }
  }, 300);
}
function userData(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!data.users[key]) {
    data.users[key] = { xp: 0, level: 0, coins: 0, dailyAt: 0, workAt: 0, lastXpAt: 0, inventory: [] };
  }
  return data.users[key];
}
function safeText(s, max = 500) {
  return String(s || "").replace(/[\u0000-\u001f]/g, " ").slice(0, max) || "Không cung cấp";
}
function errorReply(i, content) {
  return i.reply({ content, ephemeral: true, allowedMentions: { parse: [] } });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, c => {
  console.log(`BeenStore bot đã online: ${c.user.tag}`);
  console.log(`Đang phục vụ ${c.guilds.cache.size} server.`);
});

// Chào thành viên mới. Thiết lập WELCOME_CHANNEL_ID trong Railway Variables.
client.on(Events.GuildMemberAdd, async member => {
  const channelId = process.env.WELCOME_CHANNEL_ID;
  if (!channelId) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({
      content: `👋 Chào mừng ${member} đến với **${member.guild.name}**! Chúc bạn vui vẻ cùng BeenStore.`,
      allowedMentions: { users: [member.id] }
    }).catch(console.error);
  }
});

// XP: tối đa một lần mỗi thành viên trong 60 giây.
client.on(Events.MessageCreate, message => {
  if (!message.guild || message.author.bot || !message.content.trim()) return;
  const d = userData(message.guild.id, message.author.id);
  const now = Date.now();
  if (now - (d.lastXpAt || 0) < 60000) return;
  d.lastXpAt = now;
  d.xp += 15 + Math.floor(Math.random() * 11);
  const newLevel = Math.floor(Math.sqrt(d.xp / 100));
  if (newLevel > d.level) {
    d.level = newLevel;
    message.channel.send(`🎉 ${message.author} đã lên **Level ${newLevel}**!`).catch(() => {});
  }
  saveData();
});

client.on(Events.InteractionCreate, async i => {
  try {
    // Ticket buttons
    if (i.isButton() && i.customId === "bs_ticket_open") {
      if (!i.guild) return errorReply(i, "Ticket chỉ dùng trong server.");
      const current = Object.entries(data.tickets).find(([, t]) =>
        t.guildId === i.guildId && t.userId === i.user.id
      );
      if (current) {
        const existingChannel = await i.guild.channels.fetch(current[0]).catch(() => null);
        if (existingChannel) return errorReply(i, `Bạn đã có ticket: ${existingChannel}`);
        delete data.tickets[current[0]];
      }

      const overwrites = [
        { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
      ];
      if (process.env.SUPPORT_ROLE_ID) overwrites.push({
        id: process.env.SUPPORT_ROLE_ID,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });

      const channel = await i.guild.channels.create({
        name: `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90),
        type: ChannelType.GuildText,
        ...(process.env.TICKET_CATEGORY_ID ? { parent: process.env.TICKET_CATEGORY_ID } : {}),
        permissionOverwrites: overwrites
      });
      data.tickets[channel.id] = { guildId: i.guildId, userId: i.user.id, openedAt: Date.now() };
      saveData();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("bs_ticket_close").setLabel("Đóng ticket").setStyle(ButtonStyle.Danger)
      );
      await channel.send({
        content: `${i.user}${process.env.SUPPORT_ROLE_ID ? ` <@&${process.env.SUPPORT_ROLE_ID}>` : ""}\nVui lòng mô tả vấn đề bạn cần hỗ trợ.`,
        components: [closeRow],
        allowedMentions: { users: [i.user.id], roles: process.env.SUPPORT_ROLE_ID ? [process.env.SUPPORT_ROLE_ID] : [] }
      });
      return i.reply({ content: `Đã tạo ticket: ${channel}`, ephemeral: true });
    }

    if (i.isButton() && i.customId === "bs_ticket_close") {
      const ticket = data.tickets[i.channelId];
      if (!ticket) return errorReply(i, "Không tìm thấy thông tin ticket.");
      const isStaff = i.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
        (process.env.SUPPORT_ROLE_ID && i.member?.roles?.cache?.has(process.env.SUPPORT_ROLE_ID));
      if (ticket.userId !== i.user.id && !isStaff) return errorReply(i, "Bạn không có quyền đóng ticket.");
      await i.reply("Đang đóng ticket...");
      delete data.tickets[i.channelId];
      saveData();
      setTimeout(() => i.channel?.delete().catch(() => {}), 2500);
      return;
    }

    if (!i.isChatInputCommand()) return;
    const cmd = i.commandName;
    const guild = i.guild;

    if (["server","kick","ban","timeout","clear","ticket","rank","leaderboard","balance","daily","work","pay","shop","buy"].includes(cmd) && !guild) {
      return errorReply(i, "Lệnh này chỉ sử dụng trong server Discord.");
    }

    if (cmd === "ping") return i.reply(`🏓 Pong! Độ trễ WebSocket: ${client.ws.ping}ms`);
    if (cmd === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("BeenStore bot — Trợ giúp")
        .setDescription("Các lệnh slash có sẵn:")
        .addFields(
          { name: "Thông tin", value: "`/ping` `/help` `/server` `/userinfo`", inline: false },
          { name: "Quản lý", value: "`/kick` `/ban` `/timeout` `/clear`", inline: false },
          { name: "Ticket", value: "`/ticket` — đăng bảng tạo ticket", inline: false },
          { name: "Level", value: "`/rank` `/leaderboard type:XP`", inline: false },
          { name: "Economy", value: "`/balance` `/daily` `/work` `/pay` `/shop` `/buy`", inline: false },
          { name: "AI", value: "`/ask question:...` (cần API key)", inline: false }
        );
      return i.reply({ embeds: [embed], ephemeral: true });
    }

    if (cmd === "server") {
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: "Thành viên", value: String(guild.memberCount), inline: true },
          { name: "ID", value: guild.id, inline: true }
        );
      return i.reply({ embeds: [embed] });
    }

    if (cmd === "userinfo") {
      const u = i.options.getUser("user") || i.user;
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`Thông tin ${u.tag}`)
        .setThumbnail(u.displayAvatarURL())
        .addFields(
          { name: "ID", value: u.id },
          { name: "Tài khoản tạo lúc", value: `<t:${Math.floor(u.createdTimestamp / 1000)}:F>` }
        );
      return i.reply({ embeds: [embed] });
    }

    if (["kick","ban","timeout"].includes(cmd)) {
      const target = i.options.getUser("user", true);
      const reason = safeText(i.options.getString("reason") || `Thực hiện bởi ${i.user.tag}`, 400);
      if (target.id === i.user.id || target.id === guild.ownerId) return errorReply(i, "Không thể xử lý tài khoản này.");
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) return errorReply(i, "Không tìm thấy thành viên trong server.");
      if (member.id === client.user.id) return errorReply(i, "Bot không thể tự xử lý chính mình.");
      if (cmd === "kick") {
        if (!member.kickable) return errorReply(i, "Không thể kick: kiểm tra quyền và thứ tự role của bot.");
        await member.kick(reason);
      } else if (cmd === "ban") {
        if (!member.bannable) return errorReply(i, "Không thể ban: kiểm tra quyền và thứ tự role của bot.");
        await member.ban({ reason });
      } else {
        if (!member.moderatable) return errorReply(i, "Không thể timeout: kiểm tra quyền và thứ tự role của bot.");
        await member.timeout(i.options.getInteger("minutes", true) * 60000, reason);
      }
      return i.reply(`✅ Đã ${cmd === "kick" ? "kick" : cmd === "ban" ? "ban" : "timeout"} ${target.tag}.\nLý do: ${reason}`);
    }

    if (cmd === "clear") {
      const amount = i.options.getInteger("amount", true);
      const deleted = await i.channel.bulkDelete(amount, true);
      return i.reply({ content: `🧹 Đã xóa ${deleted.size} tin nhắn. Tin nhắn cũ hơn 14 ngày có thể không xóa được.`, ephemeral: true });
    }

    if (cmd === "ticket") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("bs_ticket_open").setLabel("Mở ticket hỗ trợ").setStyle(ButtonStyle.Primary).setEmoji("🎫")
      );
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle("BeenStore Support")
        .setDescription("Nhấn nút bên dưới để tạo một kênh hỗ trợ riêng tư. Chỉ bạn và đội hỗ trợ có thể xem.");
      return i.reply({ embeds: [embed], components: [row] });
    }

    if (cmd === "rank") {
      const u = i.options.getUser("user") || i.user;
      const d = userData(guild.id, u.id);
      return i.reply(`🏆 **${u.username}**\nLevel: **${d.level}**\nXP: **${d.xp}**`);
    }

    if (cmd === "leaderboard") {
      const type = i.options.getString("type") || "xp";
      const list = Object.entries(data.users)
        .filter(([key]) => key.startsWith(`${guild.id}:`))
        .map(([key, value]) => ({ id: key.split(":")[1], ...value }))
        .sort((a,b) => (b[type] || 0) - (a[type] || 0)).slice(0, 10);
      if (!list.length) return i.reply("Chưa có dữ liệu xếp hạng.");
      const lines = await Promise.all(list.map(async (u, n) => {
        const user = await client.users.fetch(u.id).catch(() => null);
        return `**${n + 1}.** ${user?.username || "Thành viên"} — ${u[type] || 0} ${type === "xp" ? "XP" : "coin"}`;
      }));
      return i.reply({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle(`BeenStore — Top ${type === "xp" ? "XP" : "Coin"}`).setDescription(lines.join("\n"))] });
    }

    if (cmd === "balance") {
      const u = i.options.getUser("user") || i.user;
      return i.reply(`🪙 ${u.username} đang có **${userData(guild.id, u.id).coins} coin**.`);
    }

    if (cmd === "daily") {
      const d = userData(guild.id, i.user.id);
      const remaining = 86400000 - (Date.now() - (d.dailyAt || 0));
      if (remaining > 0) return errorReply(i, `Bạn đã nhận daily. Thử lại sau khoảng ${Math.ceil(remaining / 3600000)} giờ.`);
      d.dailyAt = Date.now();
      d.coins += 250;
      saveData();
      return i.reply(`🎁 Bạn nhận **250 coin**! Số dư: **${d.coins} coin**.`);
    }

    if (cmd === "work") {
      const d = userData(guild.id, i.user.id);
      const remaining = 60000 - (Date.now() - (d.workAt || 0));
      if (remaining > 0) return errorReply(i, `Hãy chờ ${Math.ceil(remaining / 1000)} giây rồi làm tiếp.`);
      const earned = 50 + Math.floor(Math.random() * 101);
      d.workAt = Date.now();
      d.coins += earned;
      saveData();
      return i.reply(`💼 Bạn kiếm được **${earned} coin**. Số dư: **${d.coins} coin**.`);
    }

    if (cmd === "pay") {
      const target = i.options.getUser("user", true);
      const amount = i.options.getInteger("amount", true);
      if (target.bot || target.id === i.user.id) return errorReply(i, "Không thể chuyển coin cho tài khoản này.");
      const sender = userData(guild.id, i.user.id);
      if (sender.coins < amount) return errorReply(i, "Bạn không đủ coin.");
      sender.coins -= amount;
      userData(guild.id, target.id).coins += amount;
      saveData();
      return i.reply(`💸 Đã chuyển **${amount} coin** cho ${target.username}.`);
    }

    if (cmd === "shop") {
      const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle("🛍️ BeenStore Coin Shop")
        .setDescription("Dùng `/buy item:...` để mua vật phẩm.")
        .addFields(
          { name: "VIP màu xanh", value: "`vipblue` — 500 coin", inline: true },
          { name: "Huy hiệu BeenStore", value: "`badge` — 250 coin", inline: true }
        );
      return i.reply({ embeds: [embed] });
    }

    if (cmd === "buy") {
      const item = i.options.getString("item", true);
      const items = { vipblue: { name: "VIP màu xanh", price: 500 }, badge: { name: "Huy hiệu BeenStore", price: 250 } };
      const product = items[item];
      const d = userData(guild.id, i.user.id);
      if (d.inventory.includes(item)) return errorReply(i, "Bạn đã sở hữu vật phẩm này.");
      if (d.coins < product.price) return errorReply(i, `Bạn cần ${product.price} coin để mua vật phẩm này.`);
      d.coins -= product.price;
      d.inventory.push(item);
      saveData();
      return i.reply(`✅ Bạn đã mua **${product.name}** với ${product.price} coin. Số dư còn ${d.coins} coin.`);
    }

    if (cmd === "ask") {
      if (!process.env.AI_API_KEY) return errorReply(i, "AI chưa bật. Thêm AI_API_KEY trong Railway Variables.");
      await i.deferReply();
      const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Bạn là BeenStore AI, trợ lý thân thiện trong Discord. Trả lời bằng tiếng Việt, hữu ích và ngắn gọn." },
            { role: "user", content: i.options.getString("question", true) }
          ],
          max_tokens: 700
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        console.error("AI API error:", response.status, details.slice(0, 500));
        return i.editReply("AI API đang lỗi. Kiểm tra AI_API_KEY, AI_MODEL và hạn mức API.");
      }
      const result = await response.json();
      const answer = result.choices?.[0]?.message?.content || "AI chưa có câu trả lời.";
      return i.editReply({ content: String(answer).slice(0, 1900), allowedMentions: { parse: [] } });
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (i.isRepliable()) {
      const message = "Có lỗi khi xử lý lệnh. Hãy kiểm tra log Railway và quyền bot.";
      if (i.deferred || i.replied) await i.followUp({ content: message, ephemeral: true }).catch(() => {});
      else await i.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

client.on("error", err => console.error("Discord client error:", err));
process.on("unhandledRejection", err => console.error("Unhandled rejection:", err));
client.login(TOKEN);
