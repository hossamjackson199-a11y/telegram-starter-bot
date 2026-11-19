
import { InlineKeyboard } from "grammy"

const API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = "openrouter/free"

// ذاكرة مؤقتة لكل محادثة
const conversations = new Map()

const SYSTEM_PROMPT = `
You are JARVIS, a highly intelligent personal AI assistant.
Your Telegram bot name is Martian19.
Speak Arabic when the user speaks Arabic, and English when they speak English.
Use natural Egyptian Arabic when appropriate.
Be helpful, intelligent, respectful, concise and friendly.
You can help with technology, planning, research and everyday tasks.
Never claim you performed an action unless you actually did it.
`

export function registerCommands(bot) {
  bot.command("start", (ctx) =>
    ctx.reply(
      "أهلاً بك! أنا JARVIS، مساعدك الذكي. 🤖\n\nاسألني أي سؤال بالعربي أو الإنجليزي.",
      {
        reply_markup: new InlineKeyboard().text("اختبرني 🚀", "ping"),
      },
    ),
  )

  bot.command("help", (ctx) =>
    ctx.reply(
      "أوامر JARVIS:\n/start تشغيل البوت\n/help المساعدة\n/ping اختبار الاتصال\n/reset مسح ذاكرة المحادثة\n\nأرسل لي أي سؤال وسأجيبك بالذكاء الاصطناعي."
    ),
  )

  bot.command("ping", (ctx) => ctx.reply("I'm online, sir. 🟢"))

  bot.command("reset", (ctx) => {
    conversations.delete(ctx.chat.id)
    return ctx.reply("تم مسح ذاكرة المحادثة. نبدأ من جديد! 🧠")
  })

  bot.callbackQuery("ping", async (ctx) => {
    await ctx.answerCallbackQuery({ text: "JARVIS online!" })
    await ctx.reply("أنا جاهز يا سيدي! 🚀")
  })

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text

    if (text.startsWith("/")) return

    if (!API_KEY) {
      return ctx.reply("مفتاح الذكاء الاصطناعي غير موجود في إعدادات السيرفر.")
    }

    await ctx.replyWithChatAction("typing")

    const chatId = ctx.chat.id
    const history = conversations.get(chatId) || []

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: text },
    ]

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "X-Title": "JARVIS Martian19",
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        console.error("[AI] API error:", response.status, data)
        return ctx.reply(
          response.status === 429
            ? "وصلنا لحد الاستخدام المجاني مؤقتاً. حاول بعد قليل."
            : "حصلت مشكلة في الاتصال بعقل JARVIS. حاول مرة أخرى."
        )
      }

      const answer = data.choices?.[0]?.message?.content

      if (!answer || typeof answer !== "string") {
        return ctx.reply("لم يصلني رد واضح من نموذج الذكاء الاصطناعي.")
      }

      conversations.set(chatId, [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: answer },
      ].slice(-12))

      await ctx.reply(answer.slice(0, 4000))

    } catch (error) {
      console.error("[AI] Connection error:", error)
      await ctx.reply("تعذر الاتصال بالذكاء الاصطناعي. حاول مرة أخرى.")
    }
  })
}
