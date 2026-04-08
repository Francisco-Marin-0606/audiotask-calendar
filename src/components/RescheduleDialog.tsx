import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task, UserSettings } from '@/src/types';
import { format, addDays, isToday, isTomorrow, isSameDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSlot {
  date: Date;
  dateStr: string;
  startTime: string;
  endTime: string;
}

interface DaySlots {
  date: Date;
  dateStr: string;
  label: string;
  slots: TimeSlot[];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getAvailableSlots(
  tasks: Task[],
  settings: UserSettings,
  taskDuration: number,
  excludeTaskId: string,
  daysToSearch: number = 14,
): DaySlots[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workStart = timeToMinutes(settings.workStartTime);
  const workEnd = timeToMinutes(settings.workEndTime);
  const result: DaySlots[] = [];

  for (let d = 0; d < daysToSearch; d++) {
    const date = addDays(today, d);
    const dayOfWeek = getDay(date);

    if (!settings.workDays.includes(dayOfWeek)) continue;

    const dateStr = format(date, 'yyyy-MM-dd');

    const dayTasks = tasks
      .filter(t => t.id !== excludeTaskId && t.date === dateStr)
      .map(t => ({
        start: timeToMinutes(t.startTime),
        end: timeToMinutes(t.endTime),
      }))
      .sort((a, b) => a.start - b.start);

    const now = new Date();
    let searchStart = workStart;

    if (isToday(date)) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const snapped = Math.ceil(currentMinutes / 15) * 15;
      searchStart = Math.max(workStart, snapped);
    }

    const slots: TimeSlot[] = [];

    for (let start = searchStart; start + taskDuration <= workEnd; start += 15) {
      const end = start + taskDuration;
      const hasConflict = dayTasks.some(
        t => start < t.end && end > t.start
      );
      if (!hasConflict) {
        slots.push({
          date,
          dateStr,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
        });
      }
    }

    if (slots.length > 0) {
      let label: string;
      if (isToday(date)) {
        label = 'Hoy';
      } else if (isTomorrow(date)) {
        label = 'Mañana';
      } else {
        label = format(date, "EEEE d 'de' MMMM", { locale: es });
      }

      result.push({ date, dateStr, label, slots });
    }
  }

  return result;
}

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  tasks: Task[];
  settings: UserSettings;
  onReschedule: (taskId: string, date: string, startTime: string, endTime: string) => Promise<void>;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  task,
  tasks,
  settings,
  onReschedule,
}: RescheduleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const taskDuration = useMemo(
    () => timeToMinutes(task.endTime) - timeToMinutes(task.startTime),
    [task.startTime, task.endTime],
  );

  const daySlots = useMemo(
    () => getAvailableSlots(tasks, settings, taskDuration, task.id),
    [tasks, settings, taskDuration, task.id],
  );

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSaving(true);
    try {
      await onReschedule(task.id, selectedSlot.dateStr, selectedSlot.startTime, selectedSlot.endTime);
      onOpenChange(false);
    } catch (err) {
      console.error('Error rescheduling task:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock size={18} />
            Reprogramar tarea
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 pb-2">
          <p className="text-sm font-medium">{task.title}</p>
          <p className="text-xs text-muted-foreground">
            Duración: {taskDuration} min — Seleccioná un horario disponible
          </p>
        </div>

        <ScrollArea className="max-h-[350px] pr-3">
          {daySlots.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay horarios disponibles en los próximos 14 días laborales.
            </div>
          ) : (
            <div className="space-y-4">
              {daySlots.map(day => (
                <div key={day.dateStr} className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
                    {day.label}
                  </h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {day.slots.map(slot => {
                      const isSelected =
                        selectedSlot?.dateStr === slot.dateStr &&
                        selectedSlot?.startTime === slot.startTime;
                      return (
                        <button
                          key={`${slot.dateStr}-${slot.startTime}`}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            'flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/40 hover:bg-accent',
                          )}
                        >
                          <Clock size={12} className="shrink-0 opacity-60" />
                          {slot.startTime} – {slot.endTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedSlot || saving}>
            {saving ? 'Moviendo...' : 'Confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
