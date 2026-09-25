import { AppRegistry, Image } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { PluginManager } from 'sn-plugin-lib';

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// Toolbar button in NOTE (text boxes can only be inserted into notes, not DOCs/PDFs).
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: 'snBible',
  icon: Image.resolveAssetSource(require('./assets/icon/icon.png')).uri,
  showType: 1, // open the plugin UI
});
