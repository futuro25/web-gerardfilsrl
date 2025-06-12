import {
  HouseIcon,
  UsersIcon,
  Calendar1Icon,
  CreditCardIcon,
  ReceiptTextIcon,
  FileInvoiceIcon,
  SettingsIcon,
  IdCardLanyardIcon,
  CircleDollarSign,
  LogOutIcon,
} from "lucide-react";
import React, { useState, useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navItems = [
    // { label: "Inicio", icon: HouseIcon, path: "/home" },
    { label: "Usuarios", icon: UsersIcon, path: "/usuarios" },
    { label: "Pagos", icon: CreditCardIcon, path: "/pagos" },
    { label: "Facturas", icon: ReceiptTextIcon, path: "/facturas" },
    { label: "Proveedores", icon: ReceiptTextIcon, path: "/proveedores" },
    { label: "Cashflow", icon: CircleDollarSign, path: "/cashflow" },
    { label: "Logout", icon: LogOutIcon, path: "/logout" },
  ];

  return (
    <div className="px-4 h-full overflow-auto mt-0 flex flex-col items-center justify-start">
      <div className="w-full flex flex-col sticky top-0 z-10 bg-cold-white rounded pb-4 items-center justify-center mt-10">
        <h1 className="inline-block font-extrabold text-gray-900 tracking-tight ">
          Bienvenido {sessionStorage.name}
        </h1>
        <p className="text-gray-900 italic">selecciona la opcion deseada</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {navItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-center p-4 hover:bg-gray-100 rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 bg-white"
            onClick={() => (window.location.href = item.path)}
          >
            <div className="flex flex-col items-center gap-2">
              <item.icon className="w-8 h-8 sm:w-16 sm:h-16 text-gray-600" />
              <span className="text-gray-900 text-sm">{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
