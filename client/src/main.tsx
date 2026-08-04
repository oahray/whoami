import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initCloudflareAnalytics } from './lib/cloudflareAnalytics'
import './index.css'

initCloudflareAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
