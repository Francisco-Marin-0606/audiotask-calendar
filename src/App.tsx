import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, signIn, logOut } from '@/src/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useTasks } from '@/src/hooks/useTasks';
import { useSettings } from '@/src/hooks/useSettings';
import { Task, ProposedTask } from '@/src/types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek, 
  isToday, 
  addWeeks, 
  subWeeks,
  startOfDay,
  addDays,
  isBefore,
  parseISO,
  compareAsc,
  isPast
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Paperclip, 
  Trash2, 
  Edit2, 
  Play, 
  Pause, 
  Search, 
  Settings, 
  HelpCircle, 
  Menu,
  MoreVertical,
  X,
  Music,
  CheckCircle2,
  Circle,
  CalendarClock,
  AlertTriangle,
  Repeat,
  Loader2,
  Upload,
  Video,
  FolderOpen,
  List,
  ArrowUpDown,
  FileText,
  Type,
  SkipBack,
  SkipForward,
  Volume2,
  Package,
  Users
} from 'lucide-react';
import { TaskForm } from './components/TaskForm';
import { SettingsDialog } from './components/SettingsDialog';
import { RescheduleDialog } from './components/RescheduleDialog';
import { CreateThemeDialog } from './components/CreateThemeDialog';
import { ThemeFilesView } from './components/ThemeFilesView';
import { ChatAssistant } from './components/ChatAssistant';
import { UndoToast } from './components/UndoToast';
import { useUndo } from '@/src/hooks/useUndo';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Algo salió mal.";
      try {
        const errInfo = JSON.parse(this.state.error.message);
        message = `Error en Firestore: ${errInfo.operationType} en ${errInfo.path}. ${errInfo.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }
      return (
        <div className="p-8 text-center space-y-4 bg-background min-h-screen flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-destructive">¡Ups! Algo salió mal.</h2>
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={() => window.location.reload()}>Recargar Aplicación</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const snapTo15 = (minutes: number) => Math.max(0, Math.min(1440, Math.round(minutes / 15) * 15));

const minutesToTime = (totalMinutes: number) => {
  const clamped = Math.max(0, Math.min(1439, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date()); // For the mini calendar
  const { tasks, loading, addTask, addMultipleTasks, updateTask, deleteTask, deleteTaskSeries, toggleComplete, restoreTask, restoreMultipleTasks } = useTasks();
  const { settings, saveSettings } = useSettings();

  const { pushUndo, executeUndo, canUndo, toastMessage, dismissToast, isUndoing } = useUndo({
    deleteTask,
    updateTask,
    restoreTask,
    restoreMultipleTasks,
    toggleComplete,
  });

  const undoableAddTask = useCallback(async (data: any) => {
    const ids = await addTask(data);
    pushUndo({ type: 'create', label: `Crear tarea "${data.title}"`, createdIds: ids });
  }, [addTask, pushUndo]);

  const undoableAddMultipleTasks = useCallback(async (data: any) => {
    const ids = await addMultipleTasks(data);
    pushUndo({ type: 'create-multiple', label: `Crear ${ids.length} tareas`, createdIds: ids });
  }, [addMultipleTasks, pushUndo]);

  const undoableUpdateTask = useCallback(async (id: string, newData: Partial<Task>) => {
    const current = tasks.find(t => t.id === id);
    if (current) {
      const previousData: Partial<Task> = {};
      for (const key of Object.keys(newData) as (keyof Task)[]) {
        (previousData as any)[key] = current[key];
      }
      pushUndo({ type: 'update', label: `Editar "${current.title}"`, taskId: id, previousData });
    }
    await updateTask(id, newData);
  }, [tasks, updateTask, pushUndo]);

  const undoableDeleteTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      const { id: taskId, ...data } = task;
      pushUndo({ type: 'delete', label: `Eliminar "${task.title}"`, fullTaskData: { id: taskId, ...data } });
    }
    await deleteTask(id);
  }, [tasks, deleteTask, pushUndo]);

  const undoableDeleteTaskSeries = useCallback(async (seriesId: string) => {
    const seriesTasks = tasks.filter(t => t.seriesId === seriesId);
    if (seriesTasks.length > 0) {
      const fullData = seriesTasks.map(t => {
        const { id, ...data } = t;
        return { id, data };
      });
      pushUndo({ type: 'delete-series', label: `Eliminar serie (${seriesTasks.length} tareas)`, fullTasksData: fullData });
    }
    await deleteTaskSeries(seriesId);
  }, [tasks, deleteTaskSeries, pushUndo]);

  const undoableToggleComplete = useCallback(async (id: string, currentValue: boolean) => {
    const task = tasks.find(t => t.id === id);
    pushUndo({
      type: 'toggle-complete',
      label: `${currentValue ? 'Desmarcar' : 'Completar'} "${task?.title || ''}"`,
      taskId: id,
      previousCompleted: currentValue,
    });
    await toggleComplete(id, currentValue);
  }, [tasks, toggleComplete, pushUndo]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDetailEditMode, setIsDetailEditMode] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ url: string; name: string; themeName?: string; coverUrl?: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [uploadingDetail, setUploadingDetail] = useState(false);
  const [letraText, setLetraText] = useState('');
  const [savingLetra, setSavingLetra] = useState(false);
  const [viewingText, setViewingText] = useState<{ name: string; content: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'files'>('calendar');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const [previewTasks, setPreviewTasks] = useState<ProposedTask[]>([]);
  const handlePreviewTasks = useCallback((tasks: ProposedTask[]) => setPreviewTasks(tasks), []);

  const [dragSelection, setDragSelection] = useState<{
    dayIdx: number;
    top: number;
    height: number;
  } | null>(null);
  const [newTaskDefaults, setNewTaskDefaults] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const dragRef = useRef<{
    dayIdx: number;
    day: Date;
    startY: number;
    columnEl: HTMLDivElement;
  } | null>(null);

  const [taskDrag, setTaskDrag] = useState<{
    task: Task;
    targetDayIdx: number;
    targetTop: number;
    duration: number;
  } | null>(null);
  const taskDragRef = useRef<{
    task: Task;
    duration: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const taskDragTargetRef = useRef<{ dayIdx: number; top: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const weekDaysRef = useRef<Date[]>([]);
  const updateTaskRef = useRef(undoableUpdateTask);
  updateTaskRef.current = undoableUpdateTask;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      const containerHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTop = currentMinute - containerHeight / 3;
    }
  }, [user]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (taskDragRef.current) {
        const { startClientX, startClientY, offsetY } = taskDragRef.current;
        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        if (!taskDragRef.current.hasMoved && Math.sqrt(dx * dx + dy * dy) < 5) return;
        if (!taskDragRef.current.hasMoved) {
          taskDragRef.current.hasMoved = true;
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
        }
        const grid = gridRef.current;
        if (!grid) return;
        const gridRect = grid.getBoundingClientRect();
        const colWidth = gridRect.width / 7;
        const relX = e.clientX - gridRect.left;
        const targetDayIdx = Math.max(0, Math.min(6, Math.floor(relX / colWidth)));
        const rawMinutes = e.clientY - gridRect.top - offsetY;
        const targetTop = snapTo15(rawMinutes);
        taskDragTargetRef.current = { dayIdx: targetDayIdx, top: targetTop };
        setTaskDrag({
          task: taskDragRef.current.task,
          targetDayIdx,
          targetTop,
          duration: taskDragRef.current.duration,
        });
        return;
      }

      if (!dragRef.current) return;
      const rect = dragRef.current.columnEl.getBoundingClientRect();
      const currentY = e.clientY - rect.top;
      const startY = dragRef.current.startY;
      setDragSelection({
        dayIdx: dragRef.current.dayIdx,
        top: Math.min(startY, currentY),
        height: Math.abs(currentY - startY),
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (taskDragRef.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (taskDragRef.current.hasMoved && taskDragTargetRef.current) {
          const target = taskDragTargetRef.current;
          const days = weekDaysRef.current;
          if (days[target.dayIdx]) {
            const task = taskDragRef.current.task;
            const newDate = format(days[target.dayIdx], 'yyyy-MM-dd');
            const newStart = target.top;
            const newEnd = Math.min(newStart + taskDragRef.current.duration, 1440);
            if (newDate !== task.date || minutesToTime(newStart) !== task.startTime) {
              updateTaskRef.current(task.id, {
                date: newDate,
                startTime: minutesToTime(newStart),
                endTime: minutesToTime(newEnd),
              });
            }
          }
        } else if (!taskDragRef.current.hasMoved) {
          setEditingTask(taskDragRef.current.task);
        }
        taskDragRef.current = null;
        taskDragTargetRef.current = null;
        setTaskDrag(null);
        return;
      }

      if (!dragRef.current) return;
      const { day, startY, columnEl } = dragRef.current;
      const rect = columnEl.getBoundingClientRect();
      const endY = e.clientY - rect.top;
      const dragDistance = Math.abs(endY - startY);

      let startMinutes: number;
      let endMinutes: number;

      if (dragDistance < 8) {
        startMinutes = snapTo15(startY);
        endMinutes = startMinutes + 60;
      } else {
        startMinutes = snapTo15(Math.min(startY, endY));
        endMinutes = snapTo15(Math.max(startY, endY));
        if (endMinutes <= startMinutes) endMinutes = startMinutes + 30;
      }
      endMinutes = Math.min(endMinutes, 1440);

      setNewTaskDefaults({
        date: format(day, 'yyyy-MM-dd'),
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
      });
      setIsFormOpen(true);
      dragRef.current = null;
      setDragSelection(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleDayMouseDown = (dayIdx: number, day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-task]')) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    dragRef.current = {
      dayIdx,
      day,
      startY: y,
      columnEl: e.currentTarget as HTMLDivElement,
    };
    setDragSelection({ dayIdx, top: y, height: 0 });
  };

  const handleTaskDragStart = (task: Task, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const taskEl = e.currentTarget as HTMLElement;
    const offsetY = e.clientY - taskEl.getBoundingClientRect().top;
    taskDragRef.current = {
      task,
      duration: timeToMinutes(task.endTime) - timeToMinutes(task.startTime),
      offsetY,
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasMoved: false,
    };
  };

  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: startOfCurrentWeek,
    end: endOfWeek(currentDate, { weekStartsOn: 1 })
  });
  weekDaysRef.current = weekDays;

  const miniCalendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 })
  });

  const handleAddTask = async (data: any) => {
    try {
      await undoableAddTask(data);
      setIsFormOpen(false);
      setNewTaskDefaults(null);
    } catch (err) {
      console.error('❌ Failed to add task:', err);
      alert('Error al crear la tarea. Revisá la consola para más detalles.');
    }
  };

  const handleUpdateTask = async (data: any) => {
    if (editingTask) {
      await undoableUpdateTask(editingTask.id, data);
      setEditingTask({ ...editingTask, ...data });
    }
  };

  const isTaskOverdue = (task: Task) => {
    if (task.completed) return false;
    const taskEnd = new Date(task.date + 'T' + task.endTime);
    return taskEnd < now;
  };

  const handleReschedule = async (taskId: string, date: string, startTime: string, endTime: string) => {
    await undoableUpdateTask(taskId, { date, startTime, endTime });
    setRescheduleTask(null);
    setEditingTask(null);
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const getOverlapLayout = (dayTasks: Task[]): Map<string, { column: number; totalColumns: number }> => {
    const layout = new Map<string, { column: number; totalColumns: number }>();
    if (dayTasks.length === 0) return layout;

    const sorted = [...dayTasks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    const clusters: Task[][] = [];
    let currentCluster: Task[] = [sorted[0]];
    let clusterEnd = timeToMinutes(sorted[0].endTime);

    for (let i = 1; i < sorted.length; i++) {
      const taskStart = timeToMinutes(sorted[i].startTime);
      if (taskStart < clusterEnd) {
        currentCluster.push(sorted[i]);
        clusterEnd = Math.max(clusterEnd, timeToMinutes(sorted[i].endTime));
      } else {
        clusters.push(currentCluster);
        currentCluster = [sorted[i]];
        clusterEnd = timeToMinutes(sorted[i].endTime);
      }
    }
    clusters.push(currentCluster);

    for (const cluster of clusters) {
      const columns: { end: number }[] = [];
      for (const task of cluster) {
        const start = timeToMinutes(task.startTime);
        let placed = false;
        for (let col = 0; col < columns.length; col++) {
          if (start >= columns[col].end) {
            columns[col].end = timeToMinutes(task.endTime);
            layout.set(task.id, { column: col, totalColumns: 0 });
            placed = true;
            break;
          }
        }
        if (!placed) {
          layout.set(task.id, { column: columns.length, totalColumns: 0 });
          columns.push({ end: timeToMinutes(task.endTime) });
        }
      }
      const total = columns.length;
      for (const task of cluster) {
        const entry = layout.get(task.id)!;
        entry.totalColumns = total;
      }
    }

    return layout;
  };

  const getTaskStyle = (task: Task, overlapInfo?: { column: number; totalColumns: number }) => {
    const start = timeToMinutes(task.startTime);
    const end = timeToMinutes(task.endTime);
    const duration = end - start;
    const minHeight = 22;

    if (overlapInfo && overlapInfo.totalColumns > 1) {
      const { column, totalColumns } = overlapInfo;
      const widthPercent = 100 / totalColumns;
      const leftPercent = column * widthPercent;
      return {
        top: `${start}px`,
        height: `${Math.max(duration, minHeight)}px`,
        left: `calc(${leftPercent}% + 2px)`,
        right: 'auto',
        width: `calc(${widthPercent}% - 4px)`,
      };
    }

    return {
      top: `${start}px`,
      height: `${Math.max(duration, minHeight)}px`,
    };
  };

  const getTaskDuration = (task: Task) => {
    return timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
  };

  const taskColors: Record<string, { bg: string; border: string; text: string }> = {
    audiovisual: { bg: 'bg-[#7986cb]/90', border: 'border-l-[#3f51b5]', text: 'text-white' },
    personal: { bg: 'bg-[#33b679]/90', border: 'border-l-[#0b8043]', text: 'text-white' },
    admin: { bg: 'bg-[#f4511e]/90', border: 'border-l-[#d50000]', text: 'text-white' },
  };
  const defaultColor = { bg: 'bg-gray-500/90', border: 'border-l-gray-700', text: 'text-white' };

  const getTaskColor = (type: string) => {
    const c = taskColors[type] || defaultColor;
    return `${c.bg} border-l-[3px] ${c.border} ${c.text}`;
  };

  const getTaskParticipants = (task: Task) => {
    if (!task.collaborators || task.collaborators.length === 0) return [];
    const owner = {
      uid: task.userId,
      email: '' as string,
      displayName: task.ownerDisplayName || '',
      photoURL: task.ownerPhotoURL || '',
    };
    return [owner, ...task.collaborators.filter(c => c.uid !== task.userId)];
  };

  const getThemeCover = (themeId?: string): string | undefined => {
    if (!themeId) return undefined;
    const portadaTask = tasks.find(t => t.themeId === themeId && t.themeOrder === 7);
    const coverAtt = portadaTask?.attachments?.find(a => a.type === 'image');
    return coverAtt?.url;
  };

  const playAudioTrack = (url: string, name: string, themeId?: string, themeName?: string) => {
    const coverUrl = getThemeCover(themeId);
    setPlayingAudio({ url, name, themeName, coverUrl });
    setAudioProgress(0);
    setAudioDuration(0);
    setAudioPlaying(true);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-none shadow-2xl bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
              <CalendarIcon className="text-primary w-8 h-8" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">AudioTask Calendar</CardTitle>
            <p className="text-muted-foreground">Organiza tu día, tus producciones y tu vida.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={signIn} className="w-full h-12 text-lg font-medium transition-all hover:scale-[1.02]" size="lg">
              Iniciar sesión con Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Google Calendar Style Header */}
      <header className="h-16 border-b border-border/40 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <CalendarIcon className="text-primary-foreground w-6 h-6" />
            </div>
            <span className="text-xl font-medium hidden sm:block">Calendar</span>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-9 px-4">
              Hoy
            </Button>
            <div className="flex items-center ml-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
                <ChevronLeft size={20} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
                <ChevronRight size={20} />
              </Button>
            </div>
            <h2 className="text-xl font-medium ml-4 capitalize min-w-[180px]">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="icon"><Search size={20} /></Button>
            <Button variant="ghost" size="icon"><HelpCircle size={20} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}><Settings size={20} /></Button>
          </div>
          <div className="h-8 w-[1px] bg-border mx-2 hidden md:block" />
          <div className="hidden md:flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5 rounded-md"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={15} />
              Semana
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5 rounded-md"
              onClick={() => setViewMode('list')}
            >
              <List size={15} />
              Lista
            </Button>
            <Button
              variant={viewMode === 'files' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 gap-1.5 rounded-md"
              onClick={() => setViewMode('files')}
            >
              <FolderOpen size={15} />
              Archivos
            </Button>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" alt="" />
            <Button variant="ghost" size="icon" onClick={logOut} title="Cerrar sesión">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border/40 flex flex-col p-4 gap-6 hidden md:flex shrink-0">
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setNewTaskDefaults(null);
          }}>
            <DialogTrigger render={<Button className="w-fit h-14 rounded-full shadow-lg bg-card text-foreground hover:bg-accent px-6 gap-3 border border-border/50" />}>
              <Plus className="text-primary" size={24} />
              <span className="font-medium">Crear</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
              </DialogHeader>
              <TaskForm
                key={newTaskDefaults ? `${newTaskDefaults.date}-${newTaskDefaults.startTime}-${newTaskDefaults.endTime}` : 'default'}
                onSubmit={handleAddTask}
                onCancel={() => { setIsFormOpen(false); setNewTaskDefaults(null); }}
                initialData={newTaskDefaults}
              />
            </DialogContent>
          </Dialog>

          <Button
            className="w-fit h-14 rounded-full shadow-lg bg-card text-foreground hover:bg-accent px-6 gap-3 border border-border/50"
            onClick={() => setIsThemeOpen(true)}
          >
            <Music className="text-primary" size={24} />
            <span className="font-medium">Crear Tema</span>
          </Button>

          {/* Mini Calendar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-medium capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDate(subMonths(viewDate, 1))}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDate(addMonths(viewDate, 1))}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {miniCalendarDays.map((day, i) => {
                const isSelected = isSameDay(day, currentDate);
                const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentDate(day)}
                    className={cn(
                      "h-7 w-full rounded-full flex items-center justify-center text-[11px] transition-all hover:bg-accent",
                      isSelected && "bg-primary/20 text-primary font-bold",
                      !isCurrentMonth && "opacity-30",
                      isToday(day) && !isSelected && "text-primary font-bold underline underline-offset-4"
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold px-2">Mis Calendarios</h3>
            <div className="space-y-1">
              {[
                { id: 'audiovisual', label: 'Audiovisual', color: 'bg-[#7986cb]' },
                { id: 'personal', label: 'Personal', color: 'bg-[#33b679]' },
                { id: 'admin', label: 'Administración', color: 'bg-[#f4511e]' }
              ].map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer group">
                  <div className={cn("w-4 h-4 rounded-sm", cat.color)} />
                  <span className="text-sm">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Files shortcut */}
          <button
            onClick={() => setViewMode('files')}
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors",
              viewMode === 'files' && "bg-accent"
            )}
          >
            <FolderOpen size={16} className="text-[#7986cb]" />
            <span className="text-sm font-medium">Archivos de Temas</span>
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'files' ? (
            <ThemeFilesView tasks={tasks} onPlayAudio={playAudioTrack} onViewText={(name, content) => setViewingText({ name, content })} currentUserPhoto={user?.photoURL || ''} currentUserName={user?.displayName || ''} />
          ) : viewMode === 'list' ? (
            <ScrollArea className="flex-1 min-h-0">
              <div className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Overdue Tasks */}
                {(() => {
                  const overdueTasks = tasks
                    .filter(t => !t.completed && isBefore(new Date(t.date + 'T' + t.endTime), now))
                    .sort((a, b) => compareAsc(new Date(a.date + 'T' + a.startTime), new Date(b.date + 'T' + b.startTime)));
                  if (overdueTasks.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-amber-500 flex items-center gap-2 px-1">
                        <AlertTriangle size={15} />
                        Vencidas ({overdueTasks.length})
                      </h3>
                      <div className="space-y-1">
                        {overdueTasks.map(task => (
                          <div
                            key={task.id}
                            onClick={() => setEditingTask(task)}
                            className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-colors group"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); undoableToggleComplete(task.id, false); }}
                              className="shrink-0 text-amber-500 hover:text-amber-400 transition-colors"
                            >
                              <Circle size={20} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{task.title}</span>
                                <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", getTaskColor(task.type))}>
                                  {task.type}
                                </Badge>
                                {task.themeId && <Music size={12} className="text-muted-foreground shrink-0" />}
                                {task.seriesId && <Repeat size={12} className="text-muted-foreground shrink-0" />}
                                {task.attachments && task.attachments.length > 0 && <Paperclip size={12} className="text-muted-foreground shrink-0" />}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock size={12} />
                                <span>{format(new Date(task.date + 'T00:00:00'), "EEE d MMM", { locale: es })}</span>
                                <span>•</span>
                                <span>{task.startTime} – {task.endTime}</span>
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{task.description}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={(e) => { e.stopPropagation(); undoableDeleteTask(task.id); }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Tasks grouped by day for the current week */}
                {weekDays.map((day) => {
                  const dayTasks = tasks
                    .filter(t => isSameDay(new Date(t.date + 'T00:00:00'), day))
                    .filter(t => t.completed || !isBefore(new Date(t.date + 'T' + t.endTime), now))
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div key={day.toISOString()} className="space-y-2">
                      <div className="flex items-center gap-3 px-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
                          isToday(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div>
                          <h3 className={cn(
                            "text-sm font-semibold capitalize",
                            isToday(day) && "text-primary"
                          )}>
                            {format(day, 'EEEE', { locale: es })}
                          </h3>
                          <p className="text-xs text-muted-foreground capitalize">
                            {format(day, "d 'de' MMMM", { locale: es })}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {dayTasks.filter(t => !t.completed).length} pendiente{dayTasks.filter(t => !t.completed).length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {dayTasks.length === 0 ? (
                        <div className="text-sm text-muted-foreground/50 text-center py-4 border border-dashed border-border/40 rounded-lg">
                          Sin tareas
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {dayTasks.map(task => (
                            <div
                              key={task.id}
                              onClick={() => setEditingTask(task)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 cursor-pointer transition-colors group",
                                task.completed && "opacity-50"
                              )}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); undoableToggleComplete(task.id, !!task.completed); }}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  task.completed ? "text-green-500 hover:text-green-400" : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={cn("font-medium truncate", task.completed && "line-through")}>{task.title}</span>
                                  <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", getTaskColor(task.type))}>
                                    {task.type}
                                  </Badge>
                                  {task.themeId && <Music size={12} className="text-muted-foreground shrink-0" />}
                                  {task.seriesId && <Repeat size={12} className="text-muted-foreground shrink-0" />}
                                  {task.attachments && task.attachments.length > 0 && <Paperclip size={12} className="text-muted-foreground shrink-0" />}
                                  {(() => {
                                    const participants = getTaskParticipants(task);
                                    if (participants.length === 0) return null;
                                    return (
                                      <div className="flex shrink-0">
                                        {participants.slice(0, 3).map((c, i) => (
                                          c.photoURL ? (
                                            <img key={c.uid} src={c.photoURL} alt="" className="w-6 h-6 rounded-full ring-2 ring-background object-cover" style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: participants.length - i }} referrerPolicy="no-referrer" />
                                          ) : (
                                            <div key={c.uid} className="w-6 h-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] font-bold" style={{ marginLeft: i === 0 ? 0 : '-8px', zIndex: participants.length - i }}>
                                              {(c.displayName || c.email || '?')[0]?.toUpperCase()}
                                            </div>
                                          )
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <Clock size={12} />
                                  <span>{task.startTime} – {task.endTime}</span>
                                  {task.description && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">{task.description}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                onClick={(e) => { e.stopPropagation(); undoableDeleteTask(task.id); }}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Completed summary */}
                {(() => {
                  const weekCompleted = tasks.filter(t =>
                    t.completed && weekDays.some(day => isSameDay(new Date(t.date + 'T00:00:00'), day))
                  ).length;
                  const weekTotal = tasks.filter(t =>
                    weekDays.some(day => isSameDay(new Date(t.date + 'T00:00:00'), day))
                  ).length;
                  if (weekTotal === 0) return null;
                  return (
                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-border/40">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span>{weekCompleted} de {weekTotal} tareas completadas esta semana</span>
                      </div>
                      <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          ) : (
          <>
          {/* Day Headers */}
          <div className="flex border-b border-border/40 shrink-0">
            <div className="w-16 border-r border-border/40" /> {/* Time column spacer */}
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((day, i) => (
                <div key={i} className="flex flex-col items-center py-2 border-r border-border/40 last:border-r-0">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {format(day, 'eee', { locale: es })}
                  </span>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-xl mt-1",
                    isToday(day) ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Grid */}
          <div className="flex-1 overflow-y-auto relative" ref={scrollContainerRef}>
            <div className="flex min-h-[1440px]"> {/* 24 hours * 60px */}
              {/* Time Column */}
              <div className="w-16 border-r border-border/40 flex flex-col shrink-0 bg-background/50 relative">
                <div className="h-4 border-b border-border/20">
                </div>
                {HOURS.map(hour => (
                  <div key={hour} className="h-[60px] relative border-b border-border/10">
                    <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground font-medium">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
                {/* Current Time Label */}
                {weekDays.some(day => isSameDay(day, now)) && (
                  <div 
                    className="absolute right-2 z-30 pointer-events-none text-[10px] font-bold text-red-500 bg-background px-1"
                    style={{ top: `${(now.getHours() * 60) + now.getMinutes() + 16 - 6}px` }}
                  >
                    {format(now, 'HH:mm')}
                  </div>
                )}
              </div>

              {/* Day Columns */}
              <div ref={gridRef} className="flex-1 grid grid-cols-7 relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 pointer-events-none" style={{ top: '16px' }}>
                  {HOURS.map(hour => (
                    <div key={hour} className="h-[60px] border-b border-border/20" />
                  ))}
                </div>

                {/* Current Time Indicator */}
                {weekDays.some(day => isSameDay(day, now)) && (
                  <div 
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: `${(now.getHours() * 60) + now.getMinutes() + 16}px` }}
                  >
                    <div className="grid grid-cols-7 w-full h-px bg-red-500 relative">
                      {weekDays.map((day, i) => (
                        <div key={i} className="relative">
                          {isSameDay(day, now) && (
                            <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {weekDays.map((day, dayIdx) => {
                  const dayTasks = tasks.filter(t => isSameDay(new Date(t.date + 'T00:00:00'), day));
                  const overlapLayout = getOverlapLayout(dayTasks);
                  const isDragging = dragSelection && dragSelection.dayIdx === dayIdx;
                  return (
                    <div
                      key={dayIdx}
                      className={cn(
                        "relative border-r border-border/40 last:border-r-0 cursor-crosshair",
                        isDragging && "select-none"
                      )}
                      onMouseDown={(e) => handleDayMouseDown(dayIdx, day, e)}
                    >
                      {isDragging && dragSelection.height > 4 && (
                        <div
                          className="absolute left-1 right-1 bg-primary/20 border-2 border-primary/40 rounded-sm z-20 pointer-events-none flex flex-col justify-between p-1"
                          style={{ top: `${dragSelection.top}px`, height: `${Math.max(dragSelection.height, 20)}px` }}
                        >
                          <span className="text-[10px] font-semibold text-primary leading-none">
                            {minutesToTime(snapTo15(dragSelection.top))}
                          </span>
                          {dragSelection.height > 24 && (
                            <span className="text-[10px] font-semibold text-primary leading-none text-right">
                              {minutesToTime(snapTo15(dragSelection.top + dragSelection.height))}
                            </span>
                          )}
                        </div>
                      )}
                      {dayTasks.map(task => {
                        const duration = getTaskDuration(task);
                        const isCompact = duration < 45;
                        const overlap = overlapLayout.get(task.id);
                        const hasOverlap = overlap && overlap.totalColumns > 1;
                        const isBeingDragged = taskDrag?.task.id === task.id;
                        return (
                          <div
                            key={task.id}
                            data-task
                            style={getTaskStyle(task, overlap)}
                            onMouseDown={(e) => handleTaskDragStart(task, e)}
                            title={`${task.title}\n${task.startTime} – ${task.endTime}`}
                            className={cn(
                              "absolute rounded-md overflow-hidden cursor-grab transition-all z-10 hover:brightness-110 hover:shadow-md group",
                              !hasOverlap && "left-1 right-1",
                              isCompact ? "px-2 py-0.5 flex items-center gap-1.5" : "p-1.5 px-2",
                              getTaskColor(task.type),
                              task.completed && "opacity-40",
                              isBeingDragged && "!opacity-25 !shadow-none"
                            )}
                          >
                            {isCompact ? (
                              <>
                                <span className={cn("truncate text-[11px] font-semibold leading-tight", task.completed && "line-through")}>
                                  {task.title}
                                </span>
                                <span className="text-[10px] opacity-70 shrink-0">{task.startTime}</span>
                                {task.themeId && <Music size={9} className="opacity-70 shrink-0" />}
                                {task.seriesId && <Repeat size={9} className="opacity-70 shrink-0" />}
                                {task.attachments && task.attachments.length > 0 && <Paperclip size={9} className="opacity-70 shrink-0" />}
                                {(() => {
                                  const participants = getTaskParticipants(task);
                                  if (participants.length === 0) return null;
                                  return (
                                    <div className="flex shrink-0">
                                      {participants.slice(0, 2).map((c, i) => (
                                        c.photoURL ? (
                                          <img key={c.uid} src={c.photoURL} alt="" className="w-4 h-4 rounded-full ring-[1.5px] ring-current/20 object-cover" style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: participants.length - i }} referrerPolicy="no-referrer" />
                                        ) : (
                                          <div key={c.uid} className="w-4 h-4 rounded-full bg-white/30 ring-[1.5px] ring-current/20 flex items-center justify-center text-[7px] font-bold" style={{ marginLeft: i === 0 ? 0 : '-5px', zIndex: participants.length - i }}>
                                            {(c.displayName || c.email || '?')[0]?.toUpperCase()}
                                          </div>
                                        )
                                      ))}
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <>
                                <div className={cn("truncate text-[11px] font-semibold leading-tight", task.completed && "line-through", task.collaborators?.length ? "pr-6" : "")}>{task.title}</div>
                                <div className="text-[10px] opacity-75 leading-tight">{task.startTime} – {task.endTime}</div>
                                {duration >= 60 && task.description && (
                                  <div className="text-[10px] opacity-60 truncate mt-0.5 leading-tight">{task.description}</div>
                                )}
                                <div className="flex items-center gap-1 mt-0.5 opacity-70">
                                  {task.themeId && <Music size={9} />}
                                  {task.seriesId && <Repeat size={9} />}
                                  {task.attachments && task.attachments.length > 0 && <Paperclip size={9} />}
                                  {task.attachments?.some(a => a.type === 'audio') && <Music size={9} />}
                                </div>
                                {(() => {
                                  const participants = getTaskParticipants(task);
                                  if (participants.length === 0) return null;
                                  return (
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex">
                                      {participants.slice(0, 4).map((c, i) => (
                                        c.photoURL ? (
                                          <img key={c.uid} src={c.photoURL} alt="" className="w-6 h-6 rounded-full ring-[1.5px] ring-black/20 object-cover" style={{ marginLeft: i === 0 ? 0 : '-7px', zIndex: participants.length - i, position: 'relative' }} referrerPolicy="no-referrer" />
                                        ) : (
                                          <div key={c.uid} className="w-6 h-6 rounded-full bg-white/30 ring-[1.5px] ring-black/20 flex items-center justify-center text-[9px] font-bold" style={{ marginLeft: i === 0 ? 0 : '-7px', zIndex: participants.length - i, position: 'relative' }}>
                                            {(c.displayName || c.email || '?')[0]?.toUpperCase()}
                                          </div>
                                        )
                                      ))}
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        );
                      })}
                      {/* Ghost preview blocks from AI proposals */}
                      {previewTasks
                        .filter(pt => isSameDay(new Date(pt.date + 'T00:00:00'), day))
                        .map((pt, ptIdx) => {
                          const start = timeToMinutes(pt.startTime);
                          const end = timeToMinutes(pt.endTime);
                          const duration = end - start;
                          const isCompact = duration < 45;
                          return (
                            <div
                              key={`preview-${ptIdx}`}
                              style={{ top: `${start}px`, height: `${Math.max(duration, 22)}px` }}
                              className="absolute left-1 right-1 rounded-md overflow-hidden z-10 pointer-events-none border-2 border-dashed border-violet-400/60 bg-violet-500/15 animate-[task-preview-pulse_2s_ease-in-out_infinite]"
                            >
                              <div className={isCompact ? "px-2 py-0.5 flex items-center gap-1.5" : "p-1.5 px-2"}>
                                <div className="truncate text-[11px] font-semibold leading-tight text-violet-300">{pt.title}</div>
                                {!isCompact && (
                                  <div className="text-[10px] text-violet-300/70 leading-tight">{pt.startTime} – {pt.endTime}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {/* Ghost preview for task drag */}
                      {taskDrag && taskDrag.targetDayIdx === dayIdx && (
                        <div
                          style={{
                            top: `${taskDrag.targetTop}px`,
                            height: `${Math.max(taskDrag.duration, 22)}px`,
                          }}
                          className={cn(
                            "absolute left-1 right-1 rounded-md z-30 pointer-events-none border-2 border-dashed overflow-hidden",
                            getTaskColor(taskDrag.task.type).replace(/\/90/g, '/30'),
                            "!bg-primary/10 border-primary/50"
                          )}
                        >
                          <div className={taskDrag.duration < 45 ? "px-2 py-0.5 flex items-center gap-1.5" : "p-1.5 px-2"}>
                            <div className="truncate text-[11px] font-semibold leading-tight text-primary/80">
                              {taskDrag.task.title}
                            </div>
                            {taskDrag.duration >= 45 && (
                              <div className="text-[10px] text-primary/60 leading-tight">
                                {minutesToTime(taskDrag.targetTop)} – {minutesToTime(Math.min(taskDrag.targetTop + taskDrag.duration, 1440))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </>
          )}
        </main>
      </div>

      {/* Spotify-style Audio Player */}
      <AnimatePresence>
        {playingAudio && (
          <motion.div
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            className="fixed bottom-0 left-0 right-0 z-50 h-[72px] bg-[#181818] border-t border-white/5"
          >
            <audio
              ref={audioRef}
              src={playingAudio.url}
              autoPlay
              onTimeUpdate={() => {
                if (audioRef.current) setAudioProgress(audioRef.current.currentTime);
              }}
              onLoadedMetadata={() => {
                if (audioRef.current) setAudioDuration(audioRef.current.duration);
              }}
              onEnded={() => { setPlayingAudio(null); setAudioPlaying(false); }}
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
            />
            <div className="h-full flex items-center px-4 gap-4">
              {/* Left: Cover + Info */}
              <div className="flex items-center gap-3 w-[30%] min-w-0">
                <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                  {playingAudio.coverUrl ? (
                    <img src={playingAudio.coverUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Music size={22} className="text-white/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{playingAudio.name}</p>
                  {playingAudio.themeName && (
                    <p className="text-[11px] text-white/50 truncate">{playingAudio.themeName}</p>
                  )}
                </div>
              </div>

              {/* Center: Controls + Progress */}
              <div className="flex-1 flex flex-col items-center gap-1 max-w-[45%]">
                <div className="flex items-center gap-4">
                  <button className="text-white/50 hover:text-white transition-colors">
                    <SkipBack size={18} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => {
                      if (!audioRef.current) return;
                      if (audioPlaying) audioRef.current.pause();
                      else audioRef.current.play();
                    }}
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    {audioPlaying ? (
                      <Pause size={16} className="text-black" fill="black" />
                    ) : (
                      <Play size={16} className="text-black ml-0.5" fill="black" />
                    )}
                  </button>
                  <button className="text-white/50 hover:text-white transition-colors">
                    <SkipForward size={18} fill="currentColor" />
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[11px] text-white/50 w-10 text-right tabular-nums">{formatTime(audioProgress)}</span>
                  <div
                    className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative"
                    onClick={(e) => {
                      if (!audioRef.current || !audioDuration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      audioRef.current.currentTime = pct * audioDuration;
                    }}
                  >
                    <div
                      className="h-full bg-white rounded-full relative group-hover:bg-green-400 transition-colors"
                      style={{ width: audioDuration ? `${(audioProgress / audioDuration) * 100}%` : '0%' }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
                    </div>
                  </div>
                  <span className="text-[11px] text-white/50 w-10 tabular-nums">{formatTime(audioDuration)}</span>
                </div>
              </div>

              {/* Right: Volume + Close */}
              <div className="flex items-center gap-3 w-[25%] justify-end">
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-white/50" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    defaultValue="1"
                    onChange={(e) => {
                      if (audioRef.current) audioRef.current.volume = Number(e.target.value);
                    }}
                    className="w-20 h-1 accent-white appearance-none bg-white/10 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>
                <button
                  onClick={() => { setPlayingAudio(null); setAudioPlaying(false); }}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSave={saveSettings}
      />

      {/* Reschedule Dialog */}
      {rescheduleTask && (
        <RescheduleDialog
          open={!!rescheduleTask}
          onOpenChange={(open) => !open && setRescheduleTask(null)}
          task={rescheduleTask}
          tasks={tasks}
          settings={settings}
          onReschedule={handleReschedule}
        />
      )}

      {/* Create Theme Dialog */}
      <CreateThemeDialog
        open={isThemeOpen}
        onOpenChange={setIsThemeOpen}
        tasks={tasks}
        settings={settings}
        onCreateTheme={undoableAddMultipleTasks}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => { if (!open) { setEditingTask(null); setIsDetailEditMode(false); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isDetailEditMode ? 'Editar Tarea' : 'Detalles de la Tarea'}</DialogTitle>
          </DialogHeader>
          {editingTask && isDetailEditMode ? (
            <TaskForm
              initialData={editingTask}
              onSubmit={async (data) => {
                await handleUpdateTask(data);
                setIsDetailEditMode(false);
              }}
              onCancel={() => setIsDetailEditMode(false)}
            />
          ) : editingTask && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge className={cn("capitalize", getTaskColor(editingTask.type))}>
                  {editingTask.type}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDetailEditMode(true)}
                    className="text-muted-foreground"
                    title="Editar tarea"
                  >
                    <Edit2 size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      undoableToggleComplete(editingTask.id, !!editingTask.completed);
                      setEditingTask({ ...editingTask, completed: !editingTask.completed });
                    }}
                    className={cn(editingTask.completed ? "text-green-500" : "text-muted-foreground")}
                    title={editingTask.completed ? "Marcar como pendiente" : "Marcar como completada"}
                  >
                    {editingTask.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { undoableDeleteTask(editingTask.id); setEditingTask(null); }} className="text-destructive" title="Eliminar esta tarea">
                    <Trash2 size={18} />
                  </Button>
                  {editingTask.seriesId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('¿Eliminar todas las tareas de esta serie?')) {
                          undoableDeleteTaskSeries(editingTask.seriesId!);
                          setEditingTask(null);
                        }
                      }}
                      className="text-destructive text-xs gap-1"
                      title="Eliminar toda la serie"
                    >
                      <Repeat size={14} />
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>

              {editingTask.completed && (
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium px-3 py-1.5 rounded-md flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  Tarea completada
                </div>
              )}

              {isTaskOverdue(editingTask) && (
                <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium px-3 py-2 rounded-md flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Tarea vencida
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => setRescheduleTask(editingTask)}
                  >
                    <CalendarClock size={13} />
                    Reprogramar
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <h3 className={cn("text-2xl font-bold", editingTask.completed && "line-through opacity-60")}>{editingTask.title}</h3>
                <div className="flex items-center text-muted-foreground gap-2">
                  <Clock size={16} />
                  <span>{format(new Date(editingTask.date + 'T00:00:00'), "EEEE, d 'de' MMMM", { locale: es })}</span>
                  <span>•</span>
                  <span>{editingTask.startTime} - {editingTask.endTime}</span>
                </div>
                {editingTask.seriesId && editingTask.recurrenceTotal && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Repeat size={14} className="text-primary" />
                    <span>Tarea recurrente ({(editingTask.recurrenceIndex ?? 0) + 1} de {editingTask.recurrenceTotal})</span>
                  </div>
                )}
                {editingTask.themeId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Music size={14} className="text-[#7986cb]" />
                    <span>Tema: {editingTask.themeName || 'Sin nombre'} — Paso {editingTask.themeOrder}/11</span>
                  </div>
                )}
              </div>

              <p className="text-muted-foreground leading-relaxed">{editingTask.description}</p>

              {editingTask.collaborators && editingTask.collaborators.length > 0 && (() => {
                const owner = {
                  uid: editingTask.userId,
                  displayName: editingTask.ownerDisplayName || '',
                  photoURL: editingTask.ownerPhotoURL || '',
                };
                const allParticipants = [
                  owner,
                  ...editingTask.collaborators.filter(c => c.uid !== editingTask.userId),
                ];
                return (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Users size={16} /> Participantes
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {allParticipants.map(c => (
                        <div key={c.uid} className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
                          {c.photoURL ? (
                            <img src={c.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                              {(c.displayName || (c as any).email || '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm">
                            {c.displayName || (c as any).email || 'Sin nombre'}
                            {c.uid === editingTask.userId && (
                              <span className="text-xs text-muted-foreground ml-1">(creador)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip size={16} /> Adjuntos
                </h4>
                {editingTask.attachments && editingTask.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {editingTask.attachments.map((att, i) => (
                      <div key={i} className="relative group/att">
                        {att.type === 'image' ? (
                          <div className="relative rounded-lg overflow-hidden border border-border/50">
                            <img src={att.url} alt={att.name} className="w-24 h-24 object-cover" referrerPolicy="no-referrer" />
                            <a href={att.url} target="_blank" className="absolute inset-0 bg-black/40 opacity-0 group-hover/att:opacity-100 flex items-center justify-center transition-opacity">
                              <Plus size={16} className="text-white" />
                            </a>
                          </div>
                        ) : att.type === 'video' ? (
                          <div className="relative rounded-lg overflow-hidden border border-border/50">
                            <video src={att.url} className="w-32 h-24 object-cover" controls />
                          </div>
                        ) : att.type === 'text' ? (
                          <button
                            onClick={() => setViewingText({ name: att.name, content: att.content || '' })}
                            className="flex items-center gap-2 bg-secondary p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors text-left max-w-[200px]"
                          >
                            <FileText size={18} className="text-blue-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{att.name}</span>
                              <span className="text-[11px] text-muted-foreground truncate block">{(att.content || '').slice(0, 40)}...</span>
                            </div>
                          </button>
                        ) : (att.type === 'zip' || att.name?.toLowerCase().endsWith('.zip')) ? (
                          <a
                            href={att.url}
                            download={att.name}
                            className="flex items-center gap-2 bg-secondary p-3 rounded-lg border border-border/50 hover:bg-accent transition-colors text-left max-w-[200px]"
                          >
                            <Package size={18} className="text-yellow-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{att.name}</span>
                              <span className="text-[11px] text-muted-foreground">Archivo ZIP</span>
                            </div>
                          </a>
                        ) : (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-10 gap-2 rounded-full px-4"
                            onClick={() => playAudioTrack(att.url, att.name, editingTask.themeId, editingTask.themeName)}
                          >
                            <Play size={16} />
                            <span className="max-w-[80px] truncate">{att.name}</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Letra textarea for theme steps 3 & 4 */}
                {editingTask.themeId && (editingTask.themeOrder === 3 || editingTask.themeOrder === 4) && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <Type size={14} />
                      Pegar letra
                    </label>
                    <Textarea
                      placeholder="Pega la letra de la cancion aca..."
                      rows={5}
                      value={letraText}
                      onChange={(e) => setLetraText(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={!letraText.trim() || savingLetra}
                      onClick={async () => {
                        if (!letraText.trim() || !editingTask) return;
                        setSavingLetra(true);
                        try {
                          const textAtt = { name: 'Letra.txt', type: 'text' as const, url: '', content: letraText.trim() };
                          const newAttachments = [...(editingTask.attachments || []), textAtt];
                          await undoableUpdateTask(editingTask.id, { attachments: newAttachments } as any);
                          setEditingTask({ ...editingTask, attachments: newAttachments } as Task);
                          setLetraText('');
                        } catch (err) {
                          console.error('Error saving letra:', err);
                        } finally {
                          setSavingLetra(false);
                        }
                      }}
                    >
                      {savingLetra && <Loader2 className="animate-spin mr-2" size={14} />}
                      Guardar Letra
                    </Button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative cursor-pointer gap-2"
                  disabled={uploadingDetail}
                >
                  {uploadingDetail ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  Subir Archivo
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*,audio/*,video/*,.zip,application/zip"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editingTask) return;
                      setUploadingDetail(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const response = await fetch('/api/upload', { method: 'POST', body: formData });
                        const data = await response.json();
                        if (data.url) {
                          const newAttachments = [...(editingTask.attachments || []), { name: data.name, type: data.type, url: data.url }];
                          await undoableUpdateTask(editingTask.id, { attachments: newAttachments } as any);
                          setEditingTask({ ...editingTask, attachments: newAttachments } as Task);
                        }
                      } catch (err) {
                        console.error('Upload failed:', err);
                      } finally {
                        setUploadingDetail(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </Button>
              </div>

              <div className="pt-4 border-t border-border/40 flex justify-end">
                <Button variant="outline" onClick={() => setEditingTask(null)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Text Viewer Dialog */}
      <Dialog open={!!viewingText} onOpenChange={(open) => !open && setViewingText(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              {viewingText?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90 p-4 bg-muted/30 rounded-lg">
              {viewingText?.content}
            </pre>
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingText(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Chat Assistant */}
      <ChatAssistant
        tasks={tasks}
        settings={settings}
        user={user}
        onAddTasks={undoableAddMultipleTasks}
        onAddTask={undoableAddTask}
        onPreviewTasks={handlePreviewTasks}
      />

      {/* Undo Toast */}
      <UndoToast
        message={toastMessage}
        onDismiss={dismissToast}
        onUndo={executeUndo}
        canUndo={canUndo}
      />
    </div>
  );
}
