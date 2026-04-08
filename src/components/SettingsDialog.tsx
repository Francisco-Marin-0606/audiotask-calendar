import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { UserSettings } from '@/src/types';
import { Clock } from 'lucide-react';

const DAY_LABELS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'L' },
  { value: 2, label: 'Martes', short: 'M' },
  { value: 3, label: 'Miércoles', short: 'X' },
  { value: 4, label: 'Jueves', short: 'J' },
  { value: 5, label: 'Viernes', short: 'V' },
  { value: 6, label: 'Sábado', short: 'S' },
  { value: 0, label: 'Domingo', short: 'D' },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => Promise<void>;
}

export function SettingsDialog({ open, onOpenChange, settings, onSave }: SettingsDialogProps) {
  const [workStartTime, setWorkStartTime] = useState(settings.workStartTime);
  const [workEndTime, setWorkEndTime] = useState(settings.workEndTime);
  const [workDays, setWorkDays] = useState<number[]>(settings.workDays);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWorkStartTime(settings.workStartTime);
    setWorkEndTime(settings.workEndTime);
    setWorkDays(settings.workDays);
  }, [settings]);

  const toggleDay = (day: number) => {
    setWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ workStartTime, workEndTime, workDays });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock size={16} />
              Horario laboral
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="workStart" className="text-xs text-muted-foreground">Inicio</Label>
                <input
                  id="workStart"
                  type="time"
                  value={workStartTime}
                  onChange={e => setWorkStartTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workEnd" className="text-xs text-muted-foreground">Fin</Label>
                <input
                  id="workEnd"
                  type="time"
                  value={workEndTime}
                  onChange={e => setWorkEndTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Días laborales</Label>
            <div className="flex gap-2">
              {DAY_LABELS.map(day => {
                const active = workDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    title={day.label}
                    className={`w-9 h-9 rounded-full text-xs font-semibold transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || workDays.length === 0}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
