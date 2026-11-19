
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "openrouter/free";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `
You are JARVIS, an advanced personal AI assistant.

Your Telegram identity is Martian19, but your assistant name is JARVIS.

PERSONALITY:
- Intelligent, professional, calm and friendly.
- Inspired by a futuristic personal AI assistant.
- Address the user respectfully.
- Be proactive and practical.
- Never pretend to have capabilities you do not have.

LANGUAGE:
- Speak Egyptian Arabic when the user uses Arabic.
- Speak English when the user uses English.
- Understand both languages.
- Keep technical explanations simple when needed.

CAPABILITIES:
- Answer questions and explain complex subjects.
- Help with programming and technology.
- Write, translate and summarize.
- Help organize plans and tasks.
- Remember the conversation context provided to you.

IMPORTANT:
- Never claim you accessed a device, file or application unless you actually did.
- Never invent facts.
- Protect private information.
- Give clear and useful answers.
`;

const conversations = new Map();
const busyChats = new Set();

const MAX_HISTORY = 16;
const MAX_MESSAGE_LENGTH = 4000;

function getHistory(chatId) {
  return conversations.get(chatId) || [];
}

function splitMessage(text, max = MAX_MESSAGE_LENGTH) {
  const chunks = [];

  while (text.length > max) {
    let index = text.lastIndexOf("\n", max);

    if (index < max * 0.5) {
      index = text.lastIndexOf(" ", max);
    }

    if (index < max * 0.5) {
      index = max;
    }

    chunks.push(text.slice(0, index));
    text = text.slice(index).trimStart();
  }

  if (text.length) chunks.push(text);

  return chunks;
}

async function askAI(messages) {
  if (!API_KEY) {
    throw new Error("MISSING_API_KEY");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "JARVIS - Martian19"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1200
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(
      "[JARVIS API ERROR]",
      response.status,
      data.error?.message || "Unknown API error"
    );

    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }

    if (response.status === 401) {
      throw new Error("INVALID_API_KEY");
    }

    if (response.status === 402) {
      throw new Error("PAYMENT_REQUIRED");
    }

    throw new Error("API_ERROR");
  }

  const answer = data.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("EMPTY_RESPONSE");
  }

  return answer.trim();
}

async function sendLongMessage(ctx, text) {
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

export function registerCommands(bot) {

  // START
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "مرحباً! أنا JARVIS، مساعدك الشخصي الذكي. 🤖\n\n" +
      "أنا جاهز لمساعدتك بالعربية والإنجليزية.\n\n" +
      "اكتب /help لمعرفة الأوامر."
    );
  });

  // HELP
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🤖 JARVIS COMMAND CENTER\n\n" +
      "/start - تشغيل المساعد\n" +
      "/help - قائمة المساعدة\n" +
      "/ping - اختبار الاتصال\n" +
      "/reset - مسح ذاكرة المحادثة\n" +
      "/status - حالة المساعد\n\n" +
      "أرسل أي رسالة وسأحاول مساعدتك."
    );
  });

  // PING
  bot.command("ping", async (ctx) => {
    await ctx.reply("JARVIS ONLINE 🟢");
  });

  // STATUS
  bot.command("status", async (ctx) => {
    await ctx.reply(
      "JARVIS SYSTEM STATUS\n\n" +
      "Telegram: Connected 🟢\n" +
      "AI Key: " + (API_KEY ? "Configured 🟢" : "Missing 🔴") + "\n" +
      "Model: " + MODEL + "\n" +
      "Memory: Temporary 🟡"
    );
  });

  // RESET MEMORY
  bot.command("reset", async (ctx) => {
    conversations.delete(ctx.chat.id);

    await ctx.reply(
      "تم مسح ذاكرة محادثتنا الحالية.\n" +
      "نبدأ من جديد يا سيدي! 🧠"
    );
  });

  // AI CHAT
  bot.on("message:text", async (ctx) => {
    const userText = ctx.message.text.trim();
    const chatId = ctx.chat.id;

    // Ignore commands
    if (userText.startsWith("/")) return;

    if (!API_KEY) {
      await ctx.reply(
        "مفتاح OpenRouter غير موجود في إعدادات السيرفر."
      );
      return;
    }

    // Prevent overlapping requests in the same chat
    if (busyChats.has(chatId)) {
      await ctx.reply("لحظة واحدة يا سيدي، أعالج رسالتك السابقة.");
      return;
    }

    busyChats.add(chatId);

    try {
      await ctx.replyWithChatAction("typing");

      const history = getHistory(chatId);

      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        ...history,
        {
          role: "user",
          content: userText
        }
      ];

      const answer = await askAI(messages);

      conversations.set(
        chatId,
        [
          ...history,
          { role: "user", content: userText },
          { role: "assistant", content: answer }
        ].slice(-MAX_HISTORY)
      );

      await sendLongMessage(ctx, answer);

    } catch (error) {
      console.error("[JARVIS ERROR]", error.message);

      const errors = {
        MISSING_API_KEY:
          "مفتاح الذكاء الاصطناعي غير موجود.",

        INVALID_API_KEY:
          "مفتاح OpenRouter غير صحيح. راجع إعدادات المفتاح.",

        RATE_LIMIT:
          "وصلنا إلى حد الطلبات المجانية. حاول مرة أخرى لاحقاً.",

        PAYMENT_REQUIRED:
          "النموذج رفض الطلب بسبب قيود الحساب أو الرصيد.",

        EMPTY_RESPONSE:
          "لم يصلني رد من نموذج الذكاء الاصطناعي.",

        API_ERROR:
          "حدث خطأ في خدمة الذكاء الاصطناعي."
      };

      await ctx.reply(
        errors[error.message] ||
        "حدث خطأ غير متوقع. حاول مرة أخرى."
      );

    } finally {
      busyChats.delete(chatId);
    }
  });
}
