import { AppRegistry, Image } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { PluginManager } from 'sn-plugin-lib';
import { buttonPressed, LASSO_BUTTON, TOOLBAR_BUTTON } from './src/buttons';

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

const icon = Image.resolveAssetSource(require('./assets/icon/icon.png')).uri;

// Toolbar button in NOTE (text boxes can only be inserted into notes, not DOCs/PDFs).
PluginManager.registerButton(1, ['NOTE'], {
  id: TOOLBAR_BUTTON,
  name: 'Super Bible',
  icon,
  showType: 1, // open the plugin UI
});

// Lasso toolbar button: shown when the lasso holds handwriting (0) or text boxes (3).
// Handwriting is read as a reference and looked up; a Super Bible text box is opened for editing.
PluginManager.registerButton(2, ['NOTE'], {
  id: LASSO_BUTTON,
  name: 'Super Bible',
  icon,
  editDataTypes: [0, 3],
  showType: 1,
});

// Registered here rather than in App so a press can't be missed while App is still loading.
PluginManager.registerButtonListener({ onButtonPress: event => buttonPressed(event?.id) });
