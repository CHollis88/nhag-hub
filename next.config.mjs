/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Group icons are uploaded to Supabase Storage (see
    // app/api/groups/[id]/icon/route.js, bucket "group-icons", public
    // bucket) and served from https://<project-ref>.supabase.co/storage/....
    // The project ref varies per environment/deployment, so this uses a
    // wildcard on the subdomain rather than hardcoding one ref -- and
    // scopes the path to just public storage objects, not the whole host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
