// Allow Next/Image to optimize images hosted on Supabase storage
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined

const nextConfig = {
    // Pin Turbopack root to this workspace to silence multi-lockfile warning
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
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
