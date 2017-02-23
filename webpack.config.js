var path = require('path');
var webpack = require('webpack');
var dotenv = require('dotenv');
dotenv.load();

module.exports = {
  devtool: 'eval',
  entry: [
    'webpack/hot/dev-server',
    './src/main'
  ],
  output: {
    path: path.join(__dirname, 'app'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  plugins: [

    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.ProvidePlugin({
            'es6-promise': 'es6-promise',
            'fetch': 'imports?this=>global!exports?global.fetch!whatwg-fetch'
        }),
    new webpack.DefinePlugin({
        '__CRAFT_TOKEN': `"${process.env.CRAFT_TOKEN}"`,
        '__CRAFT_URL': `"${process.env.CRAFT_URL}"`,
        '__CRAFT_OWNER': `"${process.env.CRAFT_OWNER}"`,
    }),
  ],
  resolve: {
    alias: {
      'redux': path.join(__dirname, '../../3rd-Party/redux/src')
    },
    extensions: ['', '.js', '.jsx']
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        loaders: ['react-hot', 'babel'],
        exclude: /node_modules/
      }, {
        test: /\.css?$/,
        loaders: ['style', 'raw']
      },
      {
        test: /\.(png|svg|eot|ttf|woff)$/,
        loaders: ['url']
      }
    ]
  }
};
