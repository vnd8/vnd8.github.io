import React, { useState } from "react";
import { 
  Play, 
  Mail, 
  Send, 
  MessageCircle, 
  Globe, 
  Video, 
  Sparkles, 
  Volume2, 
  BookOpen, 
  Check, 
  Copy, 
  ChevronRight,
  ExternalLink,
  Lock
} from "lucide-react";
import { translations } from "../translations";
import { WorkItem, ServiceItem } from "../types";

interface PortfolioProps {
  currentLang: "en" | "ar";
  toggleLang: () => void;
  onNavigateToAdmin: () => void;
}

export default function Portfolio({ currentLang, toggleLang, onNavigateToAdmin }: PortfolioProps) {
  const t = translations[currentLang];
  const isRtl = currentLang === "ar";

  // Form State
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Contact Panel open state
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [copiedEmail, setCopiedEmail] = useState(false);

  // Video Works Data
  const works: WorkItem[] = [
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

  // Filtered Works
  const filteredWorks = activeCategory === "all" 
    ? works 
    : works.filter(w => w.category === activeCategory);

  // Services Data
  const services: ServiceItem[] = [
    {
      icon: "🎬",
      titleEn: "Video Editing",
      titleAr: "تحرير الفيديو (مونتاج)",
      descEn: "High-end editing for documentaries, YouTube videos, and social media platforms with strict attention to retention metrics.",
      descAr: "مونتاج احترافي وعالي الجودة للوثائقيات وقنوات اليوتيوب ومنصات التواصل، مع التركيز على زيادة نسبة بقاء المشاهد."
    },
    {
      icon: "✨",
      titleEn: "Motion Design",
      titleAr: "موشن ديزاين ورسومات",
      descEn: "Engaging kinetic typography, transition designs, and asset animations to elevate production value.",
      descAr: "تحريك نصوص حركية (Kinetic Typography)، وتصميم انتقالات مخصصة ترفع من القيمة الإنتاجية للفيديو."
    },
    {
      icon: "🎙️",
      titleEn: "Audio Engineering",
      titleAr: "هندسة وتصميم صوتي",
      descEn: "Professional sound design, clean dialogue noise reduction, sound effects, and volume mastering.",
      descAr: "تصميم وهندسة صوتية متكاملة، عزل وتنقية الضجيج، إضافة مؤثرات صوتية احترافية، وموازنة الصوت للبودكاست."
    },
    {
      icon: "📜",
      titleEn: "Content Strategy",
      titleAr: "استراتيجية وصناعة محتوى",
      descEn: "Visual storyboarding, custom pacing schemes, and script advice to hook your audience from second one.",
      descAr: "تخطيط السيناريو (Storyboarding)، تحديد سرعة تدفق الإيقاع البصري، لضمان جذب الجمهور من الثانية الأولى."
    }
  ];

  const tools = [
    { name: "Premiere", short: "Pr", class: "bg-linear-to-br from-[#300059] to-[#Ea77ff] border-[#Ea77ff]" },
    { name: "After Effects", short: "Ae", class: "bg-linear-to-br from-[#00005b] to-[#9999ff] border-[#9999ff]" },
    { name: "Photoshop", short: "Ps", class: "bg-linear-to-br from-[#001e36] to-[#31a8ff] border-[#31a8ff]" },
    { name: "Illustrator", short: "Ai", class: "bg-linear-to-br from-[#330000] to-[#ff9a00] border-[#ff9a00]" },
    { name: "DaVinci", short: "Da", class: "bg-linear-to-br from-[#1a1a1a] to-[#ff4b4b] border-[#ff4b4b]" }
  ];

  // Email copying action
  const copyEmail = () => {
    navigator.clipboard.writeText("chattivon@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Form Submission
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim() || !message.trim()) {
      setStatusMsg({
        type: "error",
        text: currentLang === "ar" ? "يرجى ملء جميع الحقول المطلوبة!" : "Please fill in all required fields!"
      });
      return;
    }

    setIsSending(true);
    setStatusMsg(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, contactInfo: contact, message }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatusMsg({
          type: "success",
          text: t.contactSuccess
        });
        setName("");
        setContact("");
        setMessage("");
        
        // Auto close contact form after success
        setTimeout(() => {
          setIsContactOpen(false);
          setStatusMsg(null);
        }, 4000);
      } else {
        setStatusMsg({
          type: "error",
          text: data.error || t.contactError
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setStatusMsg({
        type: "error",
        text: t.contactError
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative min-height-screen overflow-x-hidden font-sans pb-16" dir={isRtl ? "rtl" : "ltr"}>
      {/* Ambient glowing blobs */}
      <div className="fixed -top-1/2 -left-1/2 w-[200vw] h-[200vw] z-[-1] pointer-events-none">
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 blur-[100px] animate-pulse duration-10000"></div>
        <div className="absolute top-[60%] left-[55%] w-[35vw] h-[35vw] rounded-full bg-purple-500/10 blur-[120px] animate-pulse duration-8000"></div>
      </div>

      {/* Floating navigation header */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50">
        <nav className="flex justify-between items-center px-6 py-3.5 rounded-full bg-neutral-900/60 backdrop-blur-xl border border-white/5 shadow-2xl">
          <a href="#" className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
            {t.logo}
            <span className="text-blue-500 font-bold">{t.dot}</span>
          </a>

          <ul className="hidden md:flex items-center gap-8 list-none">
            <li>
              <a href="#about" className="text-sm font-medium text-neutral-400 hover:text-white transition duration-300">
                {t.navAbout}
              </a>
            </li>
            <li>
              <a href="#works" className="text-sm font-medium text-neutral-400 hover:text-white transition duration-300">
                {t.navWorks}
              </a>
            </li>
            <li>
              <a href="#services" className="text-sm font-medium text-neutral-400 hover:text-white transition duration-300">
                {t.navServices}
              </a>
            </li>
            <li>
              <button 
                onClick={() => setIsContactOpen(true)}
                className="text-sm font-medium text-neutral-400 hover:text-white transition duration-300 cursor-pointer bg-transparent border-none"
              >
                {t.navContact}
              </button>
            </li>
          </ul>

          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <button 
              onClick={toggleLang}
              className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition duration-300 cursor-pointer flex items-center gap-1.5"
            >
              <Globe size={13} />
              {currentLang === "en" ? "AR" : "EN"}
            </button>

            {/* Direct Admin Login Button */}
            <button
              onClick={onNavigateToAdmin}
              className="p-2 rounded-full bg-white/5 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-white/10 hover:border-blue-500/30 transition duration-300 cursor-pointer"
              title={t.navAdmin}
            >
              <Lock size={14} />
            </button>
          </div>
        </nav>
      </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-32 md:pt-40">
        
        {/* Section 1: Hero & Bio Widget Grid */}
        <section id="about" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          
          {/* Main Hero Showcase */}
          <div className="lg:col-span-2 glass-effect rounded-[32px] p-8 md:p-12 flex flex-col justify-center items-start relative overflow-hidden group">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-300 text-xs font-semibold border border-blue-500/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              {t.badgeAvailable}
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-6 tracking-tight">
              {t.heroTitlePart1} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                {t.heroTitlePart2}
              </span>
            </h1>

            <p className="text-neutral-400 text-base md:text-lg max-w-xl leading-relaxed mb-8">
              {t.heroDesc}
            </p>

            <div className="flex flex-wrap gap-4 w-full sm:w-auto">
              <a 
                href="#works" 
                className="w-full sm:w-auto text-center px-8 py-4 rounded-full bg-white hover:bg-neutral-100 text-black font-semibold shadow-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
              >
                {t.exploreBtn}
              </a>
              <button 
                onClick={() => setIsContactOpen(true)}
                className="w-full sm:w-auto text-center px-8 py-4 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white font-semibold border border-white/10 transition-all duration-300 hover:scale-[1.03]"
              >
                {t.navContact}
              </button>
            </div>
          </div>

          {/* Anes Bio Card */}
          <div className="glass-effect rounded-[32px] p-8 flex flex-col justify-between items-center text-center relative overflow-hidden">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-1 mb-6 relative group shadow-2xl">
              <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">A</span>
              </div>
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight">
                {t.widgetTitle}
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-xs mx-auto">
                {t.widgetDesc}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 w-full">
              <div className="text-xs text-neutral-500 uppercase tracking-widest mb-3">
                {currentLang === "ar" ? "تواصل مباشر" : "Direct Contact"}
              </div>
              <button 
                onClick={copyEmail}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/5 transition duration-300 cursor-pointer flex items-center justify-center gap-2"
              >
                {copiedEmail ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-neutral-400" />}
                {copiedEmail ? t.copiedToClipboard : "chattivon@gmail.com"}
              </button>
            </div>
          </div>

        </section>

        {/* Section 2: Tools Dock Section */}
        <section className="mb-20">
          <div className="glass-effect rounded-[28px] p-6 flex flex-wrap justify-center items-center gap-4 md:gap-8">
            {tools.map((tool) => (
              <div 
                key={tool.name} 
                className={`flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl border ${tool.class} transition-all duration-500 hover:scale-110 shadow-lg cursor-default group`}
              >
                <span className="text-2xl md:text-3xl font-black text-white">{tool.short}</span>
                <span className="text-[10px] md:text-xs font-medium text-white/60 mt-1 opacity-80 group-hover:opacity-100 transition duration-300">{tool.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Portfolio Video Grid */}
        <section id="works" className="mb-24 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <span className="w-2 h-6 rounded-full bg-blue-500"></span>
                {t.featuredWorks}
              </h2>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
              {["all", "vlogs", "gaming", "reaction", "documentary", "stories"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer transition-all duration-300 ${
                    activeCategory === cat 
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20" 
                      : "bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {t[`cat${cat.charAt(0).toUpperCase() + cat.slice(1)}` as keyof typeof t] || cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorks.map((work) => {
              const videoUrl = `https://www.youtube.com/watch?v=${work.youtubeId}`;
              return (
                <div 
                  key={work.id}
                  onClick={() => window.open(videoUrl, "_blank")}
                  className="glass-effect rounded-[24px] p-4 cursor-pointer transition-all duration-300 hover:translate-y-[-6px] hover:bg-white/5 hover:border-white/15 shadow-xl group"
                >
                  <div className="w-full aspect-video rounded-2xl overflow-hidden relative mb-4 shadow-inner border border-white/5 bg-neutral-950">
                    <img 
                      src={`https://img.youtube.com/vi/${work.youtubeId}/hqdefault.jpg`} 
                      alt={currentLang === "ar" ? work.titleAr : work.titleEn} 
                      className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-14 h-14 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 transform scale-90 group-hover:scale-100 transition-all duration-500">
                        <Play size={24} className="text-white fill-white ml-1 rtl:mr-1 rtl:ml-0" />
                      </div>
                    </div>
                  </div>

                  <div className="px-1 flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white mb-1 group-hover:text-blue-300 transition duration-300">
                        {currentLang === "ar" ? work.titleAr : work.titleEn}
                      </h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {currentLang === "ar" ? work.descAr : work.descEn}
                      </p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/5 text-neutral-400 group-hover:text-white group-hover:bg-blue-600/10 transition duration-300 mt-1">
                      <ExternalLink size={14} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Premium Services Grid */}
        <section id="services" className="mb-24 scroll-mt-24">
          <div className="mb-10 text-center md:text-start">
            <h2 className="text-3xl font-black tracking-tight flex items-center justify-center md:justify-start gap-3">
              <span className="w-2 h-6 rounded-full bg-gradient-to-b from-blue-500 to-purple-500"></span>
              {t.premiumServices}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((srv, idx) => (
              <div 
                key={idx}
                className="glass-effect rounded-[24px] p-8 text-center transition-all duration-300 hover:translate-y-[-4px] hover:bg-white/5 shadow-lg flex flex-col items-center"
              >
                <span className="text-4xl mb-6 inline-block bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                  {srv.icon}
                </span>
                <h3 className="font-bold text-lg mb-3 tracking-tight text-white">
                  {currentLang === "ar" ? srv.titleAr : srv.titleEn}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed text-center">
                  {currentLang === "ar" ? srv.descAr : srv.descEn}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Area */}
      <footer className="border-t border-white/5 bg-neutral-950/40 backdrop-blur-md pt-16 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight">
            {t.letsWorkTogether}
          </h2>
          <p className="text-lg text-blue-400 hover:text-blue-300 font-medium transition duration-300 mb-8 cursor-pointer" onClick={copyEmail}>
            chattivon@gmail.com
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <a 
              href="https://x.com/vnd8d" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white font-semibold text-sm border border-white/10 transition duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X / Twitter
            </a>
            <a 
              href="https://www.instagram.com/vnd8d/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 hover:from-orange-500/20 hover:to-purple-500/20 text-white font-semibold text-sm border border-pink-500/20 transition duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
            <a 
              href="https://www.youtube.com/@vnd8d" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-red-600/10 hover:bg-red-600/20 text-white font-semibold text-sm border border-red-500/20 transition duration-300 flex items-center gap-2"
            >
              <Video size={15} />
              YouTube
            </a>
            <a 
              href="https://wa.me/213555952379" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-full bg-emerald-600/10 hover:bg-emerald-600/20 text-white font-semibold text-sm border border-emerald-500/20 transition duration-300 flex items-center gap-2"
            >
              <MessageCircle size={15} />
              WhatsApp
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-8 text-neutral-500 text-xs">
            <p className="mb-4 sm:mb-0">
              {t.allRightsReserved}
            </p>
            <button 
              onClick={onNavigateToAdmin}
              className="text-neutral-500 hover:text-white transition cursor-pointer text-xs flex items-center gap-1 bg-transparent border-none"
            >
              {t.adminLink}
            </button>
          </div>
        </div>
      </footer>

      {/* FLOATING ACTION WIDGETS */}

      {/* Contact Widget Floating Action Button (FAB) */}
      <div className={`fixed bottom-6 ${isRtl ? "left-6" : "right-6"} z-40 md:bottom-8 md:${isRtl ? "left-8" : "right-8"}`}>
        <button 
          onClick={() => setIsContactOpen(!isContactOpen)}
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 text-white shadow-2xl flex items-center justify-center border-2 border-white/20 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
          title={t.contactTitle}
        >
          <Mail size={26} className="animate-pulse" />
        </button>
      </div>

      {/* Interactive Contact Window Sidebar Overlay */}
      {isContactOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end items-stretch transition duration-300">
          {/* Backdrop Close Click area */}
          <div className="flex-1" onClick={() => setIsContactOpen(false)}></div>
          
          {/* Form container slide-in */}
          <div className="w-full max-w-md bg-neutral-950/95 border-l border-white/10 p-8 flex flex-col justify-between shadow-2xl relative overflow-y-auto animate-slide-in">
            <div>
              <div className="flex justify-between items-center pb-6 border-b border-white/5 mb-8">
                <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  {t.contactTitle}
                </h3>
                <button 
                  onClick={() => setIsContactOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border-none cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              {statusMsg && (
                <div 
                  className={`p-4 rounded-xl text-xs font-semibold mb-6 ${
                    statusMsg.type === "success" 
                      ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              <form onSubmit={handleSubmitMessage} className="space-y-4">
                <div>
                  <label className="block text-xs text-neutral-400 font-semibold mb-1.5 uppercase tracking-wider">
                    {currentLang === "ar" ? "الاسم" : "Your Name"}
                  </label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.placeholderName}
                    required
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 font-semibold mb-1.5 uppercase tracking-wider">
                    {currentLang === "ar" ? "رقم الجوال أو الإيميل للرد" : "Contact Information"}
                  </label>
                  <input 
                    type="text" 
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t.placeholderContact}
                    required
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/10 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 font-semibold mb-1.5 uppercase tracking-wider">
                    {currentLang === "ar" ? "تفاصيل طلبك" : "Message details"}
                  </label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.placeholderMessage}
                    required
                    rows={4}
                    className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3.5 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/10 transition resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  disabled={isSending}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/10 transition duration-300 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={15} />
                  {isSending ? t.sending : t.sendBtn}
                </button>
              </form>
            </div>

            <div className="pt-6 border-t border-white/5 mt-8">
              <a 
                href="https://wa.me/213555952379"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/20 transition duration-300 flex items-center justify-center gap-2"
              >
                <MessageCircle size={15} />
                {t.whatsappBtn}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
