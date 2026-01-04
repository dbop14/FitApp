import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

// NOTE: This is a template/example file
// In actual usage, get clientId from environment variable:
// const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
// if (!clientId) {
//   console.error('VITE_GOOGLE_CLIENT_ID is not set')
//   return null
// }

// Example usage:
// <GoogleOAuthProvider clientId={clientId}>
//   <GoogleLogin
//     onSuccess={credentialResponse => {
//       console.log(credentialResponse)
//       // Use credentialResponse.access_token to call Google Fit API
//     }}
//     onError={() => console.log('Login Failed')}
//   />
// </GoogleOAuthProvider>