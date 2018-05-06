const NoConsolePlugin = require('no-console-webpack-plugin');

module.exports = (env, argv) => {
    const mode = argv.mode || process.env.NODE_ENV || 'development';

    const config = {
        context: __dirname,
        entry: {
            background: "./src/Actions/background.ts",
            options: "./src/Actions/options.tsx",
            popup: "./src/Actions/popup.tsx",
        },
        output: {
            path: __dirname + "/dist/js",
            filename: "[name].js",
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
                                ["env", {
                                    targets: {
                                        browsers: ["firefox >= 57"],
                                    },
                                }],
                                "stage-0",
                                "react",
                            ],
                        },
                    },
                },
            ],
        },
        plugins: [],
    };
    if (mode === 'production') {
        config.plugins.push(
            new NoConsolePlugin()
        );
    }
    return config;
};
