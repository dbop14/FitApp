import { useContext } from 'react'
import { UserContext } from '../context/UserContext'

const Header = () => {
  const { user } = useContext(UserContext)
  
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <header className="mb-8">
      {/* Main Header Section */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">
              {getGreeting()}, {user?.name || 'FitApp User'} 👋
            </h1>
            <p className="text-base text-gray-600 font-medium">
              {formatDate()}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header 