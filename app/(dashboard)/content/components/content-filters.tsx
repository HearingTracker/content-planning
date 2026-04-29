"use client";

import { useCallback, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentFilters, ContentFilterOptions } from "./types";
import { DEFAULT_CONTENT_FILTERS } from "./types";

interface ContentFiltersProps {
  filters: ContentFilters;
  onFiltersChange: (filters: ContentFilters) => void;
  filterOptions: ContentFilterOptions;
}

export function ContentFiltersPanel({
  filters,
  onFiltersChange,
  filterOptions,
}: ContentFiltersProps) {
  const updateFilter = useCallback(
    <K extends keyof ContentFilters>(key: K, value: ContentFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange(DEFAULT_CONTENT_FILTERS);
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search ||
    filters.statuses.length > 0 ||
    filters.types.length > 0 ||
    filters.campaigns.length > 0 ||
    filters.assignees.length > 0 ||
    filters.priorities.length > 0;

  const searchId = useId();

  return (
    <div className="grid auto-rows-min gap-6">
      <FilterRow
        label="Search"
        htmlFor={searchId}
        onClear={filters.search ? () => updateFilter("search", "") : undefined}
      >
        <Input
          id={searchId}
          placeholder="Search content..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
        />
      </FilterRow>

      <FilterRow
        label="Status"
        onClear={
          filters.statuses.length > 0
            ? () => updateFilter("statuses", [])
            : undefined
        }
      >
        <MultiSelectFilter
          placeholder="All statuses"
          options={filterOptions.statuses.map((s) => ({
            value: s.slug,
            label: s.name,
          }))}
          selected={filters.statuses}
          onSelectionChange={(value) => updateFilter("statuses", value)}
        />
      </FilterRow>

      <FilterRow
        label="Type"
        onClear={
          filters.types.length > 0
            ? () => updateFilter("types", [])
            : undefined
        }
      >
        <MultiSelectFilter
          placeholder="All types"
          options={filterOptions.types.map((t) => ({
            value: t.slug,
            label: t.name,
          }))}
          selected={filters.types}
          onSelectionChange={(value) => updateFilter("types", value)}
        />
      </FilterRow>

      <FilterRow
        label="Campaign"
        onClear={
          filters.campaigns.length > 0
            ? () => updateFilter("campaigns", [])
            : undefined
        }
      >
        <MultiSelectFilter
          placeholder="All campaigns"
          options={filterOptions.campaigns.map((c) => ({
            value: String(c.id),
            label: c.name,
          }))}
          selected={filters.campaigns.map(String)}
          onSelectionChange={(value) =>
            updateFilter(
              "campaigns",
              value.map((v) => Number(v))
            )
          }
        />
      </FilterRow>

      <FilterRow
        label="Assignee"
        onClear={
          filters.assignees.length > 0
            ? () => updateFilter("assignees", [])
            : undefined
        }
      >
        <MultiSelectFilter
          placeholder="Anyone"
          options={filterOptions.users.map((u) => ({
            value: u.id,
            label: u.display_name || u.email,
          }))}
          selected={filters.assignees}
          onSelectionChange={(value) => updateFilter("assignees", value)}
        />
      </FilterRow>

      <FilterRow
        label="Priority"
        onClear={
          filters.priorities.length > 0
            ? () => updateFilter("priorities", [])
            : undefined
        }
      >
        <MultiSelectFilter
          placeholder="Any priority"
          options={[
            { value: "urgent", label: "Urgent" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          selected={filters.priorities}
          onSelectionChange={(value) =>
            updateFilter("priorities", value as ContentFilters["priorities"])
          }
        />
      </FilterRow>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="justify-self-end"
        >
          <X className="mr-1 h-3 w-3" />
          Clear all
        </Button>
      )}
    </div>
  );
}

interface FilterRowProps {
  label: string;
  htmlFor?: string;
  onClear?: () => void;
  children: React.ReactNode;
}

function FilterRow({ label, htmlFor, onClear, children }: FilterRowProps) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

interface MultiSelectFilterProps {
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onSelectionChange: (value: string[]) => void;
}

function MultiSelectFilter({
  placeholder,
  options,
  selected,
  onSelectionChange,
}: MultiSelectFilterProps) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onSelectionChange(selected.filter((s) => s !== option));
    } else {
      onSelectionChange([...selected, option]);
    }
  };

  const selectedOptions = selected
    .map((value) => options.find((o) => o.value === value))
    .filter((o): o is { value: string; label: string } => Boolean(o));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-auto min-h-9 w-full justify-between font-normal"
        >
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 py-0.5">
              {selectedOptions.length <= 2 ? (
                selectedOptions.map((o) => (
                  <Badge
                    key={o.value}
                    variant="secondary"
                    className="h-5 px-1.5 text-xs font-normal"
                  >
                    {o.label}
                  </Badge>
                ))
              ) : (
                <>
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-xs font-normal"
                  >
                    {selectedOptions[0].label}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-xs font-normal"
                  >
                    +{selectedOptions.length - 1} more
                  </Badge>
                </>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search..." className="h-8 text-sm" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-xs">
              No results.
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => toggleOption(option.value)}
                  className="text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      selected.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
