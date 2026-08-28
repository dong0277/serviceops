"use client";

import {CalendarDays, ChevronLeft, ChevronRight, X} from "lucide-react";
import {useMemo, useState} from "react";

type LocalizedDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  label: string;
  placeholder: string;
  clearLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
};

function seoulDateKey() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function changeMonth(current: string, offset: number) {
  const [year, month] = current.split("-").map(Number);
  return monthKey(new Date(Date.UTC(year, month - 1 + offset, 1)));
}

export function LocalizedDatePicker({
  value,
  onChange,
  locale,
  label,
  placeholder,
  clearLabel,
  previousMonthLabel,
  nextMonthLabel,
}: LocalizedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => (value || seoulDateKey()).slice(0, 7));
  const [year, month] = visibleMonth.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = seoulDateKey();

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {year: "numeric", month: "long", timeZone: "UTC"}),
    [locale],
  );
  const selectedDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const accessibleDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        timeZone: "UTC",
      }),
    [locale],
  );
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, {weekday: "short", timeZone: "UTC"}),
    [locale],
  );
  const weekdays = useMemo(
    () =>
      Array.from({length: 7}, (_, index) =>
        weekdayFormatter.format(new Date(Date.UTC(2026, 7, 2 + index))),
      ),
    [weekdayFormatter],
  );

  const displayValue = value
    ? selectedDateFormatter.format(new Date(`${value}T00:00:00Z`))
    : placeholder;

  function toggleCalendar() {
    if (!open) setVisibleMonth((value || seoulDateKey()).slice(0, 7));
    setOpen((current) => !current);
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleCalendar}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-[var(--so-radius-sm)] border border-line bg-white px-3 text-left text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
      >
        <span className={value ? "truncate" : "truncate text-muted"}>{displayValue}</span>
        <CalendarDays className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-[var(--so-shadow-float)]"
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label={previousMonthLabel}
              onClick={() => setVisibleMonth((current) => changeMonth(current, -1))}
              className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-subtle hover:text-ink"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-bold">{monthFormatter.format(firstDay)}</p>
            <button
              type="button"
              aria-label={nextMonthLabel}
              onClick={() => setVisibleMonth((current) => changeMonth(current, 1))}
              className="flex size-9 items-center justify-center rounded-xl text-muted hover:bg-subtle hover:text-ink"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-[0.68rem] font-semibold text-muted">
            {weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="py-2" aria-hidden="true">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid">
            {Array.from({length: leadingDays}, (_, index) => (
              <span key={`empty-${index}`} aria-hidden="true" />
            ))}
            {Array.from({length: daysInMonth}, (_, index) => {
              const day = index + 1;
              const dateKey = `${visibleMonth}-${String(day).padStart(2, "0")}`;
              const selected = value === dateKey;
              const isToday = today === dateKey;
              const date = new Date(`${dateKey}T00:00:00Z`);
              return (
                <button
                  key={dateKey}
                  type="button"
                  role="gridcell"
                  aria-label={accessibleDateFormatter.format(date)}
                  aria-selected={selected}
                  onClick={() => {
                    onChange(dateKey);
                    setOpen(false);
                  }}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition ${
                    selected
                      ? "bg-brand text-white"
                      : isToday
                        ? "bg-brand-soft text-brand-strong"
                        : "text-ink hover:bg-subtle"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-muted hover:bg-subtle hover:text-ink"
            >
              <X className="size-3.5" /> {clearLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
