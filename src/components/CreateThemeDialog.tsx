import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Task, UserSettings, THEME_STEPS, Collaborator } from '@/src/types';
import { scheduleTheme } from '@/src/lib/scheduleTheme';
import { CollaboratorPicker } from '@/src/components/CollaboratorPicker';
import { useContacts } from '@/src/hooks/useContacts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Music, CalendarClock, Clock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CreateThemeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  settings: UserSettings;
  onCreateTheme: (tasks: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'>[]) => Promise<void>;
}

export function CreateThemeDialog({
  open,
  onOpenChange,
  tasks,
  settings,
  onCreateTheme,
}: CreateThemeDialogProps) {
  const [themeName, setThemeName] = useState('');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const { saveMultipleContacts } = useContacts();
  const [startDateStr, setStartDateStr] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [preview, setPreview] = useState<ReturnType<typeof scheduleTheme> | null>(null);
  const [saving, setSaving] = useState(false);
  const [themeId, setThemeId] = useState('');

  const totalMinutes = useMemo(
    () => THEME_STEPS.reduce((sum, s) => sum + s.durationMinutes, 0),
    [],
  );

  const handleGeneratePlan = () => {
    if (!themeName.trim()) return;
    const id = crypto.randomUUID();
    setThemeId(id);
    const startDate = new Date(startDateStr + 'T00:00:00');
    const result = scheduleTheme(themeName.trim(), id, tasks, settings, startDate);
    setPreview(result);
  };

  const handleConfirm = async () => {
    if (!preview || preview.length === 0) return;
    setSaving(true);
    try {
      const tasksWithCollaborators = collaborators.length > 0
        ? preview.map(t => ({ ...t, collaborators }))
        : preview;
      await onCreateTheme(tasksWithCollaborators);
      if (collaborators.length > 0) {
        await saveMultipleContacts(collaborators);
      }
      onOpenChange(false);
      setThemeName('');
      setCollaborators([]);
      setPreview(null);
    } catch (err) {
      console.error('Error creating theme tasks:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setPreview(null);
      setThemeName('');
      setCollaborators([]);
    }
    onOpenChange(isOpen);
  };

  const groupedByDate = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, typeof preview>();
    for (const t of preview) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries()).map(([date, tasks]) => ({ date, tasks }));
  }, [preview]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music size={20} className="text-primary" />
            Crear Tema
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">
              Se crearán {THEME_STEPS.length} tareas ({Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min)
              programadas en los huecos libres de tu calendario.
            </p>

            <div className="space-y-2">
              <Label htmlFor="theme-name">Nombre del tema</Label>
              <Input
                id="theme-name"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder='Ej: "Mi Canción"'
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme-start">Fecha de inicio</Label>
              <Input
                id="theme-start"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
              />
            </div>

            <CollaboratorPicker selected={collaborators} onChange={setCollaborators} />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pasos del tema</Label>
              <div className="grid gap-1.5">
                {THEME_STEPS.map((step) => (
                  <div key={step.order} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/50">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right">{step.order}.</span>
                      {step.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {step.durationMinutes >= 60
                        ? `${Math.floor(step.durationMinutes / 60)}h${step.durationMinutes % 60 > 0 ? ` ${step.durationMinutes % 60}min` : ''}`
                        : `${step.durationMinutes}min`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleGeneratePlan} disabled={!themeName.trim()}>
                <CalendarClock size={16} className="mr-2" />
                Generar Plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2 max-h-[calc(80vh-100px)]">
            <div className="shrink-0">
              {preview.length < THEME_STEPS.length ? (
                <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm px-3 py-2 rounded-md flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Solo se pudieron programar {preview.length} de {THEME_STEPS.length} tareas. Intentá con una fecha más temprana o liberá espacio.
                </div>
              ) : (
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-md flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Se programaron las {preview.length} tareas de "{themeName}"
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 pr-3">
              <div className="space-y-4">
                {groupedByDate.map(({ date, tasks: dayTasks }) => (
                  <div key={date} className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize sticky top-0 bg-background py-1">
                      {format(new Date(date + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                    </h4>
                    {dayTasks.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#7986cb]/10 border border-[#7986cb]/20"
                      >
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                          {t.themeOrder}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock size={12} />
                          {t.startTime} – {t.endTime}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="shrink-0 flex justify-between gap-2 pt-2 border-t border-border/40">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Volver
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirm} disabled={saving || preview.length === 0}>
                  {saving && <Loader2 className="animate-spin mr-2" size={16} />}
                  Confirmar y Crear
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
