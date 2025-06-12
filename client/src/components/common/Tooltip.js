import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import {cva} from 'class-variance-authority';
import * as React from 'react';

import {cn, tw} from '../../utils/utils';

const TooltipTrigger = TooltipPrimitive.Trigger;

function Tooltip({
  children,
  ...tooltipProps
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root {...tooltipProps}>{children}</TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

const tooltipArrowVariants = cva(tw`w-3.5 h-1.5 `, {
  variants: {
    intent: {
      primary: tw`fill-green-500`,
      dark: tw`fill-gray-900`,
      danger: tw`fill-danger-light`,
      alert: tw`fill-alert-light`,
      white: tw`fill-white`,
    },
  },
  defaultVariants: {
    intent: 'dark',
  },
});
const tooltipVariants = cva(
  tw`z-50 overflow-hidden rounded-[20px] px-4 py-3 text-base shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`,
  {
    variants: {
      intent: {
        primary: tw`bg-green-500  text-green-900`,
        dark: tw`bg-gray-900 text-white`,
        danger: tw`bg-danger-light text-danger`,
        alert: tw`bg-alert-light text-alert-dark `,
        white: tw` bg-white text-gray-900`,
      },
    },
    defaultVariants: {
      intent: 'dark',
    },
  }
);

const TooltipContent = (({sideOffset, intent, className, ...props}) => {
  return (
    <TooltipPrimitive.Content sideOffset={sideOffset} className={cn(tooltipVariants({intent, className}))} {...props} />
  );
});

const TooltipArrow = (({intent, ...props}) => {
  return <TooltipPrimitive.Arrow className={cn(tooltipArrowVariants({intent}))} {...props} />;
});

TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export {Tooltip, TooltipTrigger, TooltipContent, TooltipArrow, tooltipVariants};
