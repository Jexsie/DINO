const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/bootstrap.js", // your existing entry
  output: {
    path: path.resolve(__dirname, "./dist"), // build output folder
    filename: "output.js",
    clean: true,
  },
  mode: "development", // switch to production for final build
  devServer: {
    static: {
      directory: path.join(__dirname, "./assets"), // serve files from www
    },
    port: 8080,
    open: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html", // points to your game HTML
    }),
  ],
};
