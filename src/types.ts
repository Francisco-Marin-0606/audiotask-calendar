export type TaskType = 'audiovisual' | 'personal' | 'admin';

export interface Attachment {
  name: string;
  type: 'image' | 'audio' | 'video' | 'text' | 'zip';
  url: string;
  content?: string;
}

export type SocialPlatform = 'instagram' | 'tiktok' | 'soundcloud' | 'youtube' | 'spotify';

export const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'soundcloud', label: 'SoundCloud' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
];

export type RecurrenceType = 'daily' | 'custom';

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number;   // 1 = every day, 2 = every 2 days, etc.
  count: number;       // total occurrences (including the first one)
}

export interface Collaborator {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface SavedContact {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastUsed: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string; // ISO date string
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: TaskType;
  completed: boolean;
  attachments: Attachment[];
  userId: string;
  ownerDisplayName?: string;
  ownerPhotoURL?: string;
  createdAt: any;
  seriesId?: string;
  recurrenceIndex?: number;
  recurrenceTotal?: number;
  themeId?: string;
  themeName?: string;
  themeOrder?: number;
  publishedOn?: SocialPlatform;
  collaborators?: Collaborator[];
  participantIds?: string[];
}

export interface UserSettings {
  workStartTime: string; // HH:mm
  workEndTime: string;   // HH:mm
  workDays: number[];    // 0=dom, 1=lun, ..., 6=sab
}

export const DEFAULT_SETTINGS: UserSettings = {
  workStartTime: '09:00',
  workEndTime: '18:00',
  workDays: [1, 2, 3, 4, 5],
};

export interface ThemeStep {
  label: string;
  durationMinutes: number;
  order: number;
}

export const THEME_STEPS: ThemeStep[] = [
  { label: 'Crear beat', durationMinutes: 120, order: 1 },
  { label: 'Masterizar', durationMinutes: 120, order: 2 },
  { label: 'Crear letra (parte 1)', durationMinutes: 90, order: 3 },
  { label: 'Crear letra (parte 2)', durationMinutes: 90, order: 4 },
  { label: 'Grabar voces', durationMinutes: 40, order: 5 },
  { label: 'Mixear beat + voces', durationMinutes: 60, order: 6 },
  { label: 'Generar portada', durationMinutes: 60, order: 7 },
  { label: 'Generar video (parte 1)', durationMinutes: 90, order: 8 },
  { label: 'Generar video (parte 2)', durationMinutes: 90, order: 9 },
  { label: 'Generar metadata del video', durationMinutes: 30, order: 10 },
  { label: 'Publicar tema en redes', durationMinutes: 15, order: 11 },
];

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
}

export interface ProposedTask {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: TaskType;
  recurrence?: RecurrenceConfig;
  publishedOn?: SocialPlatform;
  themeId?: string;
  themeName?: string;
  collaborators?: Collaborator[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposals?: ProposedTask[];
  proposalStatus?: 'pending' | 'accepted' | 'rejected';
}
