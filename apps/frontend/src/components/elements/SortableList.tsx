"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Daftar yang urutannya bisa digeser lewat pegangan titik enam di kiri (mouse, sentuh, atau keyboard:
 * fokus ke pegangan, Spasi, panah, Spasi). `ids` harus stabil per item, bukan indeks.
 */
export function SortableList({
  ids,
  onMove,
  itemLabel,
  disabled,
  children,
}: {
  ids: string[];
  onMove: (from: number, to: number) => void;
  /** Nama item untuk pembaca layar, misalnya (i) => `ketentuan ${i + 1}`. */
  itemLabel: (index: number) => string;
  disabled?: boolean;
  children: (index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Tekan Spasi untuk mengangkat, panah atas atau bawah untuk memindahkan, Spasi lagi untuk meletakkan, atau Escape untuk batal.",
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {ids.map((id, index) => (
            <SortableRow
              key={id}
              id={id}
              label={itemLabel(index)}
              disabled={disabled}
            >
              {children(index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex items-start gap-1 rounded-md bg-background",
        isDragging && "z-10 shadow-[0_8px_24px_#1111131f]",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Geser ${label}`}
        disabled={disabled}
        className="mt-5 flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-foreground focus-visible:ring-1 focus-visible:ring-foreground focus-visible:outline-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-[18px]" />
      </button>
      <div className="flex min-w-0 flex-1 items-start gap-1">{children}</div>
    </div>
  );
}
