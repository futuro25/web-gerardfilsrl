import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "../../utils/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1",
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({
  className,
  fill,
  primaryColor,
  textColor,
  ...props
}) => (
  <TabsPrimitive.Trigger
    className={cn(
      `data-[state=active]:text-[${textColor}] ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`,
      fill
        ? `data-[state=active]:bg-[${primaryColor}] rounded text-xs`
        : `data-[state=active]:border-b-2 data-[state=active]:border-[${primaryColor}] data-[state=active]:font-bold`,
      className
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }) => (
  <TabsPrimitive.Content
    className={cn(
      "ring-offset-background focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
