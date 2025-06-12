import {CheckCircleSolidIcon, ExclamationCircleSolidIcon, XCircleSolidIcon} from '../../common/icons';

const alertVariants = {
  success: {
    class: 'text-success-dark bg-success-light border-none',
    icon: <CheckCircleSolidIcon className="w-5 h-5" aria-hidden="true" />,
  },
  danger: {
    class: 'text-danger-dark bg-danger-light border-none',
    icon: <XCircleSolidIcon className="w-5 h-5" aria-hidden="true" />,
  },

  warning: {
    class: 'text-alert-dark bg-alert-light border-none',
    icon: <ExclamationCircleSolidIcon className="w-5 h-5" aria-hidden="true" />,
  },
};

function Alert({text = '', intent = 'success', fullWidth = false, visible}) {
  const width = fullWidth ? 'min-w-full' : 'max-w-2xl';
  const baseStyles = `flex min-h-12 pl-2 pr-2 rounded text-base items-center ${width}`;

  return (
    <div className={`${baseStyles} ${alertVariants[intent]['class']} ${visible ? 'animate-enter' : 'animate-leave'}`}>
      <div>{alertVariants[intent]['icon']}</div>
      <span className="pl-2">{text}</span>
    </div>
  );
}

export default Alert;