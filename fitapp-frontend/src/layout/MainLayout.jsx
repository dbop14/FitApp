import BottomNavigation from '../components/BottomNavigation'
import Sidebar from '../components/Sidebar'

// App shell for signed-in pages:
//  - phones: content + bottom tab bar
//  - md: icon rail on the left
//  - lg+: full sidebar with labels
// Pages render their own <PageHeader> and a `.page` content wrapper.
const MainLayout = ({ children }) => (
  <div className="min-h-screen bg-canvas text-ink">
    <Sidebar />
    <div className="flex min-h-screen flex-col md:pl-sidebar-rail lg:pl-sidebar">
      <main className="flex-1">{children}</main>
    </div>
    <BottomNavigation />
  </div>
)

export default MainLayout
