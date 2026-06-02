import { Routes, Route, useLocation, useNavigate, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ico } from './components/Icons'
import { ToastProvider } from './components/UI'
import { useBootstrap } from './hooks/store'
import Inventory from './pages/Inventory'
import ProductForm from './pages/ProductForm'
import ProductDetail from './pages/ProductDetail'
import CollectionDetail from './pages/CollectionDetail'
import Stock from './pages/Stock'
import Analytics from './pages/Analytics'
import Search from './pages/Search'

const page = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
}

function Shell() {
  const loc = useLocation()
  useBootstrap()
  return (
    <>
      <div className="app">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} {...page}>
            <Routes location={loc}>
              <Route path="/" element={<Inventory />} />
              <Route path="/new" element={<ProductForm />} />
              <Route path="/edit/:id" element={<ProductForm />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/collection/:id" element={<CollectionDetail />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/search" element={<Search />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
      <Nav />
    </>
  )
}

function NavBtn({ to, label, icon }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'nav-item' + (isActive ? ' on' : '')} end>
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

function Nav() {
  const loc = useLocation()
  // hide nav on full-screen forms
  if (loc.pathname.startsWith('/new') || loc.pathname.startsWith('/edit')) return null
  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavBtn to="/" label="Items" icon={<Ico.box />} />
        <NavBtn to="/stock" label="Stock" icon={<Ico.scale />} />
        <NavBtn to="/analytics" label="Insights" icon={<Ico.chart />} />
        <NavBtn to="/search" label="Search" icon={<SearchIcon />} />
      </div>
    </nav>
  )
}

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
    <path d="m20 20-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}
