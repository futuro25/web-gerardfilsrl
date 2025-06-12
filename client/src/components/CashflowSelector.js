import { useNavigate } from "react-router-dom";
import {
  HouseIcon,
  UsersIcon,
  ArrowLeftIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import React, { useState, useEffect } from "react";

export default function CashflowSelector() {
  const navigate = useNavigate();

  const redirectNavigation = () => {
    navigate("/cashflow");
  };

  const navItems = [
    { label: "Ingresos", icon: ArrowUp, path: "/cashflowin" },
    { label: "Egresos", icon: ArrowDown, path: "/cashflowout" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Cashflow</div>
          </div>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto mt-0 flex flex-col items-center justify-start">
        <div className="grid grid-cols-2 gap-4 mt-[20px]">
          {navItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-center p-4 hover:bg-gray-100 rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 bg-white"
              onClick={() => (window.location.href = item.path)}
            >
              <div className="flex flex-col items-center gap-2">
                <item.icon
                  className={`w-8 h-8 sm:w-16 sm:h-16 ${
                    item.label === "Ingresos"
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                />
                <span className="text-gray-900 text-sm">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
