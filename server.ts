import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const WORKS_FILE = path.join(DATA_DIR, "works.json");
const DISCORD_FILE = path.join(DATA_DIR, "discord_verification.txt");

// Ensure the data directory and messages file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(WORKS_FILE)) {
  const defaultWorks = [
    {
      id: "w1",
      youtubeId: "Bq_0sZUpGyM",
      titleEn: "Vlogs & Lifestyle",
      titleAr: "فلوقات ولايف ستايل",
      descEn: "Dynamic Editing & Color Grading",
      descAr: "مونتاج ديناميكي وتنسيق ألوان سينمائي",
      category: "vlogs"
    },
    {
      id: "w2",
      youtubeId: "rgNccYqZ3Kg",
      titleEn: "Gaming Highlights",
      titleAr: "مقاطع الألعاب (قيمنق)",
      descEn: "High Pacing & Engaging SFX",
      descAr: "إيقاع سريع مع مؤثرات صوتية تفاعلية",
      category: "gaming"
    },
    {
      id: "w3",
      youtubeId: "XOO0BsXTfn0",
      titleEn: "Reaction Videos",
      titleAr: "مقاطع ردود الفعل (رياكشن)",
      descEn: "Engaging Cuts & Zoom Effects",
      descAr: "قصات مشوقة وتأثيرات زووم مستمرة",
      category: "reaction"
    },
    {
      id: "w4",
      youtubeId: "xP1iEmdN9js",
      titleEn: "Documentary Video",
      titleAr: "أفلام وثائقية وثقافية",
      descEn: "Storytelling & Historical Archives",
      descAr: "سرد قصصي وبحث وثائقي وأرشيف متكامل",
      category: "documentary"
    },
    {
      id: "w5",
      youtubeId: "7ToHXV4vj6c",
      titleEn: "Cinematic Stories",
      titleAr: "قصص وتجارب سينمائية",
      descEn: "Emotional Narrative & Visual Flow",
      descAr: "تسلسل بصري غامر وتدفق عاطفي عميق",
      category: "stories"
    }
  ];
  fs.writeFileSync(WORKS_FILE, JSON.stringify(defaultWorks, null, 2));
}

// Middleware
app.use(express.json());

// Interface for Message
interface Message {
  id: string;
  name: string;
  contactInfo: string;
  message: string;
  createdAt: string;
  status: "new" | "replied" | "archived";
  adminNotes?: string;
  replyText?: string;
  repliedAt?: string;
}

// Helpers for Reading/Writing Messages
function readMessages(): Message[] {
  try {
    const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading messages file:", error);
    return [];
  }
}

function writeMessages(messages: Message[]) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error("Error writing messages file:", error);
  }
}

function extractYoutubeId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  // Regular expression to extract the ID from various YouTube URL formats
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  if (trimmed.length === 11) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const v = url.searchParams.get("v");
    if (v && v.length === 11) {
      return v;
    }
  } catch (e) {
    // ignore
  }
  return trimmed;
}

// Helpers for Reading/Writing Works
function readWorks(): any[] {
  try {
    const data = fs.readFileSync(WORKS_FILE, "utf-8");
    const works = JSON.parse(data);
    let modified = false;
    const sanitizedWorks = works.map((w: any) => {
      const sanitizedId = extractYoutubeId(w.youtubeId);
      if (sanitizedId !== w.youtubeId) {
        modified = true;
        return { ...w, youtubeId: sanitizedId };
      }
      return w;
    });

    if (modified) {
      writeWorks(sanitizedWorks);
    }
    return sanitizedWorks;
  } catch (error) {
    console.error("Error reading works file:", error);
    return [];
  }
}

function writeWorks(works: any[]) {
  try {
    fs.writeFileSync(WORKS_FILE, JSON.stringify(works, null, 2));
  } catch (error) {
    console.error("Error writing works file:", error);
  }
}

// Email Transporter Config
function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
}

