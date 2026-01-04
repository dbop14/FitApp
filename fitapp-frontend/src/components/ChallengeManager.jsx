import { useState, useContext, useEffect } from 'react'
import { useChallenge } from '../context/ChallengeContext'
import { UserContext } from '../context/UserContext'
import { API_BASE_URL } from '../utils/constants'

const ChallengeManager = () => {
  const { challenge, saveChallenge, clearChallenge } = useChallenge()
  const { user } = useContext(UserContext)

  const isAdmin = challenge.admin === 'you' || challenge.admin === user.name

  const [botName, setBotName] = useState(challenge.botName)
  const [botAvatar, setBotAvatar] = useState(challenge.botAvatar)
  const [isPublic, setIsPublic] = useState(challenge.isPublic ?? true)
  const [startDate, setStartDate] = useState(challenge.startDate)
  const [endDate, setEndDate] = useState(challenge.endDate)
  const [stepGoal, setStepGoal] = useState(challenge.stepGoal)

  const handleSave = () => {
    saveChallenge({
      ...challenge,
      botName,
      botAvatar,
      isPublic,
      startDate,
      endDate,
      stepGoal
    })
    alert('✅ Challenge settings updated')
  }

  const handleLeave = () => {
    const confirmLeave = window.confirm(
      'Are you sure you want to leave or end this challenge?'
    )
    if (confirmLeave) clearChallenge()
  }

  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/challenge`)
        const data = await res.json()

        if (res.ok) {
          saveChallenge(data)
          console.log('✅ Challenge loaded:', data)
        } else {
          console.warn('⚠️ No challenge found:', data.error)
        }
      } catch (err) {
        console.error('❌ Backend fetch failed:', err)
      }
    }

    fetchChallenge()
  }, [])

  return (
    <div className="bg-white p-6 rounded shadow-md space-y-6">
      <h3 className="text-xl font-bold text-center">⚙️ Manage Challenge</h3>

      <div className="bg-gray-50 border rounded p-4 space-y-4 text-sm">
        <div className="flex items-center space-x-2">
          <label className="font-semibold w-28">Start Date:</label>
          {isAdmin ? (
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          ) : (
            <span>{challenge.startDate}</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="font-semibold w-28">End Date:</label>
          {isAdmin ? (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          ) : (
            <span>{challenge.endDate}</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="font-semibold w-28">Step Goal:</label>
          {isAdmin ? (
            <input
              type="number"
              value={stepGoal}
              onChange={(e) => setStepGoal(Number(e.target.value))}
              className="border rounded px-2 py-1 w-24"
            />
          ) : (
            <span>{challenge.stepGoal.toLocaleString()} steps</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="font-semibold w-28">Bot:</label>
          {isAdmin ? (
            <>
              <input
                type="text"
                value={botAvatar}
                onChange={(e) => setBotAvatar(e.target.value)}
                className="border rounded px-2 py-1 w-16 text-center"
                placeholder="🤖"
              />
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                className="border rounded px-2 py-1 flex-1"
                placeholder="Bot name"
              />
            </>
          ) : (
            <span>{challenge.botAvatar} {challenge.botName}</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <label className="font-semibold w-28">Code:</label>
          <span className="font-mono">{challenge.challengeCode}</span>
        </div>

        <div className="flex items-start space-x-2">
          <label className="font-semibold w-28">Participants:</label>
          <div className="text-gray-600">{challenge.participants.join(', ')}</div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="font-semibold">Visibility</label>
          {isAdmin ? (
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`px-4 py-2 rounded shadow font-semibold text-white ${
                isPublic ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              {isPublic ? 'Public 🌍' : 'Private 🔒'}
            </button>
          ) : (
            <span className="italic text-gray-600">
              {challenge.isPublic ? 'Public 🌍' : 'Private 🔒'}
            </span>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="flex justify-between pt-4">
          <button
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold"
          >
            🛑 Leave/End Challenge
          </button>
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-semibold"
          >
            💾 Save Settings
          </button>
        </div>
      ) : (
        <p className="text-center text-gray-500 italic pt-4">
          You’re a participant in this challenge. Only the creator can modify its settings.
        </p>
      )}
    </div>
  )
}

export default ChallengeManager