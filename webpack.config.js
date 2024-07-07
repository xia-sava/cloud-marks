const TerserPlugin = require("terser-webpack-plugin");


module.exports = {
    context: __dirname,
    entry: {
        background: "./src/actions/background.ts",
        options: "./src/actions/options.tsx",
        popup: "./src/actions/popup.tsx",
    },
    output: {
        path: __dirname + "/dist/js",
    },
    node: {
        global: true,
    },
    resolve: {
        extensions: [
            '.tsx', '.ts', '.jsx', '.js'
        ]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader'
                },
            },
            {
                test: /\.jsx?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ["@babel/preset-env", {
                                targets: {
                                    browsers: ["firefox >= 57"],
                                },
                            }],
                            // "stage-0",
                            // "react",
                        ],
                    },
                },
            },
        ],
    },
    plugins: [],
    optimization: {
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: true,
                    }
                }
            })
        ]
    }
};
