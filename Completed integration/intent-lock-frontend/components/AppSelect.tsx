"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  id?: string;
  "aria-label"?: string;
  className?: string;
}

export function AppSelect({
  value,
  onChange,
  options,
  id,
  "aria-label": ariaLabel,
  className = "",
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? value;

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1);
      return;
    }
    const idx = options.findIndex((o) => o.value === value);
    setHighlightIndex(idx >= 0 ? idx : 0);
  }, [open, value, options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < options.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : options.length - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0 && options[highlightIndex]) {
      e.preventDefault();
      onChange(options[highlightIndex].value);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id ? `${id}-label` : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="app-select-trigger flex w-full items-center justify-between rounded-xl border border-border bg-input-background px-4 py-3 text-left text-foreground outline-none transition-[box-shadow,border-color] hover:border-[var(--cognitive-load)]/60 focus:border-[var(--cognitive-load)] focus:ring-2 focus:ring-[var(--cognitive-load)] focus:ring-opacity-40"
      >
        <span>{displayLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-activedescendant={highlightIndex >= 0 ? `${id ?? "list"}-opt-${highlightIndex}` : undefined}
          className="app-select-list absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightIndex;
            return (
              <li
                key={opt.value}
                id={`${id ?? "list"}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                  isSelected
                    ? "bg-[var(--cognitive-load)]/20 text-[var(--cognitive-load)]"
                    : isHighlighted
                      ? "bg-muted/80 text-foreground"
                      : "text-foreground hover:bg-muted/60"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
