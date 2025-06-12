import {Close, Content, DialogContentProps, Portal, Root, Title, Trigger} from '@radix-ui/react-dialog';
import React from 'react';

import {cn} from '../../utils/utils';

export const DialogContent = React.forwardRef(
  ({children, className, ...props}, forwardedRef) => (
    <Portal>
      <div className="fixed inset-0 z-20 bg-gray-900 backgro opacity-[0.85]" />
      <div className="fixed inset-0 z-20 backdrop-blur-sm" />

      <Content
        className={cn(
          'overflow-y-auto fixed top-1/2 left-1/2 z-20 p-8 bg-white rounded shadow-xl -translate-x-1/2 -translate-y-1/2',
          className
        )}
        {...props}
        ref={forwardedRef}
      >
        {children}
      </Content>
    </Portal>
  )
);

export const Dialog = Root;
export const DialogTrigger = Trigger;
export const DialogClose = Close;
export const DialogTitle = Title;
