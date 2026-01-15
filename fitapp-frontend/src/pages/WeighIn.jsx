const WeighIn = () => (
  <>
    {/* Edge-to-edge header - spans full width */}
    <header className="bg-gradient-to-r from-blue-500 to-blue-800 px-6 py-4 text-white w-screen fixed top-0 left-0 right-0 z-50 safe-area-header">
      <h1 className="text-2xl font-bold text-center text-white">
        FitApp
      </h1>
    </header>

    <div className="max-w-md mx-auto bg-gray-50 min-h-screen relative">
      <main className="p-6 pb-24 safe-area-content">
        <h2 className="flex items-center">
          <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20" className="mr-2">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zM3 15a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1zm9-1a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1zm7-3a2 2 0 00-2-2h-2a2 2 0 00-2 2v5a3 3 0 106 0v-5z" clipRule="evenodd" />
          </svg>
          Weigh-In Page
        </h2>
      </main>
    </div>
  </>
)
export default WeighIn