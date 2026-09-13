import fs from 'fs'
import path from 'path'
import type { Recording } from '@/types/transcript'

const DATA_DIR = path.join(process.cwd(), 'data')
const AUDIO_DIR = path.join(DATA_DIR, 'audio')
const DB_FILE = path.join(DATA_DIR, 'recordings.json')

function ensureDirs(): void {
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
}

function readAll(): Recording[] {
  ensureDirs()
  if (!fs.existsSync(DB_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeAll(list: Recording[]): void {
  ensureDirs()
  fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2))
}

export function listRecordings(): Recording[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function getRecording(id: string): Recording | undefined {
  return readAll().find((r) => r.id === id)
}

export function saveRecording(rec: Recording): void {
  const list = readAll()
  const idx = list.findIndex((r) => r.id === rec.id)
  if (idx >= 0) list[idx] = rec
  else list.push(rec)
  writeAll(list)
}

export function deleteRecording(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id))
  const filePath = audioFilePath(id)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

export function audioFilePath(id: string): string {
  ensureDirs()
  return path.join(AUDIO_DIR, id)
}
