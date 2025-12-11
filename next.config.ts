/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ticketmaster.com',
      },
      {
        protocol: 'https',
        hostname: '**.ticketm.net',
      },
      {
        protocol: 'https',
        hostname: '**.eventbrite.com',
      },
      {
        protocol: 'https',
        hostname: '**.evbuc.com',
      },
      {
        protocol: 'https',
        hostname: '**.artscentremelbourne.com.au',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'admin.marrinergroup.com.au',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'whatson.melbourne.vic.gov.au',
      },
      {
        protocol: 'https',
        hostname: 'applications-media.feverup.com',
        port: '',
        pathname: '/image/upload/**',
      },
    ],
  },
};

export default nextConfig;