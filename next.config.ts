// Allow Next/Image to optimize images hosted on Supabase storage
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined

const nextConfig = {
    // Pin Turbopack root to this workspace to silence multi-lockfile warning
    eslint: {
        // TODO: Remove this and fix ESLint errors for better security
        ignoreDuringBuilds: process.env.NODE_ENV === 'development',
    },
    typescript: {
        // TODO: Remove this and fix TypeScript errors for better security
        ignoreBuildErrors: process.env.NODE_ENV === 'development',
    },
    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains'
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.supabase.co https://prod.lucasaibot.uk; frame-ancestors 'none';"
                    }
                ]
            }
        ]
    },
    turbopack: {
        root: __dirname,
    },
    images: {
        remotePatterns: [
            supabaseHostname
                ? {protocol: 'https', hostname: supabaseHostname}
                : {protocol: 'https', hostname: '**.supabase.co'},
        ],
    },
}

export default nextConfig
