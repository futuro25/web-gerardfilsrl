import {ToastOptions, toast} from 'react-hot-toast';

import Alert from './Alert';

function customToast(message, intent = 'success', options = {}) {
  toast.custom((toast) => <Alert intent={intent} text={message} visible={toast.visible} />, options);
}

export default customToast;