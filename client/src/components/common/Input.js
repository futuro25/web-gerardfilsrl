import {VariantPropsOf, variantProps} from 'classname-variants/react';
import React from 'react';

import {cn, tw} from '../../utils/utils';

const inputStyle = variantProps({
  base: tw`w-full px-2 block text-sm-special font-sans placeholder-gray-500 border box-border rounded focus:outline-none`,
  variants: {
    intent: {
      default: tw`border-gray-100 text-gray-900 focus:ring-slate-400 focus:border-slate-400`,
      danger: tw`border-danger-light text-danger focus:ring-danger-light focus:border-danger-light`,
      disabled: tw`border-gray-100 bg-gray-50 text-gray-300 hover:cursor-not-allowed`,
    },
    size: {
      xs: tw`h-8`,
      sm: tw`h-10`,
      md: tw`h-12`,
    },
    hasRightElement: {
      true: tw`pr-12`,
    },
    hasLeftElement: {
      true: tw`pl-12`,
    },
  },
  defaultVariants: {
    intent: 'default',
    size: 'md',
  },
});

const helperTextStyle = variantProps({
  base: tw`text-sm pt-2 font-sans `,
  variants: {
    intent: {
      default: tw`text-gray-500`,
      danger: tw`text-danger`,
      disabled: tw`text-gray-500`,
    },
  },
});

export const Input = React.forwardRef(
  ({srOnly, className, leftElement, rightElement, helperText, intent = 'default', size = 'md', ...props}, ref) => {
    const inputStyles = inputStyle({
      intent,
      size,
      hasRightElement: !!rightElement,
      hasLeftElement: !!leftElement,
    });
    const helperTextStyles = helperTextStyle({intent});

    return (
      <div className="w-full">
        <label
          htmlFor={props.id}
          className={cn('text-xs-special font-sans text-gray-900 mb-2', {
            'sr-only': srOnly,
            block: !srOnly,
          })}
        >
          {props.label}
        </label>
        <div className="relative">
          {!!leftElement && <div className="absolute top-1/2 left-0 ml-2 -translate-y-1/2">{leftElement}</div>}
          <input autoComplete='false' className={`${inputStyles.className} ${className}`} {...props} ref={ref} />
          {!!rightElement && <div className="absolute top-1/2 right-0 mr-2 -translate-y-1/2">{rightElement}</div>}
        </div>
        {helperText && <p className={helperTextStyles.className}>{helperText}</p>}
      </div>
    );
  }
);
