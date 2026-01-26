import React from 'react'

const TermsOfService = () => {
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
          Terms of Service for FitApp
        </h1>
        
        <p className="text-gray-600 italic mb-8">
          Last Updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            Welcome to FitApp ("we," "our," or "us"). By accessing or using our fitness challenge application, including our mobile and web services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and FitApp. We may update these Terms from time to time, and your continued use of the Service after such changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">2. Description of Service</h2>
          <p>
            FitApp is a fitness challenge application that allows users to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Track fitness activities, including step counts and weight measurements</li>
            <li>Participate in fitness challenges with other users</li>
            <li>Compete on leaderboards and earn points based on fitness achievements</li>
            <li>Communicate with other participants through in-app chat features</li>
            <li>Sync fitness data from Google Fit</li>
          </ul>
          <p className="mt-4">
            We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">3. User Accounts and Registration</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.1 Account Creation</h3>
          <p>To use FitApp, you must:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Be at least 13 years of age (or the age of majority in your jurisdiction)</li>
            <li>Create an account using Google OAuth authentication</li>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.2 Account Responsibility</h3>
          <p>You are responsible for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All activities that occur under your account</li>
            <li>Maintaining the confidentiality of your account information</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
            <li>Ensuring that your use of the Service complies with all applicable laws</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3.3 Account Termination</h3>
          <p>
            We reserve the right to suspend or terminate your account at any time, with or without notice, if you violate these Terms or engage in any fraudulent, abusive, or illegal activity.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">4. Fitness Data and Google Fit Integration</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.1 Data Accuracy</h3>
          <p>
            FitApp relies on data from Google Fit and other sources. While we strive to provide accurate information, we cannot guarantee the accuracy, completeness, or reliability of fitness data. You acknowledge that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fitness data may be subject to errors or delays</li>
            <li>Data synchronization depends on third-party services (Google Fit)</li>
            <li>You are responsible for ensuring your fitness tracking devices are properly configured</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4.2 Google Fit Permissions</h3>
          <p>
            By connecting your Google Fit account, you grant FitApp permission to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Read your activity data (step counts)</li>
            <li>Read your body measurements (weight)</li>
            <li>Store and process this data to provide our Service</li>
          </ul>
          <p className="mt-4">
            You may revoke these permissions at any time through your Google account settings, which will limit or disable certain features of the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">5. Challenges and Competition</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.1 Challenge Participation</h3>
          <p>
            When you join a challenge, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Participate fairly and honestly</li>
            <li>Not manipulate or falsify fitness data</li>
            <li>Respect other participants</li>
            <li>Abide by any specific rules or guidelines for individual challenges</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.2 Points and Rankings</h3>
          <p>
            Points, rankings, and leaderboard positions are calculated based on fitness data and challenge rules. We reserve the right to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Adjust or recalculate points if we detect errors or fraudulent activity</li>
            <li>Remove users from challenges for violations of these Terms</li>
            <li>Modify challenge rules or scoring mechanisms</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5.3 Prohibited Conduct</h3>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Manipulate, falsify, or artificially inflate fitness data</li>
            <li>Use automated systems, bots, or scripts to generate false activity</li>
            <li>Share your account with others to gain unfair advantages</li>
            <li>Interfere with or disrupt the Service or other users' experiences</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">6. User Content and Communications</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.1 Chat Messages</h3>
          <p>
            When you use the chat feature, you are responsible for the content of your messages. You agree not to post content that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Is illegal, harmful, threatening, abusive, or harassing</li>
            <li>Violates the rights of others (including privacy and intellectual property rights)</li>
            <li>Contains spam, advertising, or unsolicited promotional content</li>
            <li>Is false, misleading, or defamatory</li>
            <li>Contains personal information of others without consent</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.2 Content Moderation</h3>
          <p>
            We reserve the right to monitor, review, and remove any user content that violates these Terms. We may suspend or ban users who repeatedly violate these rules.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6.3 License to Use Content</h3>
          <p>
            By posting content on FitApp, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the Service for the purpose of providing and improving our services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">7. Intellectual Property</h2>
          <p>
            The Service, including its design, features, functionality, and content (excluding user-generated content), is owned by FitApp and protected by copyright, trademark, and other intellectual property laws.
          </p>
          <p className="mt-4">
            You may not:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Copy, modify, or distribute any part of the Service without our written permission</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
            <li>Use our trademarks, logos, or branding without authorization</li>
            <li>Remove or alter any copyright, trademark, or other proprietary notices</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">8. Privacy and Data Protection</h2>
          <p>
            Your use of FitApp is also governed by our Privacy Policy, which explains how we collect, use, and protect your information. By using the Service, you consent to the collection and use of your information as described in our Privacy Policy.
          </p>
          <p className="mt-4">
            Please review our Privacy Policy at{' '}
            <a 
              href="/privacy-policy" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              /privacy-policy
            </a> to understand our data practices.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">9. Disclaimers and Limitations of Liability</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.1 Service Availability</h3>
          <p>
            FitApp is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The Service will be uninterrupted, secure, or error-free</li>
            <li>Defects will be corrected</li>
            <li>The Service will meet your specific requirements</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.2 Fitness and Health Disclaimer</h3>
          <p className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
            <strong>IMPORTANT:</strong> FitApp is a fitness tracking and social competition platform. It is NOT a medical or health advice service. The Service is not intended to diagnose, treat, cure, or prevent any disease or health condition. Always consult with a qualified healthcare professional before starting any fitness program or making significant changes to your exercise routine.
          </p>
          <p className="mt-4">
            You acknowledge that:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fitness activities involve inherent risks of injury</li>
            <li>You participate in challenges and activities at your own risk</li>
            <li>We are not responsible for any injuries or health issues that may result from your use of the Service</li>
            <li>You should not rely solely on FitApp for health or medical decisions</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-3">9.3 Limitation of Liability</h3>
          <p>
            To the maximum extent permitted by law, FitApp and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Loss of profits, data, or use</li>
            <li>Personal injury or property damage</li>
            <li>Errors or omissions in fitness data</li>
            <li>Service interruptions or failures</li>
          </ul>
          <p className="mt-4">
            Our total liability to you for any claims arising from your use of the Service shall not exceed the amount you paid to us (if any) in the 12 months preceding the claim, or $100, whichever is greater.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless FitApp, its operators, employees, and affiliates from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your use of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another user or third party</li>
            <li>Any content you post or transmit through the Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">11. Third-Party Services</h2>
          <p>
            FitApp integrates with third-party services, including Google OAuth and Google Fit. Your use of these services is subject to their respective terms of service and privacy policies. We are not responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The availability or functionality of third-party services</li>
            <li>The accuracy of data provided by third-party services</li>
            <li>Any issues arising from your use of third-party services</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">12. Termination</h2>
          <p>
            You may terminate your account at any time by contacting us or using account deletion features (if available). We may terminate or suspend your account immediately, without prior notice, if you breach these Terms.
          </p>
          <p className="mt-4">
            Upon termination:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your right to use the Service will immediately cease</li>
            <li>We may delete or anonymize your account data</li>
            <li>You will lose access to your fitness history and challenge participation</li>
            <li>Provisions that by their nature should survive termination will remain in effect</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">13. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of material changes by:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Posting the updated Terms on this page</li>
            <li>Updating the "Last Updated" date</li>
            <li>Providing notice through the Service (when possible)</li>
          </ul>
          <p className="mt-4">
            Your continued use of the Service after changes become effective constitutes acceptance of the updated Terms. If you do not agree to the changes, you must stop using the Service and may delete your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">14. Governing Law and Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which FitApp operates, without regard to its conflict of law provisions.
          </p>
          <p className="mt-4">
            Any disputes arising from these Terms or your use of the Service shall be resolved through:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Good faith negotiation between the parties</li>
            <li>If negotiation fails, through binding arbitration or mediation as applicable</li>
            <li>As a last resort, through the courts of competent jurisdiction</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">15. Severability</h2>
          <p>
            If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">16. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and FitApp regarding your use of the Service and supersede all prior agreements and understandings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-blue-800 mt-8 mb-4">17. Contact Information</h2>
          <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
            <p className="mb-4">If you have any questions about these Terms of Service, please contact us:</p>
            <p>
              <strong>Email:</strong> support@herringm.com<br />
              <strong>Website:</strong> https://fitapp.herringm.com
            </p>
          </div>
        </section>

        <hr className="my-12 border-gray-300" />
        
        <footer className="text-center text-gray-600 mt-8">
          <p>© {currentYear} FitApp. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

export default TermsOfService
