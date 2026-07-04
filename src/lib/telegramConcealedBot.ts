import TelegramBot from 'node-telegram-bot-api';

let botInstance: TelegramBot | null = null;

export function initConcealedBot(io?: any) {
    // جلب التوكن ومعرف المجموعة بأمان من إعدادات جوجل AI Studio السريّة
    const token = process.env.TELEGRAM_BOT_TOKEN; // Changed to match .env.example
    const allowedGroupId = process.env.ALLOWED_GROUP_ID ? parseInt(process.env.ALLOWED_GROUP_ID) : null;

    if (!token) {
        console.error("خطأ: لم يتم العثور على TELEGRAM_BOT_TOKEN في إعدادات البيئة لـ AI Studio");
        return;
    }

    if (botInstance) {
        try {
            botInstance.stopPolling();
        } catch(e) {}
    }

    // تشغيل البوت بنظام الـ Polling للتواصل المستمر مع تليجرام
    const bot = new TelegramBot(token, { 
        polling: {
            interval: 2000, // Increased interval to reduce conflicts
            autoStart: false,
            params: {
                timeout: 10
            }
        }
    });
    
    botInstance = bot;

    bot.deleteWebHook().then(() => {
        bot.startPolling();
        console.log("تم تشغيل بوت التليجرام بنجاح...");
    }).catch(e => {
        console.error("Error starting polling:", e.message);
    });

    // الاستماع لجميع أنواع الرسائل والميديا الواردة في المجموعة
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const messageId = msg.message_id;

        // Emit to socket.io if we received io
        if (io) {
            try {
                const socketMsg: any = {
                    content: msg.text || msg.caption || "",
                    sender: msg.from?.first_name || "مستخدم"
                };

                if (msg.photo) {
                    const photoArray = msg.photo;
                    const bestPhoto = photoArray[photoArray.length - 1]; // Get largest
                    const fileId = bestPhoto.file_id;
                    try {
                        const fileLink = await bot.getFileLink(fileId);
                        socketMsg.image = fileLink;
                    } catch (e) {
                        console.error('Error getting Telegram file link:', e);
                    }
                }
                io.emit('chatMessage', socketMsg);
            } catch (error) {
                console.error("خطأ في إرسال رسالة التليجرام عبر socket.io:", error);
            }
        }

        // التأكد من أن الرسالة قادمة من مجموعة الشركة المحددة حصراً وليست من بوت آخر للتخفي
        if (allowedGroupId && msg.chat.id === allowedGroupId && (!msg.from || !msg.from.is_bot)) {
            try {
                // 1. التعامل مع الرسائل النصية العادية
                if (msg.text) {
                    await bot.sendMessage(chatId, msg.text);
                }
                // 2. التعامل مع الصور واللقطات مع الحفاظ على الشرح (Caption)
                else if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id;
                    await bot.sendPhoto(chatId, photoId, { caption: msg.caption });
                }
                // 3. التعامل مع مقاطع الفيديو
                else if (msg.video) {
                    await bot.sendVideo(chatId, msg.video.file_id, { caption: msg.caption });
                }
                // 4. التعامل مع الرسائل الصوتية (الفويس)
                else if (msg.voice) {
                    await bot.sendVoice(chatId, msg.voice.file_id);
                }
                // 5. التعامل مع الملفات والمستندات بجميع أنواعها
                else if (msg.document) {
                    await bot.sendDocument(chatId, msg.document.file_id, { caption: msg.caption });
                }

                // خطوة الأمان والتخفي: حذف رسالة الموظف الأصلية فوراً بعد إعادة إرسالها باسم البوت
                await bot.deleteMessage(chatId, messageId);

            } catch (error) {
                // التقاط الأخطاء لمنع توقف سيرفر تطبيق إدارة الشركات الأساسي
                console.error("حدث خطأ أثناء معالجة رسالة التليجرام المتخفية:", error);
            }
        }
    });

    // معالجة أخطاء الاتصال تلقائياً لضمان بقاء البوت حياً 24 ساعة دون انقطاع
    bot.on('polling_error', (error: any) => {
        if (error.code === 'EFATAL' || (error.message && error.message.includes('409 Conflict'))) {
            // Suppress the 409 error log to reduce noise if multiple instances are running (e.g., dev + prod)
        } else {
            console.error("خطأ في اتصال البوت (Polling Error):", error.message || error);
        }
    });
}
