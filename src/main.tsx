import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'

// macOS 下 WKWebView 视口可能不随窗口缩放更新（Tauri 已知问题，表现为
// 页面高度停留在旧窗口尺寸、底部留白）。这里监听原生 resize 事件，
// 用窗口逻辑尺寸强制矫正 <html> 高度。浏览器环境无此 API，直接跳过。
async function fixMacViewport(): Promise<void> {
  const internals = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  if (!internals) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  const apply = async () => {
    try {
      const [size, scale] = await Promise.all([win.innerSize(), win.scaleFactor()])
      const dpr = scale || 1
      document.documentElement.style.width = `${Math.round(size.width / dpr)}px`
      document.documentElement.style.height = `${Math.round(size.height / dpr)}px`
    } catch {
      /* 忽略：窗口可能已关闭 */
    }
  }
  await win.onResized(apply)
  void apply()
}

void fixMacViewport()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
