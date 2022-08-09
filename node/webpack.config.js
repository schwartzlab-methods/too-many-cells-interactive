const path = require('path');

module.exports = {
    mode: 'development',
    entry: path.resolve(__dirname, 'scripts/exportTree.ts'),
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
        filename: 'export-tree.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
