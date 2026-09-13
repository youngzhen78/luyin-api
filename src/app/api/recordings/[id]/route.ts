import { NextRequest, NextResponse } from 'next/server'
import { getRecording, saveRecording, deleteRecording } from '@/lib/recordings-store'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const rec = getRecording(params.id)
  if (!rec) return NextResponse.json({ error: '未找到该录音' }, { status: 404 })
  return NextResponse.json({ recording: rec })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rec = getRecording(params.id)
  if (!rec) return NextResponse.json({ error: '未找到该录音' }, { status: 404 })

  const patch = await req.json()
  const updated = { ...rec, ...patch }
  saveRecording(updated)
  return NextResponse.json({ recording: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  deleteRecording(params.id)
  return NextResponse.json({ ok: true })
}
