import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  left?: React.ReactNode
  right?: React.ReactNode
}

export default function PageHeader({ title, subtitle, left, right }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 pt-12 pb-2">
      <div className="flex items-center gap-2 min-w-0">
        {left}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  )
}
