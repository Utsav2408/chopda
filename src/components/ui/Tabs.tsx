"use client";

import { useId, useState, type ReactNode } from "react";
import "./ui.css";

export type TabItem = {
  id: string;
  label: ReactNode;
  panel: ReactNode;
};

export type TabsProps = {
  items: TabItem[];
  defaultTabId?: string;
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  label?: string;
};

export function Tabs({ items, defaultTabId, activeTabId, onTabChange, label }: TabsProps) {
  const baseId = useId();
  const firstId = items[0]?.id ?? "";
  const [uncontrolled, setUncontrolled] = useState(defaultTabId ?? firstId);
  const current = activeTabId ?? uncontrolled;

  function select(id: string) {
    if (activeTabId === undefined) setUncontrolled(id);
    onTabChange?.(id);
  }

  const active = items.find((item) => item.id === current) ?? items[0];

  if (!active) return null;

  return (
    <div>
      <div className="ui-tabs" role="tablist" aria-label={label}>
        {items.map((item) => {
          const selected = item.id === active.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className="ui-tabs__tab"
              onClick={() => select(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
      >
        {active.panel}
      </div>
    </div>
  );
}
