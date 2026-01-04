import BottomNavigation from '../components/BottomNavigation'

const MainLayout = ({ children }) => (
  <div className="main-layout">
    <main className="main-content">
      {children}
    </main>
    <BottomNavigation />
  </div>
)

export default MainLayout