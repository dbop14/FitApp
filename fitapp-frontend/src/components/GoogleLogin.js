import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

<GoogleOAuthProvider clientId=200010665728-4s6dbvd4aopi1lre28k6av1n9jc1lacc.apps.googleusercontent.com
  <GoogleLogin
    onSuccess={credentialResponse => {
      console.log(credentialResponse)
      // Use credentialResponse.access_token to call Google Fit API
    }}
    onError={() => console.log('Login Failed')}
  />
</GoogleOAuthProvider>