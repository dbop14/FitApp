import React from 'react'

const PrivacyPolicy = () => {
  const currentYear = new Date().getFullYear()
  const lastUpdated = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto prose prose-lg">
        <h1 className="text-4xl font-bold text-blue-600 border-b-4 border-blue-600 pb-4 mb-8">
          Privacy Policy for FitApp
        </h1>
        
        <p className="text-gray-600 italic mb-8">
          Last Updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">1. Introduction</h2>
          <p>
            Welcome to FitApp ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience while using our fitness challenge application. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web application.
          </p>
          <p>
            By using FitApp, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">2. Information We Collect</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.1 Account Information</h3>
          <p>When you sign in with Google, we collect the following information from your Google account:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google ID:</strong> A unique identifier provided by Google</li>
            <li><strong>Name:</strong> Your display name from your Google account</li>
            <li><strong>Email Address:</strong> Your Google email address</li>
            <li><strong>Profile Picture:</strong> Your Google profile picture URL</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.2 Fitness Data</h3>
          <p>With your explicit permission, we access and store the following fitness data from Google Fit:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Step Count:</strong> Daily step count data</li>
            <li><strong>Weight:</strong> Body weight measurements (if available in your Google Fit account)</li>
            <li><strong>Fitness History:</strong> Historical daily records of your steps and weight</li>
          </ul>
          <p className="mt-4">
            This data is accessed through the Google Fit API using the following scopes:
          </p>
          <ul className="list-disc pl-6 space-y-2 bg-gray-50 p-4 rounded">
            <li><code className="bg-gray-200 px-2 py-1 rounded">https://www.googleapis.com/auth/fitness.activity.read</code> - To read your activity data (steps)</li>
            <li><code className="bg-gray-200 px-2 py-1 rounded">https://www.googleapis.com/auth/fitness.body.read</code> - To read your body measurements (weight)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.3 Authentication Tokens</h3>
          <p>To maintain your connection with Google Fit, we securely store:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>OAuth access tokens (encrypted)</li>
            <li>OAuth refresh tokens (encrypted)</li>
            <li>Token expiration information</li>
          </ul>
          <p>These tokens are necessary to sync your fitness data and are stored securely on our servers.</p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.4 Challenge and Social Data</h3>
          <p>When you participate in fitness challenges, we collect and store:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Challenge participation records</li>
            <li>Your progress and points within challenges</li>
            <li>Leaderboard rankings</li>
            <li>Challenge-related messages and communications</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2.5 Chat Messages</h3>
          <p>When you use the chat feature within challenges, we store:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Messages you send in challenge chat rooms</li>
            <li>Your user ID and profile picture associated with messages</li>
            <li>Message timestamps</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">3. How We Use Your Information</h2>
          <p>We use the information we collect for the following purposes:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>To Provide Our Service:</strong> To enable you to participate in fitness challenges, track your progress, and compete with friends</li>
            <li><strong>To Sync Fitness Data:</strong> To automatically retrieve and display your step count and weight from Google Fit</li>
            <li><strong>To Calculate Progress:</strong> To calculate your points, rankings, and progress within challenges</li>
            <li><strong>To Enable Communication:</strong> To allow you to send and receive messages within challenge chat rooms</li>
            <li><strong>To Display Leaderboards:</strong> To show your name, profile picture, and progress on challenge leaderboards (visible to other challenge participants)</li>
            <li><strong>To Maintain Your Account:</strong> To authenticate you and maintain your session</li>
            <li><strong>To Improve Our Service:</strong> To analyze usage patterns and improve the app's functionality</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">4. Data Sharing and Disclosure</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 With Other Users</h3>
          <p>When you join a challenge, the following information is visible to other participants in that challenge:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your name and profile picture</li>
            <li>Your step count and weight (as part of the challenge)</li>
            <li>Your progress, points, and ranking on the challenge leaderboard</li>
            <li>Messages you send in the challenge chat room</li>
          </ul>
          <p>This information is only shared with participants of challenges you have joined.</p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 With Third-Party Services</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google:</strong> We use Google OAuth for authentication and Google Fit API to access your fitness data. Your use of these services is subject to Google's Privacy Policy.</li>
            <li><strong>Hosting Services:</strong> We use cloud hosting services to store and process your data. These services are bound by strict confidentiality agreements.</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.3 Legal Requirements</h3>
          <p>We may disclose your information if required by law or in response to valid requests by public authorities (e.g., a court or government agency).</p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.4 We Do NOT Sell Your Data</h3>
          <p>We do not sell, rent, or trade your personal information or fitness data to third parties for marketing or advertising purposes.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">5. Data Storage and Security</h2>
          <p>We implement appropriate technical and organizational security measures to protect your personal information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>OAuth tokens are stored in encrypted form</li>
            <li>Data is transmitted using secure HTTPS connections</li>
            <li>Access to user data is restricted to authorized personnel only</li>
            <li>Regular security assessments and updates are performed</li>
          </ul>
          <p className="mt-4">
            However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">6. Data Retention</h2>
          <p>We retain your information for as long as necessary to provide our services and fulfill the purposes described in this policy:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Data:</strong> Retained while your account is active and for a reasonable period after account deletion</li>
            <li><strong>Fitness History:</strong> Retained to provide historical progress tracking</li>
            <li><strong>Challenge Data:</strong> Retained for the duration of the challenge and for historical records</li>
            <li><strong>Chat Messages:</strong> Retained as part of challenge history</li>
          </ul>
          <p>You may request deletion of your data at any time (see Section 8).</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">7. Your Rights and Choices</h2>
          <p>You have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access:</strong> You can access your personal data through the app's settings</li>
            <li><strong>Correction:</strong> You can update your profile information through the app</li>
            <li><strong>Deletion:</strong> You can request deletion of your account and associated data</li>
            <li><strong>Revoke Google Fit Access:</strong> You can revoke Google Fit permissions at any time through your Google account settings</li>
            <li><strong>Opt-Out of Challenges:</strong> You can leave challenges at any time, which will remove your data from that challenge's leaderboard</li>
          </ul>
          <p className="mt-4">To exercise these rights, please contact us using the information provided in Section 10.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">8. Account Deletion</h2>
          <p>
            You may request deletion of your account at any time. When you delete your account:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your account information will be removed from our active databases</li>
            <li>Your fitness data history will be deleted</li>
            <li>Your participation in active challenges will be removed</li>
            <li>Your chat messages may be anonymized or removed, depending on the challenge's status</li>
            <li>Some information may be retained in backup systems for a limited time as required by law or for legitimate business purposes</li>
          </ul>
          <p className="mt-4">
            To delete your account, please contact us at the email address provided below.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">9. Children's Privacy</h2>
          <p>
            FitApp is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete such information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">10. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>
          <p>
            Changes to this Privacy Policy are effective when they are posted on this page.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">11. Contact Us</h2>
          <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
            <p className="mb-4">If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:</p>
            <p>
              <strong>Email:</strong> support@herringm.com<br />
              <strong>Website:</strong> https://fitapp.herringm.com
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">12. Google API Services User Data Policy</h2>
          <p>
            FitApp's use of information received from Google APIs adheres to the{' '}
            <a 
              href="https://developers.google.com/terms/api-services-user-data-policy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
          </p>
          <p className="mt-4">Specifically:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>We only use Google Fit data to provide fitness tracking and challenge features within our app</li>
            <li>We do not transfer Google Fit data to third parties except as necessary to provide our service</li>
            <li>We do not use Google Fit data for advertising or marketing purposes</li>
            <li>We do not allow humans to read your Google Fit data unless you have given explicit consent or it is necessary for security purposes</li>
          </ul>
        </section>

        <hr className="my-12 border-gray-300" />
        
        <footer className="text-center text-gray-600 mt-8">
          <p>© {currentYear} FitApp. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

export default PrivacyPolicy

