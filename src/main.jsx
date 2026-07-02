import React from 'react'
import ReactDOM from 'react-dom/client'
import './features/pet/iceBearPatch.js'
import App from './App.jsx'
import GlobalStyle from './styles/GlobalStyle.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalStyle />
    <App />
  </React.StrictMode>,
)
