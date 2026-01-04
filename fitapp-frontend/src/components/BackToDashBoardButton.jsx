import { useNavigate } from 'react-router-dom'

const BackToDashboardButton = () => {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/dashboard')}
      className="mt-4 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded shadow"
    >
      ⬅️ Back to Dashboard
    </button>
  )
}

export default BackToDashboardButton
