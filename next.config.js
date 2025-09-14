/** @type {import('next').NextConfig} */



const nextConfig = {



  experimental: {



    serverActions: {



      allowedOrigins: ['localhost:3000']



    }



  },



  webpack: (config, { isServer }) => {



    if (!isServer) {



      config.resolve.fallback = {



        ...config.resolve.fallback,



        fs: false,



        net: false,



        tls: false,



        punycode: false



      }



    }







    config.externals.push({



      'utf-8-validate': 'commonjs utf-8-validate',



      'bufferutil': 'commonjs bufferutil',



    })







    return config



  },



}







module.exports = nextConfig 


