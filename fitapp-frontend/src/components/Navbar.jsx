import { Link } from 'react-router-dom'

const Navbar = () => (
  <nav className="bg-gray-900 text-white p-4 flex justify-between items-center">
    <h1 className="text-xl font-bold">FitApp</h1>
    <div className="space-x-6">
      <Link to="/dashboard" className="hover:text-green-400 font-semibold">Dashboard</Link>
      <Link to="/leaderboard" className="hover:text-yellow-400 font-semibold">Leaderboard</Link>
      <Link to="/chat" className="hover:text-indigo-400 font-semibold">Chat</Link>
      <Link to="/settings" className="hover:text-pink-400 font-semibold">Settings</Link>
    </div>
  </nav>
)

export default Navbar
