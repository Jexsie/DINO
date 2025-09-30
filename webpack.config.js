const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const dotenv = require("dotenv").config({ path: __dirname + "/.env" });
const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = {
  entry: "./src/bootstrap.js",
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: isDevelopment ? "output.js" : "output.[contenthash].js",
    publicPath: "/",
    clean: true,
  },
  mode: isDevelopment ? "development" : "production",
  devServer: {
    static: [
      {
        directory: path.join(__dirname, "./assets"),
        publicPath: "/",
      },
      {
        directory: path.join(__dirname, "./dist"),
      },
    ],
    port: 8080,
    open: true,
    historyApiFallback: true,
    allowedHosts: "all",
    host: "0.0.0.0",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          isDevelopment ? "style-loader" : MiniCssExtractPlugin.loader,
          "css-loader",
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
        type: "asset/resource",
        generator: {
          filename: "images/[name].[hash][ext]",
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        generator: {
          filename: "fonts/[name].[hash][ext]",
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      inject: true, // This will auto-inject the script tags
      minify: !isDevelopment,
    }),
    !isDevelopment &&
      new MiniCssExtractPlugin({
        filename: "[name].[contenthash].css",
      }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(dotenv.parsed),
      "process.env.NODE_ENV": JSON.stringify(
        isDevelopment ? "development" : "production"
      ),
      Buffer: ["buffer", "Buffer"],
    }),
    // Copy assets folder to dist
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "assets",
          to: "assets",
          noErrorOnMissing: true,
        },
      ],
    }),
  ].filter(Boolean),
  resolve: {
    extensions: [".js", ".jsx", ".json"],
    fallback: {
      buffer: require.resolve("buffer/"),
    },
  },
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
};
