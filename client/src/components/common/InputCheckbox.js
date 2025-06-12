import * as Checkbox from '@radix-ui/react-checkbox';
import {cn} from '../../utils/utils';
import React from 'react';
import {CheckIcon} from "../icons";

export default function InputCheckbox ({label, value, checked, onCheckedChange}) {
  return (
    <div className='flex items-center justify-start gap-2'>
      <Checkbox.Root
        value={value}
        onCheckedChange={onCheckedChange}
        checked={checked}
        className={cn(
          'inline-flex w-6 h-6 transition-all duration-100 max-w-full text-left overflow-hidden whitespace-nowrap bg-gray-50 p border items-center rounded-sm cursor-pointer text-sm font-medium text-gray-900',
          {
            'bg-gray-50 border-gray-200': !checked,
            'bg-gray-100 border-gray-500': checked,
          }
        )}
      >
        <div
          className={cn('mr-2', {
            'text-gray-500': checked,
            'text-gray-300': !checked,
          })}
        >
          <Checkbox.Indicator>
            <CheckIcon className="w-full h-full" />
          </Checkbox.Indicator>
        </div>
      </Checkbox.Root>
      <span title={label} className="mr-1 truncate">
        {label}
      </span>
    </div>
  );
}
