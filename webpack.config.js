
module.exports = {
    context: __dirname,
    entry: {
        background: "./src/Actions/background.ts",
        options: "./src/Actions/options.tsx",
        popup: "./src/Actions/popup.tsx",
    },
    output: {
        path: __dirname + "/dist/js",
        filename: "[name].js"
    },
    node: {
        global: true
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
                loader: 'ts-loader',
            },
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                options: {
                    presets: [
                        ["env", {
                            targets: {
                                browsers: ["firefox >= 57"]
                            }
                        }],
                        "stage-0",
                        "react"
                    ]
                }
            }
        ]
    }
};
