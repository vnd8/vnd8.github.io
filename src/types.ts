export interface Message {
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

export type Language = "en" | "ar";

export interface WorkItem {
  id: string;
  youtubeId: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
  category: "vlogs" | "gaming" | "reaction" | "documentary" | "stories";
}

export interface ServiceItem {
  icon: string;
  titleEn: string;
  titleAr: string;
  descEn: string;
  descAr: string;
}

export interface SMTPStatus {
  smtpConfigured: boolean;
  smtpUser: string | null;
  adminEmail: string;
}
