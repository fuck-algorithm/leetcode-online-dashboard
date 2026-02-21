import { Layout } from 'antd'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Home from './components/Home'
import Dashboard from './components/Dashboard'
import Rankings from './components/Rankings'
import Statistics from './components/Statistics'
import History from './components/History'
import Favorites from './components/Favorites'
import API from './components/API'
import MCP from './components/MCP'
import Skills from './components/Skills'
import { PreferencesProvider } from './context/PreferencesContext'
import './App.css'

const { Content } = Layout

function App() {
  return (
    <PreferencesProvider>
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Navigation />
          <Content style={{ padding: '24px', background: '#f5f5f5' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard problems={[]} loading={false} />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/history" element={<History />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/api-docs" element={<API />} />
              <Route path="/mcp" element={<MCP />} />
              <Route path="/skills" element={<Skills />} />
            </Routes>
          </Content>
        </Layout>
      </Router>
    </PreferencesProvider>
  )
}

export default App
