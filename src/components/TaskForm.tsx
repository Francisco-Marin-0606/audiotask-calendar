import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskType, Attachment, RecurrenceConfig, Collaborator } from '@/src/types';
import { CollaboratorPicker } from '@/src/components/CollaboratorPicker';
import { useContacts } from '@/src/hooks/useContacts';
import { Image, Music, X, Loader2, Repeat, Video, Package } from 'lucide-react';
import { TimeScrollPicker } from '@/src/components/TimeScrollPicker';

interface TaskFormProps {
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  onCancel: () => void;
}

export function TaskForm({ onSubmit, initialData, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(() => {
    if (initialData?.date) return initialData.date;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00');
  const [type, setType] = useState<TaskType>(initialData?.type || 'personal');
  const [attachments, setAttachments] = useState<Attachment[]>(initialData?.attachments || []);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialData?.collaborators || []);
  const { saveMultipleContacts } = useContacts();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'custom'>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(2);
  const [recurrenceCount, setRecurrenceCount] = useState(7);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        setAttachments([...attachments, { name: data.name, type: data.type, url: data.url }]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const recurrence: RecurrenceConfig | undefined = isRecurring
        ? {
            type: recurrenceType,
            interval: recurrenceType === 'daily' ? 1 : recurrenceInterval,
            count: recurrenceCount,
          }
        : undefined;
      await onSubmit({
        title, description, date, startTime, endTime, type, attachments, recurrence,
        ...(collaborators.length > 0 ? { collaborators } : {}),
      });
      if (collaborators.length > 0) {
        await saveMultipleContacts(collaborators);
      }
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej: Edición de Video X" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Categoría</Label>
          <Select value={type} onValueChange={(v: TaskType) => setType(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="audiovisual">Audiovisual</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="admin">Administración</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Inicio</Label>
          <TimeScrollPicker id="startTime" value={startTime} onChange={setStartTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Fin</Label>
          <TimeScrollPicker id="endTime" value={endTime} onChange={setEndTime} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles de la tarea..." rows={3} />
      </div>

      {/* Recurrence */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox
            id="recurring"
            checked={isRecurring}
            onCheckedChange={(checked) => setIsRecurring(checked === true)}
          />
          <Label htmlFor="recurring" className="flex items-center gap-2 cursor-pointer font-medium">
            <Repeat size={16} className="text-primary" />
            Repetir tarea
          </Label>
        </div>

        {isRecurring && (
          <div className="ml-7 space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="space-y-2">
              <Label htmlFor="recurrenceType">Frecuencia</Label>
              <Select value={recurrenceType} onValueChange={(v: 'daily' | 'custom') => setRecurrenceType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Todos los días</SelectItem>
                  <SelectItem value="custom">Cada X días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recurrenceType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="recurrenceInterval">Cada cuántos días</Label>
                <Input
                  id="recurrenceInterval"
                  type="number"
                  min={2}
                  max={30}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(2, Math.min(30, parseInt(e.target.value) || 2)))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="recurrenceCount">Cantidad de repeticiones</Label>
              <Input
                id="recurrenceCount"
                type="number"
                min={2}
                max={90}
                value={recurrenceCount}
                onChange={(e) => setRecurrenceCount(Math.max(2, Math.min(90, parseInt(e.target.value) || 2)))}
              />
              <p className="text-xs text-muted-foreground">
                Se crearán {recurrenceCount} tareas: desde el {date || 'fecha seleccionada'}
                {recurrenceType === 'daily'
                  ? ` durante ${recurrenceCount} días consecutivos`
                  : ` cada ${recurrenceInterval} días`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      <CollaboratorPicker selected={collaborators} onChange={setCollaborators} />

      <div className="space-y-2">
        <Label>Adjuntos (Imágenes/Audio/Video/ZIP)</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-secondary p-2 rounded-md text-sm group relative">
              {att.type === 'image' ? <Image size={16} /> : att.type === 'video' ? <Video size={16} /> : (att.type === 'zip' || att.name?.toLowerCase().endsWith('.zip')) ? <Package size={16} /> : <Music size={16} />}
              <span className="truncate max-w-[100px]">{att.name}</span>
              <button type="button" onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="relative cursor-pointer" disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Image className="mr-2" size={16} />}
            Subir Archivo
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} accept="image/*,audio/*,video/*,.zip,application/zip" />
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
          {initialData ? 'Actualizar' : 'Crear Tarea'}
        </Button>
      </div>
    </form>
  );
}
