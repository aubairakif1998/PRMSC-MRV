import { useCallback, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import { AlertCircle, ChevronDown, ChevronUp, Copy, Plus, Search, Trash2 } from 'lucide-react'

type SmartColumnType = 'text' | 'number' | 'dropdown' | 'image'

export type SmartTableColumn = {
  header: string
  accessorKey?: string
  type?: SmartColumnType
  required?: boolean
  options?: string[]
  min?: number
  minWidth?: string | number
  showTotal?: boolean
}

export type SmartRow = Record<string, unknown> & { _id: string | number }

type SmartTableProps = {
  columns: SmartTableColumn[]
  initialRows?: Array<Record<string, unknown>>
  year?: number
  onSaveDraft?: (rows: SmartRow[]) => void | Promise<void>
  onSubmit?: (rows: SmartRow[]) => void | Promise<void>
  loading?: boolean
  title?: string
  color?: string
}

type EditableCellProps = {
  getValue: () => unknown
  row: { index: number }
  column: { id: string; columnDef: SmartTableColumn }
  table: { options: { meta?: { updateData?: (rowIndex: number, columnId: string, value: unknown) => void } } }
}

const EditableCell = ({ getValue, row, column, table }: EditableCellProps) => {
  const initialValue = getValue()
  const [value, setValue] = useState<string>(() => (initialValue ?? '') as string)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onBlur = () => {
    const meta = table.options.meta
    const colDef = column.columnDef

    let validationError = ''
    if (colDef.required && !value && value !== ('0' as unknown as string)) {
      validationError = `${colDef.header} is required`
    }
    if (colDef.type === 'number' && value !== '' && Number.isNaN(Number(value))) {
      validationError = 'Must be a number'
    }
    if (colDef.type === 'number' && colDef.min !== undefined && Number(value) < colDef.min) {
      validationError = `Minimum value is ${colDef.min}`
    }
    setError(validationError)

    if (!validationError) {
      meta?.updateData?.(
        row.index,
        column.id,
        colDef.type === 'number' ? (value === '' ? null : Number(value)) : value,
      )
    }
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
      const nextRow = document.querySelector<HTMLInputElement>(
        `[data-row="${row.index + 1}"][data-col="${column.id}"]`,
      )
      nextRow?.focus()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        data-row={row.index}
        data-col={column.id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: error ? 'rgba(239,68,68,0.1)' : 'transparent',
          border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid transparent',
          borderRadius: '4px',
          color: '#e2e8f0',
          fontSize: '0.85rem',
          outline: 'none',
          boxSizing: 'border-box',
          minWidth: column.columnDef.minWidth ?? '80px',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.background = 'rgba(99,102,241,0.15)'
          e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'
        }}
      />
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            background: '#1e293b',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.75rem',
            color: '#ef4444',
            whiteSpace: 'nowrap',
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
          }}
        >
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  )
}

const DropdownCell = ({ getValue, row, column, table }: EditableCellProps) => {
  const value = (getValue() ?? '') as string
  const options = column.columnDef.options ?? []

  return (
    <select
      value={value}
      onChange={(e) => {
        table.options.meta?.updateData?.(row.index, column.id, e.target.value)
      }}
      style={{
        width: '100%',
        padding: '6px 8px',
        background: 'rgba(15,23,42,0.8)',
        border: '1px solid transparent',
        borderRadius: '4px',
        color: '#e2e8f0',
        fontSize: '0.85rem',
        outline: 'none',
        cursor: 'pointer',
        minWidth: column.columnDef.minWidth ?? '100px',
      }}
    >
      <option value="">— Select —</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

const ImageUploadCell = ({ getValue, row, column, table }: EditableCellProps) => {
  const value = getValue()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (file) table.options.meta?.updateData?.(row.index, column.id, file)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.3)',
          color: '#818cf8',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {value ? '📎 Change' : '📎 Upload'}
      </button>
      {Boolean(value) && (
        <span
          style={{
            fontSize: '0.7rem',
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '80px',
          }}
        >
          {value instanceof File ? value.name : String(value)}
        </span>
      )}
    </div>
  )
}

