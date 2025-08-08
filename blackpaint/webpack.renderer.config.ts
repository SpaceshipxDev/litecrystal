import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import webpack from 'webpack';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new webpack.EnvironmentPlugin({
      SMB_CLIENT_ROOT: process.env.SMB_CLIENT_ROOT || '\\FWQ88\\Estara',
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
