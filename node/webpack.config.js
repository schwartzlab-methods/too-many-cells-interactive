const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: 'development',
    entry: {
        exportTree: path.resolve(__dirname, 'scripts', 'exportTree.ts'),
        importMatrix: path.resolve(__dirname, 'scripts', 'importMatrix.ts'),
        server: path.resolve(__dirname, 'src', 'index.ts'),
    },
    target: 'node',
    externals: {
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
                exclude: /node_modules/,
            },
            //for canvas.node
            {
                test: /\.node$/,
                use: 'node-loader',
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    experiments: {
        topLevelAwait: true,
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^pg-native$/ })],
};
