import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `typedRoutes` is off deliberately. Most navigation here is dynamic — trade ids come from the
  // chain — so the generated Route union rejects every `/trades/${id}` link and the shared nav
  // table. Turning it on would mean casting at each call site, which removes the safety it adds.
};

export default nextConfig;
