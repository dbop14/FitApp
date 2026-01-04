import { useContext } from 'react'
import { UserContext } from '../context/UserContext'

const StepProgress = ({ challenge }) => {
  const { user, getStepProgress } = useContext(UserContext)
  
  if (!challenge || !user) return null
  
  // Extract step goal from challenge object
  const stepGoal = challenge.stepGoal || challenge.dailyStepGoal || 10000
  const challengeName = challenge.name || challenge.challengeName || 'Daily Challenge'
  
  const { percentage, achieved } = getStepProgress(stepGoal)
  const steps = user.steps || 0
  const remaining = Math.max(0, stepGoal - steps)
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4 hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 text-base">
          {challengeName}
        </h3>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
          achieved 
            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
            : 'bg-blue-500 text-white border border-blue-600'
        }`}>
          {achieved ? '🎉 Goal Achieved!' : `${remaining.toLocaleString()} remaining`}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-gray-600">{steps.toLocaleString()} steps</span>
          <span className="text-gray-600">{stepGoal.toLocaleString()} goal</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ease-out ${
              achieved 
                ? 'bg-gradient-to-r from-blue-400 to-blue-600' 
                : 'bg-gradient-to-r from-blue-400 to-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs">
          <span className="text-gray-500 font-medium">{percentage.toFixed(1)}% complete</span>
          {achieved && (
            <span className="text-blue-600 font-semibold flex items-center">
              ✅ +1 Point Earned
            </span>
          )}
        </div>
      </div>
      
      {achieved && (
        <div className="text-center p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
          <span className="text-blue-800 text-sm font-semibold">
            🏆 Congratulations! You've earned your daily step point!
          </span>
        </div>
      )}
    </div>
  )
}

export default StepProgress