import { Task, UserSettings } from '@/src/types';
import { format, addDays, getDay } from 'date-fns';

export interface TimeBlock {
  start: number;
  end: number;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getFreeBlocks(
  dayTasks: TimeBlock[],
  workStart: number,
  workEnd: number,
): TimeBlock[] {
  const sorted = [...dayTasks].sort((a, b) => a.start - b.start);
  const free: TimeBlock[] = [];
  let cursor = workStart;

  for (const block of sorted) {
    if (block.start > cursor) {
      free.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < workEnd) {
    free.push({ start: cursor, end: workEnd });
  }

  return free;
}

export interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export function findAvailableSlots(
  existingTasks: Task[],
  settings: UserSettings,
  startDate: Date,
  days = 14,
): AvailableSlot[] {
  const workStart = timeToMinutes(settings.workStartTime);
  const workEnd = timeToMinutes(settings.workEndTime);

  const tasksByDate = new Map<string, TimeBlock[]>();
  for (const t of existingTasks) {
    const blocks = tasksByDate.get(t.date) ?? [];
    blocks.push({ start: timeToMinutes(t.startTime), end: timeToMinutes(t.endTime) });
    tasksByDate.set(t.date, blocks);
  }

  const slots: AvailableSlot[] = [];

  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    const dayOfWeek = getDay(date);

    if (!settings.workDays.includes(dayOfWeek)) continue;

    const dateStr = format(date, 'yyyy-MM-dd');
    const occupied = tasksByDate.get(dateStr) ?? [];
    const freeBlocks = getFreeBlocks(occupied, workStart, workEnd);

    for (const block of freeBlocks) {
      slots.push({
        date: dateStr,
        startTime: minutesToTime(block.start),
        endTime: minutesToTime(block.end),
        durationMinutes: block.end - block.start,
      });
    }
  }

  return slots;
}
