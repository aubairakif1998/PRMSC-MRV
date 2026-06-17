import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type DataGridColumnMeta = {
  filterVariant?: "text" | "select" | "none";
  filterOptions?: string[];
};

type DataGridProps<T extends Record<string, unknown>> = {
  title: string;
  description?: string;
  rows: T[];
  columns: Array<ColumnDef<T, unknown>>;
  exportFileName: string;
  initialPageSize?: number;
  getRowId?: (row: T) => string;
  renderRowDetails?: (row: T) => ReactNode;
  toolbarExtra?: ReactNode;
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

function getColumnMeta<T>(col: ColumnDef<T, unknown>): DataGridColumnMeta {
  return (col.meta as DataGridColumnMeta | undefined) ?? {};
}

function getColumnLabel<T>(col: Column<T, unknown>): string {
  const header = col.columnDef.header;
  if (typeof header === "string") return header;
  return col.id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DataGrid<T extends Record<string, unknown>>({
  title,
  description,
  rows,
  columns,
  exportFileName,
  initialPageSize = 25,
  getRowId: resolveRowId,
  renderRowDetails,
  toolbarExtra,
}: DataGridProps<T>) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch, columnFilters, rows.length]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      globalFilter: debouncedSearch,
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (original, index) =>
      resolveRowId ? resolveRowId(original) : String(index),
    globalFilterFn: "includesString",
  });

  const visibleLeafColumns = useMemo(
    () => table.getAllLeafColumns().filter((c) => c.getIsVisible()),
    [table, columnVisibility],
  );

  const leafColumns = useMemo(
    () => table.getAllLeafColumns(),
    [table, columnVisibility, columns],
  );

  const selectOptionsByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of table.getAllLeafColumns()) {
      const meta = getColumnMeta(col.columnDef);
      if (meta.filterVariant !== "select") continue;
      if (meta.filterOptions?.length) {
        map.set(col.id, meta.filterOptions);
        continue;
      }
      const values = new Set<string>();
      for (const row of rows) {
        const v = row[col.id];
        if (v != null && String(v).trim()) values.add(String(v));
      }
      map.set(col.id, Array.from(values).sort((a, b) => a.localeCompare(b)));
    }
    return map;
  }, [rows, table]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const { pageIndex, pageSize } = table.getState().pagination;

  const exportXlsx = useCallback(() => {
    const exportRows = table.getFilteredRowModel().rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const col of visibleLeafColumns) {
        out[String(col.columnDef.header ?? col.id)] = r.getValue(col.id);
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${safeFileName(exportFileName)}.xlsx`);
  }, [exportFileName, table, visibleLeafColumns]);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setColumnFilters([]);
    setExpandedRowId(null);
  }, []);

  const toggleRow = useCallback((rowId: string) => {
    setExpandedRowId((prev) => (prev === rowId ? null : rowId));
  }, []);

  const hasActiveFilters =
    searchInput.trim().length > 0 || columnFilters.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <Badge variant="secondary" className="text-xs font-normal">
                {filteredCount.toLocaleString()} systems
              </Badge>
            </div>
            {description ? (
              <p className="max-w-2xl text-xs leading-relaxed text-slate-500">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search all columns…"
                className="h-9 border-slate-200 bg-white pl-9 pr-9 text-sm shadow-sm"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            {toolbarExtra}

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-slate-600"
              >
                Clear filters
              </Button>
            ) : null}

            <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
              <PopoverTrigger
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <SlidersHorizontal className="size-3.5" />
                Columns
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Show / hide columns
                </p>
                <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
                  {leafColumns.map((col) => (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-slate-50"
                    >
                      <Checkbox
                        checked={col.getIsVisible()}
                        onCheckedChange={(checked) => {
                          col.toggleVisibility(checked === true);
                        }}
                      />
                      <span className="text-sm text-slate-700">
                        {getColumnLabel(col)}
                      </span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button size="sm" className="h-9 gap-1.5" onClick={exportXlsx}>
              <Download className="size-3.5" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Column filter row */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {table.getAllLeafColumns().map((col) => {
            const meta = getColumnMeta(col.columnDef);
            if (meta.filterVariant === "none" || !col.getIsVisible()) return null;
            const label = String(col.columnDef.header ?? col.id);

            if (meta.filterVariant === "select") {
              const options = selectOptionsByColumn.get(col.id) ?? [];
              const current = (col.getFilterValue() as string) ?? "all";
              return (
                <div key={col.id} className="space-y-1">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {label}
                  </label>
                  <Select
                    value={current}
                    onValueChange={(v) =>
                      col.setFilterValue(v === "all" ? undefined : v)
                    }
                  >
                    <SelectTrigger className="h-8 w-full bg-white text-xs">
                      <SelectValue placeholder={`All ${label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            return (
              <div key={col.id} className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </label>
                <Input
                  value={(col.getFilterValue() ?? "") as string}
                  onChange={(e) => col.setFilterValue(e.target.value || undefined)}
                  placeholder={`Filter ${label}…`}
                  className="h-8 bg-white text-xs"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 bg-slate-50">
                {renderRowDetails ? (
                  <th className="w-10 px-2 py-2.5" aria-label="Expand" />
                ) : null}
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-600"
                    >
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <span className="text-primary">↑</span>
                          ) : sorted === "desc" ? (
                            <span className="text-primary">↓</span>
                          ) : (
                            <span className="text-slate-300">↕</span>
                          )}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowId = row.id;
              const isExpanded = expandedRowId === rowId;
              return (
                <Fragment key={rowId}>
                  <tr
                    className={cn(
                      "border-b border-slate-100 transition-colors hover:bg-slate-50/80",
                      isExpanded && "bg-primary/5",
                    )}
                  >
                    {renderRowDetails ? (
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => toggleRow(rowId)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </Button>
                      </td>
                    ) : null}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5 text-xs text-slate-700">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {renderRowDetails && isExpanded ? (
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <td
                        colSpan={row.getVisibleCells().length + 1}
                        className="px-4 py-4"
                      >
                        {renderRowDetails(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    table.getAllLeafColumns().filter((c) => c.getIsVisible()).length +
                    (renderRowDetails ? 1 : 0)
                  }
                  className="px-4 py-16 text-center text-sm text-slate-500"
                >
                  No systems match your current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Showing{" "}
          <span className="font-medium text-slate-800">
            {table.getRowModel().rows.length === 0
              ? 0
              : pageIndex * pageSize + 1}
            –
            {Math.min((pageIndex + 1) * pageSize, filteredCount)}
          </span>{" "}
          of{" "}
          <span className="font-medium text-slate-800">
            {filteredCount.toLocaleString()}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="h-8 w-[72px] bg-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Badge variant="outline" className="h-8 min-w-[88px] justify-center text-xs">
              {pageCount === 0 ? 0 : pageIndex + 1} / {pageCount}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
