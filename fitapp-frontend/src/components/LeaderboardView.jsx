import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../utils/constants';

const LeaderboardView = ({ challengeId }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = async () => {
    // Don't fetch if no challengeId
    if (!challengeId) {
      console.log('⚠️ No challengeId provided to LeaderboardView');
      setLoading(false);
      setError('No challenge ID provided');
      return;
    }

    try {
      console.log('🔗 Fetching leaderboard from:', `${API_BASE_URL}/api/leaderboard/${challengeId}`);
      
      const res = await fetch(`${API_BASE_URL}/api/leaderboard/${challengeId}`);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📊 Leaderboard data:', data);
      setEntries(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testBackend = async () => {
    try {
      console.log('🧪 Testing backend connection...');
      
      // Test 1: Check if backend is reachable with a simple endpoint
      console.log('🧪 Test 1: Checking backend reachability...');
      const res1 = await fetch(`${API_BASE_URL}/api/leaderboard/${challengeId}`);
      console.log('🧪 Leaderboard endpoint response:', res1.status, res1.statusText);
      
      if (res1.ok) {
        const data = await res1.json();
        console.log('🧪 Leaderboard data:', data);
        console.log('✅ Backend is reachable and leaderboard endpoint works');
      } else {
        console.log('❌ Leaderboard endpoint error:', res1.status);
      }
      
      // Test 2: Check if there are any participants in the database
      console.log('🧪 Test 2: Checking for participants...');
      const res2 = await fetch(`${API_BASE_URL}/api/leaderboard/${challengeId}`);
      if (res2.ok) {
        const participants = await res2.json();
        console.log('🧪 Participants found:', participants.length);
        if (participants.length === 0) {
          console.log('⚠️ No participants found in database for this challenge');
        } else {
          console.log('✅ Participants found:', participants);
        }
      }
      
    } catch (err) {
      console.error('❌ Backend connection failed:', err);
    }
  };

  const addUserAsParticipant = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('fitapp_user'));
      
      if (!user) {
        console.log('❌ No user found in localStorage');
        return;
      }
      
      console.log('🧪 Adding user as participant...');
      console.log('🧪 User:', user.email);
      console.log('🧪 Challenge ID:', challengeId);
      
      // Call the backend endpoint to add participant
      const response = await fetch(`${API_BASE_URL}/api/leaderboard/${challengeId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.sub,
          email: user.email,
          name: user.name,
          picture: user.picture, // Include profile picture
          startingWeight: 154 // Default weight for testing (70 kg = ~154 lbs)
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Successfully added as participant:', result);
        
        // Refresh the leaderboard to show the new participant
        fetchLeaderboard();
      } else {
        const error = await response.json();
        console.log('❌ Failed to add participant:', error);
        if (error.error === 'User is already a participant in this challenge') {
          console.log('ℹ️ User is already a participant');
        }
      }
      
    } catch (err) {
      console.error('❌ Failed to add user as participant:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [challengeId]);

  if (loading) return <div>Loading leaderboard...</div>;
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 mt-4">
        <h2 className="text-xl font-bold mb-2 text-red-800">Leaderboard</h2>
        <p className="text-red-600">Error loading leaderboard: {error}</p>
        <p className="text-sm text-gray-600 mt-2">
          Challenge ID: {challengeId || 'undefined'}
        </p>
        <p className="text-sm text-gray-600">
          API URL: {API_BASE_URL}
        </p>
        <button 
          onClick={testBackend}
          className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          Test Backend Connection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-4 mt-4">
      <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
      {entries.length === 0 ? (
        <div>
          <p className="text-gray-500">No participants found for this challenge.</p>
          <div className="mt-2 space-x-2">
            <button 
              onClick={testBackend}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
            >
              Test Backend Connection
            </button>
            <button 
              onClick={addUserAsParticipant}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm"
            >
              Add Me as Participant
            </button>
          </div>
        </div>
      ) : (
        <table className="w-full text-left border">
                     <thead className="bg-indigo-100">
             <tr>
               <th className="p-2">👤 Participant</th>
               <th className="p-2">👟 Today's Steps</th>
               <th className="p-2">Step Goal Points</th>
               <th className="p-2">⚖️ Current Weight</th>
               <th className="p-2">Weight Loss %</th>
               <th className="p-2">Total</th>
             </tr>
           </thead>
          <tbody>
            {entries.map((entry, index) => {
              const weightLoss = entry.startingWeight && entry.lastWeight 
                ? ((entry.startingWeight - entry.lastWeight) / entry.startingWeight * 100).toFixed(1)
                : '0.0'

              // Check if the step data is from today
              const isToday = entry.lastStepDate ? new Date(entry.lastStepDate).toDateString() === new Date().toDateString() : false
              const stepDisplay = isToday ? (entry.lastStepCount || 0).toLocaleString() : '—'
              
              // Check if step goal is achieved (from backend or calculate from current steps)
              const stepGoalAchieved = entry.stepGoalAchieved !== undefined 
                ? entry.stepGoalAchieved 
                : (entry.currentSteps && entry.stepGoal && entry.currentSteps >= entry.stepGoal)

              return (
                <tr key={entry.userId} className="border-t">
                  <td className="p-2 font-semibold">
                    <span>#{entry.rank || (index + 1)} {entry.name}</span>
                  </td>
                  <td className="p-2">
                    <span className={isToday ? "text-blue-600 font-medium" : "text-gray-400"}>
                      {stepDisplay}
                      {stepGoalAchieved && isToday && (
                        <span className="ml-2 text-green-600" title="Step goal achieved!">✅</span>
                      )}
                    </span>
                  </td>
                  <td className="p-2">
                    {entry.stepGoalPoints || 0}
                  </td>
                  <td className="p-2">
                    {entry.lastWeight ? `${entry.lastWeight.toFixed(1)} lbs` : '—'}
                  </td>
                  <td className="p-2">
                    {weightLoss}%
                  </td>
                  <td className="p-2 font-bold text-green-700">{entry.points || entry.totalPoints || 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default LeaderboardView;