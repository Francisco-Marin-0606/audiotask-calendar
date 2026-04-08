import { useState, useMemo, useRef } from 'react';
import { Task, Attachment, SocialPlatform, SOCIAL_PLATFORMS } from '@/src/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Folder,
  ChevronRight,
  Music,
  Image,
  Video,
  Play,
  FileText,
  Package,
  MoreVertical,
  Download,
  ExternalLink,
  Instagram,
  Music2,
  Cloud,
  Youtube,
  Disc3,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { uploadFile } from '@/src/lib/storage';

interface ThemeFolder {
  themeId: string;
  themeName: string;
  createdAt: string;
  totalFiles: number;
  totalSteps: number;
  completedSteps: number;
  tasks: Task[];
  publishedPlatforms: SocialPlatform[];
}

interface ThemeFilesViewProps {
  tasks: Task[];
  onPlayAudio: (url: string, name: string, themeId?: string, themeName?: string) => void;
  onViewText?: (name: string, content: string) => void;
  onReplaceFile?: (taskId: string, attachmentIndex: number, newAttachment: Attachment) => Promise<void>;
  currentUserPhoto?: string;
  currentUserName?: string;
}

function resolveFileType(type: Attachment['type'], name?: string): Attachment['type'] {
  if (name?.toLowerCase().endsWith('.zip')) return 'zip';
  return type;
}

function getFileIcon(type: Attachment['type'], name?: string) {
  switch (resolveFileType(type, name)) {
    case 'image': return Image;
    case 'video': return Video;
    case 'audio': return Music;
    case 'zip': return Package;
    default: return FileText;
  }
}

const PLATFORM_ICON_MAP: Record<SocialPlatform, React.ComponentType<{ size?: number; className?: string }>> = {
  instagram: Instagram,
  tiktok: Music2,
  soundcloud: Cloud,
  youtube: Youtube,
  spotify: Disc3,
};

const PLATFORM_COLOR_MAP: Record<SocialPlatform, { active: string; inactive: string }> = {
  instagram: { active: 'text-pink-400', inactive: 'text-muted-foreground/25' },
  tiktok: { active: 'text-cyan-400', inactive: 'text-muted-foreground/25' },
  soundcloud: { active: 'text-orange-400', inactive: 'text-muted-foreground/25' },
  youtube: { active: 'text-red-400', inactive: 'text-muted-foreground/25' },
  spotify: { active: 'text-green-400', inactive: 'text-muted-foreground/25' },
};

const STEP_SHORT_NAMES: Record<number, string> = {
  1: 'Beat',
  2: 'Masterizado',
  3: 'Letra',
  4: 'Letra',
  5: 'Voces',
  6: 'Mix',
  7: 'Portada',
  8: 'Video',
  9: 'Video',
  10: 'Metadata',
  11: 'Publicacion',
};

function getFileIconColor(type: Attachment['type'], name?: string) {
  switch (resolveFileType(type, name)) {
    case 'image': return 'text-red-400';
    case 'video': return 'text-purple-400';
    case 'audio': return 'text-blue-400';
    case 'text': return 'text-sky-400';
    case 'zip': return 'text-yellow-400';
    default: return 'text-muted-foreground';
  }
}

