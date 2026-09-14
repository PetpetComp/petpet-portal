"use client";
import { useId, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function SearchBox<T>({
  query,
  onQueryChange,
  matches,
  getId,
  getLabel,
  getDescription,
  onPick,
  placeholder,
  emptyLabel,
  renderEmpty,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  matches: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string;
  onPick: (item: T) => void;
  placeholder: string;
  emptyLabel: string;
  renderEmpty?: (query: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="search-select">
      <div className="search-select-input">
        <Search size={14} aria-hidden="true" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {query && (
        <ul className="search-select-results">
          {matches.length ? (
            matches.map((item) => (
              <li key={getId(item)}>
                <button type="button" onClick={() => onPick(item)}>
                  <strong>{getLabel(item)}</strong>
                  {getDescription && <small>{getDescription(item)}</small>}
                </button>
              </li>
            ))
          ) : (
            <li className="search-select-empty">
              {renderEmpty ? renderEmpty(query) : emptyLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function filterItems<T>(
  items: T[],
  query: string,
  getId: (item: T) => string,
  getLabel: (item: T) => string,
  getDescription?: (item: T) => string,
): T[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  return items
    .filter((item) =>
      (getId(item) + " " + getLabel(item) + " " + (getDescription?.(item) ?? ""))
        .toLowerCase()
        .includes(needle),
    )
    .slice(0, 8);
}

export function SearchSelect<T>({
  items,
  value,
  onChange,
  getId,
  getLabel,
  getDescription,
  placeholder = "Search",
  emptyLabel = "No matches found",
  renderEmpty,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string;
  placeholder?: string;
  emptyLabel?: string;
  renderEmpty?: (query: string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const selected = items.find((item) => getId(item) === value);
  if (selected) {
    return (
      <div className="search-select-selected">
        <div>
          <strong>{getLabel(selected)}</strong>
          {getDescription && <small>{getDescription(selected)}</small>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={() => {
            onChange("");
            setQuery("");
          }}
        >
          <X size={15} />
        </Button>
      </div>
    );
  }
  return (
    <SearchBox
      query={query}
      onQueryChange={setQuery}
      matches={filterItems(items, query, getId, getLabel, getDescription)}
      getId={getId}
      getLabel={getLabel}
      getDescription={getDescription}
      onPick={(item) => {
        onChange(getId(item));
        setQuery("");
      }}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      renderEmpty={renderEmpty}
    />
  );
}

export function MultiSearchSelect<T>({
  items,
  selectedIds,
  onAdd,
  onRemove,
  getId,
  getLabel,
  getDescription,
  placeholder = "Search",
  emptyLabel = "No matches found",
  renderEmpty,
}: {
  items: T[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string;
  placeholder?: string;
  emptyLabel?: string;
  renderEmpty?: (query: string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const selectableItems = items.filter(
    (item) => !selectedIds.includes(getId(item)),
  );
  const selected = selectedIds
    .map((id) => items.find((item) => getId(item) === id))
    .filter((item): item is T => !!item);
  return (
    <div className="multi-search-select">
      <SearchBox
        query={query}
        onQueryChange={setQuery}
        matches={filterItems(selectableItems, query, getId, getLabel, getDescription)}
        getId={getId}
        getLabel={getLabel}
        getDescription={getDescription}
        onPick={(item) => {
          onAdd(getId(item));
          setQuery("");
        }}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        renderEmpty={renderEmpty}
      />
      {selected.length > 0 && (
        <ul className="search-select-chip-list">
          {selected.map((item) => (
            <li key={getId(item)} className="search-select-selected">
              <div>
                <strong>{getLabel(item)}</strong>
                {getDescription && <small>{getDescription(item)}</small>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={"Remove " + getLabel(item)}
                title="Remove"
                onClick={() => onRemove(getId(item))}
              >
                <X size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