// Send Instant Email Notification
async function sendEmailNotification(msg: Message) {
  const adminEmail = process.env.ADMIN_EMAIL || "chattivon@gmail.com";
  const transporter = getMailTransporter();
  const dashboardUrl = process.env.APP_URL ? `${process.env.APP_URL}/#admin` : "http://localhost:3000/#admin";

  const emailSubject = `🔔 رسالة جديدة من: ${msg.name}`;
  const emailText = `
لقد تلقيت رسالة جديدة من نموذج الاتصال في موقعك الشخصي:

الاسم: ${msg.name}
وسيلة الاتصال: ${msg.contactInfo}
تاريخ الرسالة: ${new Date(msg.createdAt).toLocaleString("ar-SA")}

الرسالة:
"${msg.message}"

---
لإدارة هذه الرسالة وإرسال رد، يرجى الانتقال إلى لوحة التحكم:
${dashboardUrl}
  `;

  const emailHtml = `
    <div dir="rtl" style="font-family: 'Cairo', sans-serif; padding: 20px; background-color: #f9fafb; border-radius: 12px; max-width: 600px; margin: auto; border: 1px solid #e5e7eb;">
      <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0;">🔔 رسالة جديدة واردة</h2>
      <p style="font-size: 1.1rem; color: #1f2937;">لقد تلقيت رسالة جديدة عبر موقعك الشخصي:</p>
      
      <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
        <p style="margin: 5px 0;"><strong>👤 المرسل:</strong> ${msg.name}</p>
        <p style="margin: 5px 0;"><strong>📞 الاتصال:</strong> <a href="mailto:${msg.contactInfo}" style="color: #3b82f6; text-decoration: none;">${msg.contactInfo}</a></p>
        <p style="margin: 5px 0; color: #6b7280; font-size: 0.9rem;"><strong>📅 التاريخ:</strong> ${new Date(msg.createdAt).toLocaleString("ar-SA")}</p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-style: italic; color: #374151; margin-bottom: 20px; white-space: pre-wrap;">
        "${msg.message}"
      </div>

      <div style="text-align: center;">
        <a href="${dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.4);">
          فتح لوحة التحكم 🔒
        </a>
      </div>
    </div>
  `;

  if (!transporter) {
    console.log("==========================================");
    console.log("📨 [Notification Simulated Email]");
    console.log(`To: ${adminEmail}`);
    console.log(`Subject: ${emailSubject}`);
    console.log("Content:", emailText.trim());
    console.log("==========================================");
    console.log("⚠️ To receive real-time email notifications, please specify SMTP_USER and SMTP_PASS in the environment variables.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"موقع أنس" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });
    console.log(`✅ Email notification sent successfully to ${adminEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send email notification via SMTP:", error);
    return false;
  }
}

// Authentication Middleware
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const password = process.env.ADMIN_PASSWORD || "chatti17";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  if (token !== password) {
    return res.status(401).json({ error: "Invalid password" });
  }

  next();
}

// API Routes

// 1. Submit a Message (Public)
app.post("/api/messages", async (req, res) => {
  const { name, contactInfo, message } = req.body;

  if (!name || !contactInfo || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const newMessage: Message = {
    id: "msg_" + Math.random().toString(36).substr(2, 9),
    name: name.trim(),
    contactInfo: contactInfo.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    status: "new",
  };

  const messages = readMessages();
  messages.unshift(newMessage);
  writeMessages(messages);

  // Trigger instant email notification asynchronously
  const emailSent = await sendEmailNotification(newMessage);

  res.status(201).json({
    success: true,
    message: "Message received successfully",
    data: newMessage,
    emailSent,
  });
});

// 2. Admin Login (Public)
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || "chatti17";

  if (password === adminPassword) {
    res.json({ success: true, token: adminPassword });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});

// 3. Get API / Email Status for Dashboard (Admin Only)
app.get("/api/admin/status", adminAuth, (req, res) => {
  const smtpUser = process.env.SMTP_USER || "";
  const adminEmail = process.env.ADMIN_EMAIL || "chattivon@gmail.com";
  
  res.json({
    smtpConfigured: !!smtpUser,
    smtpUser: smtpUser || null,
    adminEmail,
  });
});

// 4. Get All Messages (Admin Only)
app.get("/api/admin/messages", adminAuth, (req, res) => {
  const messages = readMessages();
  res.json(messages);
});

// 5. Update Message Status / Add Reply / Admin Notes (Admin Only)
app.patch("/api/admin/messages/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, replyText } = req.body;

  const messages = readMessages();
  const index = messages.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Message not found" });
  }

  const updatedMessage = { ...messages[index] };

  if (status !== undefined) updatedMessage.status = status;
  if (adminNotes !== undefined) updatedMessage.adminNotes = adminNotes;
  if (replyText !== undefined) {
    updatedMessage.replyText = replyText;
    updatedMessage.repliedAt = new Date().toISOString();
    updatedMessage.status = "replied";
  }

  messages[index] = updatedMessage;
  writeMessages(messages);

  res.json({ success: true, data: updatedMessage });
});

// 6. Delete a Message (Admin Only)
app.delete("/api/admin/messages/:id", adminAuth, (req, res) => {
  const { id } = req.params;

  const messages = readMessages();
  const filtered = messages.filter((m) => m.id !== id);

  if (messages.length === filtered.length) {
    return res.status(404).json({ error: "Message not found" });
  }

  writeMessages(filtered);
  res.json({ success: true, message: "Message deleted successfully" });
});

// 7. Get All Works (Public)
app.get("/api/works", (req, res) => {
  const works = readWorks();
  res.json(works);
});

// 8. Add a Work (Admin Only)
app.post("/api/admin/works", adminAuth, (req, res) => {
  const { youtubeId, titleEn, titleAr, descEn, descAr, category } = req.body;

  if (!youtubeId || !titleEn || !titleAr || !descEn || !descAr || !category) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sanitizedYoutubeId = extractYoutubeId(youtubeId);

  const newWork = {
    id: "work_" + Math.random().toString(36).substr(2, 9),
    youtubeId: sanitizedYoutubeId,
    titleEn: titleEn.trim(),
    titleAr: titleAr.trim(),
    descEn: descEn.trim(),
    descAr: descAr.trim(),
    category: category.trim()
  };

  const works = readWorks();
  works.push(newWork);
  writeWorks(works);

  res.status(201).json({ success: true, data: newWork });
});

// 9. Delete a Work (Admin Only)
app.delete("/api/admin/works/:id", adminAuth, (req, res) => {
  const { id } = req.params;

  const works = readWorks();
  const filtered = works.filter((w) => w.id !== id);

  if (works.length === filtered.length) {
    return res.status(404).json({ error: "Work item not found" });
  }

  writeWorks(filtered);
  res.json({ success: true, message: "Work item deleted successfully" });
});

// 10. Discord Verification (Public Endpoint)
app.get("/.well-known/discord", (req, res) => {
  if (fs.existsSync(DISCORD_FILE)) {
    const content = fs.readFileSync(DISCORD_FILE, "utf-8");
    res.setHeader("Content-Type", "text/plain");
    return res.send(content.trim());
  }
  res.status(404).send("Not Found");
});

app.get("/well-known/discord", (req, res) => {
  res.redirect("/.well-known/discord");
});

// 11. Get Discord Verification Content (Admin Only)
app.get("/api/admin/discord-verification", adminAuth, (req, res) => {
  let content = "";
  if (fs.existsSync(DISCORD_FILE)) {
    content = fs.readFileSync(DISCORD_FILE, "utf-8");
  }
  res.json({ content });
});

// 12. Save Discord Verification Content (Admin Only)
app.post("/api/admin/discord-verification", adminAuth, (req, res) => {
  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ error: "Content field is required" });
  }
  try {
    fs.writeFileSync(DISCORD_FILE, content.trim(), "utf-8");
    res.json({ success: true, message: "Discord verification updated successfully" });
  } catch (err) {
    console.error("Error saving discord verification:", err);
    res.status(500).json({ error: "Failed to save verification file" });
  }
});

// Vite Middleware for Development / Static serving for Production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from dist/");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
