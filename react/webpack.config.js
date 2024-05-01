const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const ESLintPlugin = require('eslint-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    entry: './src/index.tsx',
    devtool: 'inline-source-map',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /labels\.csv/,
                type: 'asset/source',
            },
            {
                test: /\.s[ac]ss$/i,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    output: {
        filename: 'webapp.js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            favicon: './public/favicon.ico',
            template: './src/template.ejs',
        }),
        new ESLintPlugin({
            extensions: ['ts', 'tsx'],
        }),
        new webpack.DefinePlugin({
            'process.env.DEFAULT_DEPTH': JSON.stringify(process.env.DEFAULT_DEPTH || 'NA')
        }),
    ],
    devServer: {
        compress: true,
        port: process.env.REACT_PORT,
        proxy: {
            '/api': 'http://node:3000',
            '/files': 'http://node:3000',
        },
    },
};
