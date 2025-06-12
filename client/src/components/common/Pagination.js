import React from "react";
import { Button, IconButton, Typography } from "@material-tailwind/react";
import { range } from "lodash";
import { ArrowLeftIcon, ArrowRightIcon } from "../icons";
 
export function Pagination({onChange, totalPages, currentPage=1}) {
  const [active, setActive] = React.useState(currentPage);
 
  const getItemProps = (index) =>
    ({
      variant: active === index ? "filled" : "text",
      color: "gray",
      onClick: () => {
        setActive(index);
        onChange(index);
      },
    });
 
  const next = () => {
    if (active === totalPages) return;
 
    setActive(active + 1);
    onChange(active + 1)
  };
 
  const prev = () => {
    if (active === 1) return;
 
    setActive(active - 1);
    onChange(active - 1)
  };
 
  // return (
  //   <div className="flex items-center gap-4">
  //     <Button
  //       variant="text"
  //       className="flex items-center gap-2"
  //       onClick={prev}
  //       disabled={active === totalPages}
  //     >
  //       Previous
  //     </Button>
  //     <div className="flex items-center gap-2">
  //       {
  //         range(1, totalPages+1).map((page, index) => (<IconButton key={index} {...getItemProps(index)}>{index+1}</IconButton>))
  //       }
  //     </div>
  //     <Button
  //       variant="text"
  //       className="flex items-center gap-2"
  //       onClick={next}
  //       disabled={active === totalPages}
  //     >
  //       Next
  //     </Button>
  //   </div>
  // );

  return (
    <div className="flex items-center gap-8">
      <IconButton
        size="sm"
        variant="outlined"
        onClick={prev}
        disabled={active === 1}
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </IconButton>
      <Typography color="gray" className="font-normal w-40 text-center">
        Page <strong className="text-gray-900">{active}</strong> of{" "}
        <strong className="text-gray-900">{totalPages}</strong>
      </Typography>
      <IconButton
        size="sm"
        variant="outlined"
        onClick={next}
        disabled={active >= totalPages}
      >
        <ArrowRightIcon className="h-4 w-4" />
      </IconButton>
    </div>
  )
}