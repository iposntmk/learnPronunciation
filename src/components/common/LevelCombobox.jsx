import { useEffect, useMemo, useRef, useState } from 'react'

const ALL_OPTION = { value: 'all', label: 'Tất cả' }
const NO_LEVEL_OPTION = { value: 'none', label: 'Chưa có level' }

export default function LevelCombobox({ value, onChange, levels }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const containerRef = useRef(null)

  const options = useMemo(() => {
    const q = query.toLowerCase().trim()
    const levelOptions = levels.map(level => ({ value: level, label: level }))
    const baseOptions = [ALL_OPTION, ...levelOptions, NO_LEVEL_OPTION]

    if (!q) return baseOptions
    return baseOptions.filter(option => option.label.toLowerCase().includes(q) || option.value === 'none')
  }, [query, levels])

  const selectedLabel = value === 'all' ? ALL_OPTION.label : value === 'none' ? NO_LEVEL_OPTION.label : value

  useEffect(() => {
    if (!open) setHighlightIdx(-1)
  }, [open])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleKeyDown(event) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        setOpen(true)
        event.preventDefault()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlightIdx(index => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlightIdx(index => Math.max(index - 1, 0))
        break
      case 'Enter':
        event.preventDefault()
        if (highlightIdx >= 0 && highlightIdx < options.length) {
          onChange(options[highlightIdx].value)
          setOpen(false)
          setQuery('')
        }
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={open ? query : selectedLabel}
        onChange={event => {
          setQuery(event.target.value)
          setOpen(true)
          setHighlightIdx(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={ALL_OPTION.label}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-white placeholder:text-white/25 outline-none focus:border-white/30 cursor-default"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-2xl border border-white/10 bg-[#1a1a2e] shadow-xl max-h-60 overflow-y-auto">
          {options.map((option, index) => (
            <button
              key={option.value}
              onMouseDown={event => {
                event.preventDefault()
                onChange(option.value)
                setOpen(false)
                setQuery('')
              }}
              onMouseEnter={() => setHighlightIdx(index)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${highlightIdx === index ? 'bg-white/10 text-white' : 'text-white/70'} ${value === option.value ? 'font-semibold text-white bg-white/5' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
