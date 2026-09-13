import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '录音API',
  description: '中文语音转文字：识别、区分发言人、编辑、导出 Markdown',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen bg-gray-100 flex items-start justify-center">
          <div
            className="relative bg-white flex flex-col"
            style={{ width: '100%', maxWidth: 390, height: '100dvh' }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
