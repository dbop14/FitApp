import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

// Example usage - replace with your component
// <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
//   <GoogleLogin
//     onSuccess={credentialResponse => {
//       console.log(credentialResponse)
//       // Use credentialResponse.access_token to call Google Fit API
//     }}
//     onError={() => console.log('Login Failed')}
//   />
// </GoogleOAuthProvider>