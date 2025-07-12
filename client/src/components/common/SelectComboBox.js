import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useState } from "react";

export default function SelectComboBox({ options, value, onChange }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const filteredOptions =
    query === ""
      ? options
      : options.filter((option) => {
          return option.label.toLowerCase().includes(query.toLowerCase());
        });

  return (
    <div className="w-[256px] h-[52px]">
      <Combobox
        value={value}
        onChange={(value) => {
          setSelected(value);
          onChange(value);
        }}
        onClose={() => setQuery("")}
      >
        <div className="relative">
          <ComboboxInput
            className={
              "w-full rounded border border-slate-200 py-1.5 pr-8 pl-3 text-sm text-black h-[52px]"
            }
            displayValue={(option) => option?.label || ""}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
            <ChevronDownIcon className="size-4 fill-slate-900" />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom"
          transition
          className={clsx(
            "w-[var(--input-width)] rounded border border-slate-200 bg-white p-1 [--anchor-gap:var(--spacing-1)] empty:invisible",
            "transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0"
          )}
        >
          {filteredOptions.map((option) => (
            <ComboboxOption
              key={option.id}
              value={option}
              className="group flex cursor-pointer items-center gap-2 rounded py-1.5 px-3 select-none  data-[focus]:bg-gray-100"
            >
              <CheckIcon className="invisible size-4 fill-gray-900 group-data-[selected]:visible" />
              <div className="text-sm text-black">{option.name}</div>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
    </div>
  );
}
