import React, { useState } from 'react';

interface BlocklistSettingProps {
  title: string;
  description: string;
  items: string[];
  blockedItems: string[];
  onToggle: (item: string, blocked: boolean) => void;
  onAdd: (item: string) => void;
  onRemove?: (item: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  placeholder?: string;
}

export function BlocklistSetting({
  title,
  description,
  items,
  blockedItems,
  onToggle,
  onAdd,
  onRemove,
  loading = false,
  emptyMessage = 'No items available.',
  placeholder = 'Add new item...',
}: BlocklistSettingProps) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setNewItem('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="blocklist-setting">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-fluid-sm font-semibold text-primary">{title}</h3>
          <p className="text-fluid-xs text-muted">{description}</p>
        </div>
        <span className="text-fluid-xs text-muted">
          {loading ? 'Saving...' : `${blockedItems.length} blocked`}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-fluid-xs text-muted">{emptyMessage}</p>
      ) : (
        <div className="chip-container">
          {items.map((item) => (
            <label
              key={item}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-fluid-xs transition focus-ring ${
                blockedItems.includes(item)
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100'
                  : 'border-slate-700 text-secondary hover:border-cyan-500/50'
              }`}
            >
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                checked={blockedItems.includes(item)}
                onChange={(e) => onToggle(item, e.target.checked)}
                disabled={loading}
              />
              <span>{item}</span>
              {onRemove && blockedItems.includes(item) && (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="ml-1 text-cyan-400 hover:text-cyan-300"
                  disabled={loading}
                >
                  ×
                </button>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="action-row mt-4">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-fluid-sm text-secondary placeholder-slate-500 focus:border-cyan-500/60 focus:outline-none focus-ring"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full border border-slate-700/60 px-5 py-2 text-fluid-sm font-semibold text-secondary hover:bg-slate-800/40 focus-ring"
          disabled={loading || !newItem.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
