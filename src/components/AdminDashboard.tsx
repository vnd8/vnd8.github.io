import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Unlock, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Archive, 
  RotateCcw,
  BookOpen, 
  FileText, 
  Send, 
  ArrowLeft, 
  Server,
  Mail,
  Search,
  Check,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  Globe
} from "lucide-react";
import { translations } from "../translations";
import { Message, SMTPStatus } from "../types";

interface AdminDashboardProps {
  currentLang: "en" | "ar";
  toggleLang: () => void;
  onBackToPortfolio: () => void;
}

export default function AdminDashboard({ currentLang, toggleLang, onBackToPortfolio }: AdminDashboardProps) {
  const t = translations[currentLang];
  const isRtl = currentLang === "ar";

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState(false);

  // Data State
  const [messages, setMessages] = useState<Message[]>([]);
  const [smtpStatus, setSmtpStatus] = useState<SMTPStatus>({
    smtpConfigured: false,
    smtpUser: null,
    adminEmail: "chattivon@gmail.com",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "replied" | "archived">("all");

  // Selected Message detailed view state
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  
  // Quick Edit States
  const [adminNotesText, setAdminNotesText] = useState<{ [key: string]: string }>({});
  const [replyTextMap, setReplyTextMap] = useState<{ [key: string]: string }>({});
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: string }>({});

  // 1. Check persistent login on load
  useEffect(() => {
    const savedToken = localStorage.getItem("anes_admin_token");
    if (savedToken) {
      // Validate token or auto-authenticate
      validateTokenAndLoad(savedToken);
    }
  }, []);

  const validateTokenAndLoad = async (token: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: token }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        loadDashboardData(token);
      } else {
        localStorage.removeItem("anes_admin_token");
      }
    } catch (err) {
      console.error("Auto login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Perform manual login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        
        // Remember Session!
        if (rememberMe) {
          localStorage.setItem("anes_admin_token", passwordInput);
        } else {
          localStorage.removeItem("anes_admin_token");
        }

        loadDashboardData(passwordInput);
      } else {
        setLoginError(true);
      }
    } catch (err) {
      console.error("Login request failed:", err);
      setLoginError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Load Admin Inbox Data
  const loadDashboardData = async (token: string) => {
    setIsLoading(true);
    const authHeader = `Bearer ${token}`;

    try {
      // Fetch messages
      const msgsResponse = await fetch("/api/admin/messages", {
        headers: { Authorization: authHeader },
      });
      if (msgsResponse.ok) {
        const msgs = await msgsResponse.json();
        setMessages(msgs);
        
        // Populate local maps
        const notesMap: { [key: string]: string } = {};
        const repMap: { [key: string]: string } = {};
        msgs.forEach((m: Message) => {
          notesMap[m.id] = m.adminNotes || "";
          repMap[m.id] = m.replyText || "";
        });
        setAdminNotesText(notesMap);
        setReplyTextMap(repMap);
      }

      // Fetch SMTP Configuration Status
      const statusResponse = await fetch("/api/admin/status", {
        headers: { Authorization: authHeader },
      });
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setSmtpStatus(status);
      }

    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getActiveToken = () => {
    return passwordInput || localStorage.getItem("anes_admin_token") || "";
  };

  // 4. Update message state / Reply / Private note
  const handleUpdateMessage = async (id: string, updates: Partial<Message>) => {
    const token = getActiveToken();
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Refresh local messages state
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        
        setSaveStatus(prev => ({ ...prev, [id]: "saved" }));
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [id]: "" }));
        }, 3000);
      }
    } catch (err) {
      console.error("Error updating message:", err);
    }
  };

  // 5. Delete Request
  const handleDeleteMessage = async (id: string) => {
    const confirmDelete = window.confirm(
      currentLang === "ar" 
        ? "هل أنت متأكد من حذف هذا الطلب نهائياً؟" 
        : "Are you sure you want to delete this request permanently?"
    );
    if (!confirmDelete) return;

    const token = getActiveToken();
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedMsgId === id) setSelectedMsgId(null);
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  // Log out / Lock Panel
  const handleLock = () => {
    localStorage.removeItem("anes_admin_token");
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  // Filter and Search logic
  const filteredMessages = messages.filter(msg => {
    const matchesStatus = statusFilter === "all" || msg.status === statusFilter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      msg.name.toLowerCase().includes(searchLower) ||
      msg.contactInfo.toLowerCase().includes(searchLower) ||
      msg.message.toLowerCase().includes(searchLower);
    
    return matchesStatus && matchesSearch;
  });

  const countByStatus = (status: "new" | "replied" | "archived") => {
    return messages.filter(m => m.status === status).length;
  };

  return (
    <div className="min-height-screen py-10 px-6 max-w-6xl mx-auto font-sans" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* 1. Login Screen */}
      {!isAuthenticated ? (
        <div className="max-w-md mx-auto mt-20 glass-effect rounded-[32px] p-8 md:p-12 relative overflow-hidden text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-blue-400" size={24} />
          </div>

          <h2 className="text-2xl font-black mb-2 tracking-tight">
            {t.adminLoginTitle}
          </h2>
          <p className="text-xs text-neutral-400 mb-8 max-w-xs mx-auto">
            {t.adminLoginSubtitle}
          </p>

          <form onSubmit={handleLogin} className="space-y-5 text-start">
            <div>
              <input 
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={t.placeholderPasscode}
                required
                className="w-full text-center bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white text-lg tracking-widest focus:outline-none focus:border-blue-500 focus:bg-white/5 transition"
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-3 px-1">
              <input 
                type="checkbox" 
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-500 bg-white/5 border-white/10 rounded-sm cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-neutral-400 select-none cursor-pointer">
                {t.rememberMe}
              </label>
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-red-400 text-center py-1">
                {t.incorrectPasscode}
              </p>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/10 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock size={15} />
              {t.unlockBtn}
            </button>
          </form>

          <button 
            onClick={onBackToPortfolio}
            className="mt-8 text-xs text-neutral-500 hover:text-white transition flex items-center gap-1.5 mx-auto bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={12} className={isRtl ? "rotate-180" : ""} />
            {t.backToSite}
          </button>
        </div>
      ) : (
        
        // 2. Main Dashboard Panel
        <div>
          
          {/* Header Controls */}
          <div className="glass-effect rounded-[24px] p-6 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex items-center gap-4 text-center md:text-start">
              <button 
                onClick={onBackToPortfolio}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition cursor-pointer"
                title={t.backToSite}
              >
                <ArrowLeft size={16} className={isRtl ? "rotate-180" : ""} />
              </button>

              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  {t.inbox}
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                    {t.requests}
                  </span>
                </h1>
                <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                  {t.live}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={toggleLang}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition cursor-pointer flex items-center gap-1.5"
              >
                <Globe size={13} />
                {currentLang === "en" ? "العربية" : "English"}
              </button>
              
              <button 
                onClick={handleLock}
                className="px-4 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition cursor-pointer"
              >
                {t.lock}
              </button>
            </div>
          </div>

          {/* Alert Status Banner */}
          <div className="mb-8">
            {smtpStatus.smtpConfigured ? (
              <div className="px-5 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2.5">
                <Mail size={15} />
                <span>
                  {t.emailNotificationBadge} → <strong className="text-white">{smtpStatus.adminEmail}</strong>
                </span>
              </div>
            ) : (
              <div className="px-5 py-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-semibold leading-relaxed flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">{t.smtpStatusWarning}</p>
                  <p className="text-neutral-400 font-normal">
                    {currentLang === "ar" 
                      ? "المتغيرات المطلوبة: SMTP_HOST و SMTP_PORT و SMTP_USER و SMTP_PASS في إعدادات التطبيق." 
                      : "Required secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to receive direct notifications."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-effect rounded-2xl p-5 text-center">
              <div className="text-xs text-neutral-400 font-semibold uppercase tracking-widest mb-1">{t.totalMessages}</div>
              <div className="text-3xl font-black text-white">{messages.length}</div>
            </div>
            <div className="glass-effect rounded-2xl p-5 text-center border-blue-500/20 bg-blue-500/5">
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-1">{t.unreadCount}</div>
              <div className="text-3xl font-black text-blue-300">{countByStatus("new")}</div>
            </div>
            <div className="glass-effect rounded-2xl p-5 text-center border-green-500/20 bg-green-500/5">
              <div className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-1">{t.repliedCount}</div>
              <div className="text-3xl font-black text-green-300">{countByStatus("replied")}</div>
            </div>
            <div className="glass-effect rounded-2xl p-5 text-center">
              <div className="text-xs text-neutral-400 font-semibold uppercase tracking-widest mb-1">{t.statusArchived}</div>
              <div className="text-3xl font-black text-neutral-400">{countByStatus("archived")}</div>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Side: Message List (8 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Filter controls & search */}
              <div className="glass-effect rounded-[20px] p-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={currentLang === "ar" ? "ابحث باسم المرسل أو محتوى الرسالة..." : "Search messages..."}
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/5 transition"
                  />
                </div>

                <div className="flex gap-1">
                  {["all", "new", "replied", "archived"].map((filt) => (
                    <button
                      key={filt}
                      onClick={() => setStatusFilter(filt as any)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        statusFilter === filt 
                          ? "bg-blue-600 text-white" 
                          : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {filt === "all" ? t.catAll : t[`status${filt.charAt(0).toUpperCase() + filt.slice(1)}` as keyof typeof t] || filt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message cards list */}
              {isLoading && messages.length === 0 ? (
                <div className="text-center py-20 text-neutral-500 text-sm">
                  {currentLang === "ar" ? "جاري تحميل الرسائل..." : "Syncing inbox..."}
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="glass-effect rounded-[24px] p-12 text-center text-neutral-400 text-sm">
                  {t.noMessages}
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isSelected = selectedMsgId === msg.id;
                  const dateForm = new Date(msg.createdAt).toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US");
                  
                  return (
                    <div 
                      key={msg.id}
                      className={`glass-effect rounded-2xl p-6 transition duration-300 relative border ${
                        isSelected 
                          ? "border-blue-500/40 bg-blue-500/5 shadow-blue-500/5" 
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      {/* Status Badges */}
                      <div className="absolute top-6 right-6 flex items-center gap-1.5">
                        {msg.status === "new" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/25">
                            {t.statusNew}
                          </span>
                        )}
                        {msg.status === "replied" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full border border-green-500/25">
                            {t.statusReplied}
                          </span>
                        )}
                        {msg.status === "archived" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-500/10 text-neutral-400 px-2.5 py-1 rounded-full border border-neutral-500/25">
                            {t.statusArchived}
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <strong className="text-lg text-white block truncate max-w-[70%]">
                          {msg.name}
                        </strong>
                        <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                          {dateForm}
                        </span>
                      </div>

                      {/* Contact Info Header Accent */}
                      <div className="text-sm font-medium text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1.5 mb-4 group cursor-pointer" onClick={() => navigator.clipboard.writeText(msg.contactInfo)}>
                        <Mail size={13} />
                        <span>{msg.contactInfo}</span>
                      </div>

                      {/* Message Content Body */}
                      <p className="text-neutral-300 text-sm leading-relaxed mb-6 bg-black/25 p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                        "{msg.message}"
                      </p>

                      {/* Reply Text Preview (If Replied) */}
                      {msg.replyText && (
                        <div className="mb-6 p-4 rounded-xl bg-green-500/5 border border-green-500/10 text-xs">
                          <strong className="text-green-400 block mb-1">
                            {currentLang === "ar" ? "✍️ الرد المسجل:" : "✍️ Recorded Reply:"}
                          </strong>
                          <p className="text-neutral-300 italic whitespace-pre-wrap">"{msg.replyText}"</p>
                          {msg.repliedAt && (
                            <span className="text-[10px] text-neutral-500 mt-1 block">
                              {new Date(msg.repliedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action buttons inside card */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedMsgId(isSelected ? null : msg.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
                              isSelected 
                                ? "bg-white/10 text-white" 
                                : "bg-blue-600/10 text-blue-400 border border-blue-500/10 hover:bg-blue-600/20"
                            }`}
                          >
                            {isSelected 
                              ? (currentLang === "ar" ? "إغلاق التحرير" : "Close Editor") 
                              : (currentLang === "ar" ? "فتح وإدارة" : "Open & Manage")}
                          </button>

                          {/* Quick Archive/Restore Toggle */}
                          {msg.status !== "archived" ? (
                            <button
                              onClick={() => handleUpdateMessage(msg.id, { status: "archived" })}
                              className="px-3 py-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-white/5 text-xs transition cursor-pointer"
                              title={t.archiveRequest}
                            >
                              {t.archiveRequest}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateMessage(msg.id, { status: "new" })}
                              className="px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs transition cursor-pointer"
                              title={t.restoreRequest}
                            >
                              {t.restoreRequest}
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/10 transition cursor-pointer"
                          title={t.deleteRequest}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Right Side: Message Detail Editor (5 Cols) */}
            <div className="lg:col-span-5">
              {selectedMsgId ? (
                (() => {
                  const activeMsg = messages.find(m => m.id === selectedMsgId);
                  if (!activeMsg) return null;

                  return (
                    <div className="glass-effect rounded-[24px] p-6 space-y-6 sticky top-24 border border-blue-500/20">
                      <div>
                        <h2 className="text-lg font-bold text-white mb-1">
                          {currentLang === "ar" ? "تحرير وإدارة الرد" : "Manage & Reply"}
                        </h2>
                        <span className="text-xs text-neutral-400 block">
                          ID: {activeMsg.id}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs">
                        <strong className="text-neutral-300 block mb-1">{t.placeholderName}:</strong>
                        <p className="text-white font-semibold mb-3">{activeMsg.name}</p>

                        <strong className="text-neutral-300 block mb-1">{t.contactLabel}:</strong>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-blue-300 select-all font-mono">{activeMsg.contactInfo}</span>
                          <button 
                            onClick={() => navigator.clipboard.writeText(activeMsg.contactInfo)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white cursor-pointer border-none text-[10px]"
                          >
                            {t.copiedToClipboard ? "Copy" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {/* 1. Email Composer Assist Helper */}
                      <div>
                        <a 
                          href={`mailto:${activeMsg.contactInfo}?subject=Re: Request from ${activeMsg.name}&body=Hello ${activeMsg.name},%0D%0A%0D%0AThank you for reaching out.%0D%0A`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition flex items-center justify-center gap-2 cursor-pointer text-center"
                        >
                          <Mail size={14} />
                          {t.composeInMail}
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      {/* 2. Admin Reply Form */}
                      <div className="space-y-2 pt-4 border-t border-white/5">
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          {currentLang === "ar" ? "الرد المسجل" : "Record Admin Reply"}
                        </label>
                        <textarea
                          value={replyTextMap[activeMsg.id] || ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setReplyTextMap(prev => ({ ...prev, [activeMsg.id]: text }));
                          }}
                          placeholder={t.replyPlaceholder}
                          rows={4}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/5 transition text-white resize-none"
                        ></textarea>
                        
                        <button
                          onClick={() => handleUpdateMessage(activeMsg.id, { 
                            replyText: replyTextMap[activeMsg.id],
                            status: "replied"
                          })}
                          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle size={14} />
                          {saveStatus[activeMsg.id] === "saved" ? t.replySavedSuccess : t.sendReplyBtn}
                        </button>
                      </div>

                      {/* 3. Admin Notes Form */}
                      <div className="space-y-2 pt-4 border-t border-white/5">
                        <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          {currentLang === "ar" ? "ملاحظات سرية (للمشرف فقط)" : "Internal Admin Notes"}
                        </label>
                        <textarea
                          value={adminNotesText[activeMsg.id] || ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            setAdminNotesText(prev => ({ ...prev, [activeMsg.id]: text }));
                          }}
                          placeholder={t.adminNotesPlaceholder}
                          rows={2}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:bg-white/5 transition text-white resize-none"
                        ></textarea>

                        <button
                          onClick={() => handleUpdateMessage(activeMsg.id, { adminNotes: adminNotesText[activeMsg.id] })}
                          className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 font-bold text-xs transition cursor-pointer"
                        >
                          {saveStatus[activeMsg.id] === "saved" ? t.notesSavedSuccess : t.saveNotesBtn}
                        </button>
                      </div>

                    </div>
                  );
                })()
              ) : (
                <div className="glass-effect rounded-[24px] p-8 text-center text-neutral-400 text-xs py-16 space-y-4">
                  <FileText className="mx-auto text-neutral-600" size={32} />
                  <p>
                    {currentLang === "ar" 
                      ? "اختر أي رسالة من القائمة لعرض أدوات الرد وتسجيل الملاحظات الإدارية." 
                      : "Select a client message from the inbox to open detailed reply and notes tools."}
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
