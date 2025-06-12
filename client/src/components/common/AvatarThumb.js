import React, {useState, useEffect} from "react";
import * as Avatar from '@radix-ui/react-avatar';
import { random } from "lodash";

const AvatarThumb = ({image, name, initials, onClick}) => {

  const fallBackColors = [
    'bg-red-300',
    'bg-blue-300',
    'bg-green-300',
    'bg-violet-300',
    'bg-rose-300',
    'bg-pink-300',
    'bg-fuchsia-300',
    'bg-purple-300',
    'bg-indigo-300',
    'bg-sky-300',
    'bg-teal-300',
    'bg-emerald-300',
    'bg-lime-300',
    'bg-yellow-300',
    'bg-amber-300',
    'bg-orange-300',
    'bg-red-300',
    'bg-slate-300',
  ];

  const color = fallBackColors[random(0, fallBackColors.length-1)]

  return (
    <div className="flex gap-5" onClick={onClick}>
      <Avatar.Root className={`inline-flex h-[100px] w-[100px] select-none items-center justify-center overflow-hidden rounded-full align-middle ${color}`}>
        <Avatar.Image
          className="h-full w-full rounded-[inherit] object-cover"
          src={image}
          alt={name}
        />
        <Avatar.Fallback
          className={`text-violet11 leading-1 flex h-full w-full items-center justify-center text-[15px] font-medium`}
          delayMs={600}
        >
          {initials}
        </Avatar.Fallback>
      </Avatar.Root>
    </div>
  )
};

export default AvatarThumb;