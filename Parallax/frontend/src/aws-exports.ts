const awsConfig = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_USER_POOL_ID || 'us-east-1_09XMSdiDh',
            userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '529u5us22kb9i4623j7e0fphlc',
            signUpVerificationMethod: 'code' as const, // 'code' | 'link'
            loginWith: {
                email: true,
                phone: false,
            }
        }
    },
    API: {
        REST: {
            VibeCollabApi: {
                endpoint: import.meta.env.VITE_API_ENDPOINT?.replace(/\/$/, '') || '', // Safe strip trailing slash
                region: import.meta.env.VITE_REGION || 'us-east-1'
            }
        }
    }
};

export default awsConfig;
