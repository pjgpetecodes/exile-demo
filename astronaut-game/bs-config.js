module.exports = {
    server: {
        baseDir: ['./', './dist', './src'],
        middleware: [
            (req, res, next) => {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.setHeader('Surrogate-Control', 'no-store');
                next();
            }
        ]
    },
    files: [
        './dist/**/*.js',
        './index.html',
        './src/assets/**/*'
    ]
};