export function ThemeFilesView({ tasks, onPlayAudio, onViewText, onReplaceFile, currentUserPhoto, currentUserName }: ThemeFilesViewProps) {
  const [openThemeId, setOpenThemeId] = useState<string | null>(null);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceRef = useRef<{ taskId: string; idx: number } | null>(null);

  const handleReplaceClick = (taskId: string, idx: number) => {
    pendingReplaceRef.current = { taskId, idx };
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingReplaceRef.current;
    if (!file || !pending || !onReplaceFile) return;

    const key = `${pending.taskId}-${pending.idx}`;
    setReplacingKey(key);
    try {
      const data = await uploadFile(file);
      await onReplaceFile(pending.taskId, pending.idx, {
        name: data.name,
        type: data.type as Attachment['type'],
        url: data.url,
      });
    } catch (err) {
      console.error('Replace failed:', err);
    } finally {
      setReplacingKey(null);
      pendingReplaceRef.current = null;
      e.target.value = '';
    }
  };

  const themes = useMemo(() => {
    const map = new Map<string, ThemeFolder>();

    for (const task of tasks) {
      if (!task.themeId) continue;

      let folder = map.get(task.themeId);
      if (!folder) {
        folder = {
          themeId: task.themeId,
          themeName: task.themeName || 'Sin nombre',
          createdAt: task.date,
          totalFiles: 0,
          totalSteps: 0,
          completedSteps: 0,
          tasks: [],
          publishedPlatforms: [],
        };
        map.set(task.themeId, folder);
      }

      folder.tasks.push(task);
      folder.totalFiles += (task.attachments?.length ?? 0);
      folder.totalSteps++;
      if (task.completed) folder.completedSteps++;
      if (task.date < folder.createdAt) folder.createdAt = task.date;
    }

    for (const folder of map.values()) {
      const published = new Set<SocialPlatform>();
      for (const t of folder.tasks) {
        if (t.publishedOn && t.completed) published.add(t.publishedOn);
      }
      folder.publishedPlatforms = [...published];
    }

    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tasks]);

  const openTheme = themes.find(t => t.themeId === openThemeId);

  // ── Detail view: flat file list inside a theme ──
  if (openTheme) {
    const sortedTasks = [...openTheme.tasks].sort((a, b) => (a.themeOrder ?? 0) - (b.themeOrder ?? 0));

    const fileRows: { att: Attachment; stepShort: string; date: string; taskId: string; idx: number; themeId: string; themeName: string; ownerPhoto: string; ownerName: string }[] = [];
    for (const task of sortedTasks) {
      const stepShort = STEP_SHORT_NAMES[task.themeOrder ?? 0] ?? task.title.replace(` — ${openTheme.themeName}`, '');
      const ownerPhoto = task.ownerPhotoURL || currentUserPhoto || '';
      const ownerName = task.ownerDisplayName || currentUserName || '';
      for (let i = 0; i < (task.attachments?.length ?? 0); i++) {
        fileRows.push({ att: task.attachments[i], stepShort, date: task.date, taskId: task.id, idx: i, themeId: openTheme.themeId, themeName: openTheme.themeName, ownerPhoto, ownerName });
      }
    }

    return (
      <div className="flex-1 flex flex-col h-full">
        <input
          ref={replaceInputRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.zip,application/zip"
          onChange={handleReplaceFile}
        />
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border/40 shrink-0">
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpenThemeId(null)}
          >
            Archivos
          </button>
          <ChevronRight size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">{openTheme.themeName}</span>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-2.5 border-b border-border/40 flex items-center gap-4 text-xs text-muted-foreground shrink-0 bg-muted/20">
          <span>Creado {format(new Date(openTheme.createdAt + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: es })}</span>
          <span className="text-border">|</span>
          <span>{openTheme.totalFiles} archivo{openTheme.totalFiles !== 1 ? 's' : ''}</span>
          <span className="text-border">|</span>
          <span>{openTheme.completedSteps}/{openTheme.totalSteps} pasos</span>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-3 px-6 py-2 text-xs font-medium text-muted-foreground border-b border-border/40 shrink-0">
          <span className="w-4 shrink-0" />
          <span className="flex-1">Nombre</span>
          <span className="w-32 text-center hidden md:block">Tema</span>
          <span className="w-28 text-center hidden sm:block">Paso</span>
          <span className="w-24 text-center">Fecha</span>
          <span className="w-20 text-center hidden lg:block">Propietario</span>
          <span className="w-[88px] shrink-0" />
        </div>

        <ScrollArea className="flex-1">
          {fileRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Folder size={28} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground/60">No hay archivos subidos todavia</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {fileRows.map((row) => {
                const Icon = getFileIcon(row.att.type, row.att.name);
                const iconColor = getFileIconColor(row.att.type, row.att.name);
                const handleRowClick = () => {
                  if (row.att.type === 'audio') onPlayAudio(row.att.url, row.att.name, row.themeId, row.themeName);
                  else if (row.att.type === 'text') onViewText?.(row.att.name, row.att.content || '');
                  else window.open(row.att.url, '_blank');
                };
                return (
                  <div
                    key={`${row.taskId}-${row.idx}`}
                    className="flex items-center gap-3 px-6 py-2.5 hover:bg-accent/50 transition-colors group cursor-pointer"
                    onClick={handleRowClick}
                  >
                    <Icon size={16} className={cn("shrink-0", iconColor)} />
                    <span className="text-sm flex-1 truncate">{row.att.name}</span>
                    <span className="text-xs text-muted-foreground w-32 text-center truncate hidden md:block">{openTheme.themeName}</span>
                    <span className="text-xs text-muted-foreground w-28 text-center truncate hidden sm:block">{row.stepShort}</span>
                    <span className="text-xs text-muted-foreground w-24 text-center shrink-0">
                      {format(new Date(row.date + 'T00:00:00'), "d MMM", { locale: es })}
                    </span>
                    <span className="w-20 hidden lg:flex items-center justify-center shrink-0" title={row.ownerName}>
                      {row.ownerPhoto ? (
                        <img src={row.ownerPhoto} alt={row.ownerName} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                          {row.ownerName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </span>
                    <div className="w-[88px] flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                      {row.att.type !== 'text' && (
                        <>
                          {onReplaceFile && (
                            <button
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                              title="Reemplazar archivo"
                              onClick={() => handleReplaceClick(row.taskId, row.idx)}
                              disabled={replacingKey === `${row.taskId}-${row.idx}`}
                            >
                              {replacingKey === `${row.taskId}-${row.idx}` ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </button>
                          )}
                          <a
                            href={row.att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            title="Abrir externo"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <a
                            href={row.att.url}
                            download={row.att.name}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                            title="Descargar"
                          >
                            <Download size={14} />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // ── Root view: folder chips ──
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border/40 shrink-0">
        <h2 className="text-sm font-medium text-muted-foreground">Temas</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {themes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Folder size={32} className="text-muted-foreground/40" />
              </div>
              <h3 className="font-medium text-muted-foreground">No hay temas todavia</h3>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Crea un tema desde el sidebar para ver sus archivos aca.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.themeId}
                  onClick={() => setOpenThemeId(theme.themeId)}
                  className="flex flex-col gap-2 px-4 py-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-accent/60 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Folder size={20} className="text-muted-foreground/70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{theme.themeName}</h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {format(new Date(theme.createdAt + 'T00:00:00'), "d MMM yyyy", { locale: es })}
                        {' · '}{theme.totalFiles} archivo{theme.totalFiles !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <MoreVertical size={16} className="text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-1.5 pl-0.5">
                    {SOCIAL_PLATFORMS.map(platform => {
                      const Icon = PLATFORM_ICON_MAP[platform.id];
                      const isPublished = theme.publishedPlatforms.includes(platform.id);
                      const colors = PLATFORM_COLOR_MAP[platform.id];
                      return (
                        <span
                          key={platform.id}
                          title={`${platform.label}${isPublished ? ' ✓' : ' — pendiente'}`}
                          className={cn('transition-colors', isPublished ? colors.active : colors.inactive)}
                        >
                          <Icon size={14} />
                        </span>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Files table: all files across all themes */}
          {themes.length > 0 && (() => {
            const allFiles: { att: Attachment; themeName: string; stepLabel: string; date: string; themeId: string; ownerPhoto: string; ownerName: string }[] = [];
            for (const theme of themes) {
              for (const task of theme.tasks) {
                const stepLabel = task.title.replace(` — ${theme.themeName}`, '');
                const ownerPhoto = task.ownerPhotoURL || currentUserPhoto || '';
                const ownerName = task.ownerDisplayName || currentUserName || '';
                for (const att of (task.attachments ?? [])) {
                  allFiles.push({ att, themeName: theme.themeName, stepLabel, date: task.date, themeId: theme.themeId, ownerPhoto, ownerName });
                }
              }
            }
            if (allFiles.length === 0) return null;

            return (
              <div className="mt-8">
                <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">Archivos recientes</h2>
                {/* Table header */}
                <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/40">
                  <span className="w-4 shrink-0" />
                  <span className="flex-1">Nombre</span>
                  <span className="w-32 text-center hidden md:block">Tema</span>
                  <span className="w-28 text-center hidden sm:block">Paso</span>
                  <span className="w-24 text-center">Fecha</span>
                  <span className="w-20 text-center hidden lg:block">Propietario</span>
                  <span className="w-[68px] shrink-0" />
                </div>
                {/* Table rows */}
                <div className="divide-y divide-border/20">
                  {allFiles.map((file, i) => {
                    const Icon = getFileIcon(file.att.type, file.att.name);
                    const iconColor = getFileIconColor(file.att.type, file.att.name);
                    const handleRowClick = () => {
                      if (file.att.type === 'audio') onPlayAudio(file.att.url, file.att.name, file.themeId, file.themeName);
                      else if (file.att.type === 'text') onViewText?.(file.att.name, file.att.content || '');
                      else window.open(file.att.url, '_blank');
                    };
                    return (
                      <div
                        key={`${file.themeId}-${i}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors group cursor-pointer"
                        onClick={handleRowClick}
                      >
                        <Icon size={16} className={cn("shrink-0", iconColor)} />
                        <span className="text-sm flex-1 truncate">{file.att.name}</span>
                        <span className="text-xs text-muted-foreground w-32 text-center truncate hidden md:block">{file.themeName}</span>
                        <span className="text-xs text-muted-foreground w-28 text-center truncate hidden sm:block">{file.stepLabel}</span>
                        <span className="text-xs text-muted-foreground w-24 text-center shrink-0">
                          {format(new Date(file.date + 'T00:00:00'), "d MMM", { locale: es })}
                        </span>
                        <span className="w-20 hidden lg:flex items-center justify-center shrink-0" title={file.ownerName}>
                          {file.ownerPhoto ? (
                            <img src={file.ownerPhoto} alt={file.ownerName} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                              {file.ownerName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          )}
                        </span>
                        <div className="w-[68px] flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                          {file.att.type !== 'text' && (
                            <>
                              <a
                                href={file.att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                                title="Abrir externo"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <a
                                href={file.att.url}
                                download={file.att.name}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                                title="Descargar"
                              >
                                <Download size={14} />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </ScrollArea>
    </div>
  );
}
