const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const InterpolateHtmlPlugin = require("react-dev-utils/InterpolateHtmlPlugin");
const webpack = require("webpack");

module.exports = {
    entry: path.resolve(__dirname, "..", "./src/index.tsx"),
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        // this was needed by one of the wallet adapters in @solana/wallet-adapter
        fallback: { stream: require.resolve("stream-browserify") },
    },
    module: {
        rules: [
            {
                test: /\.(ts|js)x?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "babel-loader",
                    },
                ],
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.(?:ico|gif|png|jpg|jpeg)$/i,
                type: "asset/resource",
            },
            {
                test: /\.(woff(2)?|eot|ttf|otf|svg|)$/,
                type: "asset/inline",
            },
            {
                // required to correctly resolve the @solana/web.js modules
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
    output: {
        path: path.resolve(__dirname, "..", "./build"),
        filename: "bundle.js",
    },
    plugins: [
        new webpack.ProvidePlugin({
            // @solana/web3.js was erroring trying to use the Buffer global type for some reason?
            Buffer: ["buffer", "Buffer"],
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "..", "./public/index.html"),
            manifest: path.resolve(__dirname, "..", "./public/manifest.json"),
            favicon: path.resolve(__dirname, "..", "./public/favicon.ico"),
        }),
        new InterpolateHtmlPlugin(HtmlWebpackPlugin, {
            PUBLIC_URL: path.resolve(__dirname, "..", "./public"),
            // You can pass any key-value pairs, this was just an example.
            // WHATEVER: 42 will replace %WHATEVER% with 42 in index.html.
        }),
    ],
    stats: "errors-only",
};
