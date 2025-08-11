import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import webpack from 'webpack';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new webpack.EnvironmentPlugin({
      // Ensure the default UNC path retains its double leading slashes
      SMB_CLIENT_ROOT:
        process.env.SMB_CLIENT_ROOT || "\\\\192.168.5.21\\d\\Estara\\Tasks",
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
