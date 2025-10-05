// module.exports = {
//     apps: [
//         {
//             name: 'saas-backend',
//             script: 'dist/src/main.js',
//             instances: 1,
//             exec_mode: 'cluster',
//             watch: false,
//             max_memory_restart: '1G',
//             env: {
//                 NODE_ENV: 'production',
//             },
//             error_file: './logs/err.log',
//             out_file: './logs/out.log',
//             log_file: './logs/combined.log',
//             time: true,
//         },
//     ],
// };


module.exports = {
    apps: [
        {
            name: 'saas-api',  // 👈 CAMBIO: era 'saas-backend'
            script: 'dist/main.js',  // 👈 CAMBIO: era 'dist/src/main.js'
            instances: 1,
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_file: './logs/combined.log',
            time: true,
        },
    ],
};
