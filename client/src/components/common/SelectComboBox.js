import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export default function SelectComboBox({ options, value, onChange }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  // Handle ResizeObserver errors globally
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.('ResizeObserver loop completed with undelivered notifications')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const handleResizeObserverError = (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (e) => {
      if (e.reason && e.reason.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('error', handleResizeObserverError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('error', handleResizeObserverError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Debounce query to prevent excessive re-renders
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Memoize filtered options to prevent unnecessary recalculations
  const filteredOptions = useMemo(() => {
    if (debouncedQuery === "") {
      return options || [];
    }
    return (options || []).filter((option) => {
      return option.label.toLowerCase().includes(debouncedQuery.toLowerCase());
    });
  }, [options, debouncedQuery]);

  const handleChange = useCallback((value) => {
    setSelected(value);
    setQuery("");
    setIsOpen(false);
    onChange(value);
  }, [onChange]);

  const handleClose = useCallback(() => {
    setQuery("");
    setIsOpen(false);
  }, []);

  const handleInputChange = useCallback((event) => {
    setQuery(event.target.value);
    setIsOpen(true);
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <div className="w-[256px] h-[52px]">
      <Combobox
        value={value}
        onChange={handleChange}
        onClose={handleClose}
      >
        <div className="relative">
          <ComboboxInput
            className={
              "w-full rounded border border-slate-200 py-1.5 pr-8 pl-3 text-sm text-black h-[52px]"
            }
            displayValue={(option) => option?.label || ""}
            onChange={handleInputChange}
            onFocus={handleOpen}
          />
          <ComboboxButton 
            className="group absolute inset-y-0 right-0 px-2.5"
            onClick={handleOpen}
          >
            <ChevronDownIcon className="size-4 fill-slate-900" />
          </ComboboxButton>
        </div>

        {isOpen && (
          <ComboboxOptions
            static
            className={clsx(
              "absolute z-10 rounded border border-slate-200 bg-white p-1 shadow-lg max-h-60 overflow-auto",
              "transition duration-100 ease-in"
            )}
          >
            {filteredOptions.length === 0 ? (
              <div className="py-2 px-3 text-sm text-gray-500">
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((option) => (
                <ComboboxOption
                  key={option.id}
                  value={option}
                  className="group flex cursor-pointer items-center gap-2 rounded py-1.5 px-3 select-none hover:bg-gray-100 data-[focus]:bg-gray-100"
                >
                  <CheckIcon className="invisible size-4 fill-gray-900 group-data-[selected]:visible" />
                  <div className="text-sm text-black">{option.name}</div>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        )}
      </Combobox>
    </div>
  );
}
