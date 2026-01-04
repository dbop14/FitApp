import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

<GoogleOAuthProvider clientId=200010665728-2vbrbqaqi1jmpps0m8tallirllsa84hd.apps.googleusercontent.com
  <GoogleLogin
    onSuccess={credentialResponse => {
      console.log(credentialResponse)
      // Use credentialResponse.access_token to call Google Fit API
    }}
    onError={() => console.log('Login Failed')}
  />
</GoogleOAuthProvider>