const RowNumberCell = ({ row }: { row: { index: number } }) => (
  <span style={{ color: '#475569', fontSize: '0.8rem', userSelect: 'none' }}>{row.index + 1}</span>
)

const SmartTable = ({
  columns: columnDefs,
  initialRows = [],
  year = new Date().getFullYear(),
  onSaveDraft,
  onSubmit,
  loading = false,
  title = 'Data Table',
  color = '#6366f1',
}: SmartTableProps) => {
  const [rows, setRows] = useState<SmartRow[]>(() =>
    initialRows.map((r, i) => ({ ...(r as Record<string, unknown>), _id: (r as SmartRow)._id ?? i } as SmartRow)),
  )
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [autoSaveLabel, setAutoSaveLabel] = useState('')

  const addRow = () => {
    const newRow: SmartRow = { _id: Date.now() }
    columnDefs.forEach((col) => {
      if (col.accessorKey) (newRow as Record<string, unknown>)[col.accessorKey] = ''
    })
    setRows((prev) => [...prev, newRow])
  }

  const deleteRow = (rowIndex: number) => setRows((prev) => prev.filter((_, i) => i !== rowIndex))

  const duplicateRow = (rowIndex: number) => {
    const rowToDupe: SmartRow = { ...rows[rowIndex], _id: Date.now() }
    const newRows = [...rows]
    newRows.splice(rowIndex + 1, 0, rowToDupe)
    setRows(newRows)
  }

  const updateData = useCallback((rowIndex: number, columnId: string, value: unknown) => {
    setRows((prev) => {
      const updated = [...prev]
      updated[rowIndex] = { ...(updated[rowIndex] as SmartRow), [columnId]: value } as SmartRow
      return updated
    })
    setAutoSaveLabel('saving...')
    window.setTimeout(() => setAutoSaveLabel('✓ Changes saved locally'), 800)

    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[`${rowIndex}.${columnId}`]
      return next
    })
  }, [])

  const validateRows = () => {
    const errors: Record<string, string> = {}
    let valid = true
    rows.forEach((row, i) => {
      columnDefs.forEach((col) => {
        if (!col.accessorKey) return
        const val = row[col.accessorKey]
        if (col.required && (val === '' || val === null || val === undefined)) {
          errors[`${i}.${col.accessorKey}`] = `${col.header} is required`
          valid = false
        }
        if (col.type === 'number' && val !== '' && val !== null && val !== undefined && Number.isNaN(Number(val))) {
          errors[`${i}.${col.accessorKey}`] = 'Must be a number'
          valid = false
        }
        if (col.type === 'number' && col.min !== undefined && Number(val) < col.min) {
          errors[`${i}.${col.accessorKey}`] = `Min: ${col.min}`
          valid = false
        }
      })
    })
    setRowErrors(errors)
    return valid
  }

  const totals = useMemo(() => {
    const sums: Record<string, number> = {}
    columnDefs.forEach((col) => {
      const key = col.accessorKey
      if (col.type === 'number' && col.showTotal && key) {
        sums[key] = rows.reduce((sum, row) => {
          const val = Number(row[key])
          return sum + (Number.isNaN(val) ? 0 : val)
        }, 0)
      }
    })
    return sums
  }, [rows, columnDefs])

  const tableColumns = useMemo<Array<TanstackColumnDef<SmartRow>>>(() => {
    const base: Array<TanstackColumnDef<SmartRow>> = [
      { id: '_rowNum', header: '#', cell: RowNumberCell as never, enableSorting: false, size: 40 },
      ...columnDefs.map((col) => {
        const cell =
          col.type === 'dropdown'
            ? (DropdownCell as never)
            : col.type === 'image'
              ? (ImageUploadCell as never)
              : (EditableCell as never)
        return {
          header: col.header,
          accessorKey: col.accessorKey as never,
          cell,
          meta: col,
        } as TanstackColumnDef<SmartRow>
      }),
      {
        id: '_actions',
        header: 'Actions',
        cell: ({ row }: { row: { index: number } }) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => duplicateRow(row.index)}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid rgba(148,163,184,0.2)',
                background: 'rgba(15,23,42,0.6)',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
              title="Duplicate row"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => deleteRow(row.index)}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.25)',
                background: 'rgba(239,68,68,0.08)',
                cursor: 'pointer',
                color: '#ef4444',
              }}
              title="Delete row"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
        enableSorting: false,
      } as TanstackColumnDef<SmartRow>,
    ]
    return base
  }, [columnDefs])

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    meta: { updateData },
  })

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return
    await onSaveDraft(rows)
  }

  const handleSubmit = async () => {
    if (!onSubmit) return
    if (!validateRows()) return
    await onSubmit(rows)
  }

  return (
    <div style={{ background: '#0b1220', borderRadius: '18px', border: '1px solid rgba(148,163,184,0.12)' }}>
      <div style={{ padding: '18px 18px 10px 18px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 900, color: '#e2e8f0', fontSize: '1.05rem' }}>{title}</div>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            Year: <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{year}</span>{' '}
            <span style={{ marginLeft: 10, color: '#64748b' }}>{autoSaveLabel}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            <input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search..."
              style={{
                padding: '8px 10px 8px 34px',
                borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.15)',
                background: 'rgba(15,23,42,0.55)',
                color: '#e2e8f0',
                outline: 'none',
                fontSize: '0.85rem',
                width: 220,
              }}
            />
          </div>
          <button
            type="button"
            onClick={addRow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '12px',
              background: `${color}22`,
              border: `1px solid ${color}55`,
              color,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.85rem',
            }}
          >
            <Plus size={16} /> Add Row
          </button>
        </div>
      </div>

      <div style={{ padding: '0 18px 18px 18px' }}>
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(148,163,184,0.12)' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const isSorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          fontSize: '0.78rem',
                          letterSpacing: '0.02em',
                          fontWeight: 900,
                          color: '#94a3b8',
                          background: '#0f172a',
                          borderBottom: '1px solid rgba(148,163,184,0.12)',
                          cursor: canSort ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
                              <ChevronUp size={12} style={{ opacity: isSorted === 'asc' ? 1 : 0.35 }} />
                              <ChevronDown size={12} style={{ marginTop: -2, opacity: isSorted === 'desc' ? 1 : 0.35 }} />
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = (cell.column.columnDef as unknown as { meta?: SmartTableColumn }).meta
                    const accessorKey = meta?.accessorKey
                    const hasError = accessorKey ? Boolean(rowErrors[`${row.index}.${accessorKey}`]) : false
                    return (
                      <td
                        key={cell.id}
                        style={{
                          padding: '8px 10px',
                          borderBottom: '1px solid rgba(148,163,184,0.08)',
                          background: hasError ? 'rgba(239,68,68,0.06)' : 'transparent',
                          minWidth: meta?.minWidth ?? undefined,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            {Object.keys(totals).length > 0 && (
              <tfoot>
                <tr>
                  <td style={{ padding: '10px', background: '#0f172a', borderTop: '1px solid rgba(148,163,184,0.12)' }} />
                  {columnDefs.map((col) => (
                    <td
                      key={col.accessorKey ?? col.header}
                      style={{
                        padding: '10px',
                        background: '#0f172a',
                        borderTop: '1px solid rgba(148,163,184,0.12)',
                        color: '#cbd5e1',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.showTotal && col.accessorKey ? totals[col.accessorKey]?.toLocaleString() : ''}
                    </td>
                  ))}
                  <td style={{ padding: '10px', background: '#0f172a', borderTop: '1px solid rgba(148,163,184,0.12)' }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {onSaveDraft && (
            <button
              type="button"
              disabled={loading}
              onClick={handleSaveDraft}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 900,
              }}
            >
              Save Draft
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                border: `1px solid ${color}55`,
                background: `${color}22`,
                color,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 900,
              }}
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SmartTable

