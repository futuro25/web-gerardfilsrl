import {
  UsersIcon,
  TruckIcon,
  CircleDollarSign,
  BookOpenCheck,
  UserPlus,
  LogOutIcon,
  Package,
  FileText,
  ShirtIcon,
  Banknote,
} from "lucide-react";
import { useState, useEffect } from "react";
import { MoonLoader } from "react-spinners";

export default function Home() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  let navItems = [
    { label: "Pedidos", icon: BookOpenCheck, path: "/pedidos" },
    { label: "Remitos", icon: Package, path: "/remitos" },
    { label: "Facturas", icon: FileText, path: "/entregas" },
    { label: "Productos", icon: ShirtIcon, path: "/productos" },
    { label: "Proveedores", icon: TruckIcon, path: "/proveedores" },
    { label: "Clientes", icon: UsersIcon, path: "/clientes" },
    { label: "Cashflow", icon: CircleDollarSign, path: "/cashflow" },
    { label: "Cheques", icon: Banknote, path: "/cheques" },
    { label: "Libros", icon: BookOpenCheck, path: "/libros-selector" },
    { label: "Logout", icon: LogOutIcon, path: "/logout" },
  ];

  if (sessionStorage.type === "ADMIN") {
    navItems.pop();
    navItems.push({ label: "Usuarios", icon: UserPlus, path: "/usuarios" });
    navItems.push({ label: "Logout", icon: LogOutIcon, path: "/logout" });
  }

  if (sessionStorage.username === "lcozza") {
    navItems = navItems.filter((item) => item.label !== "Cashflow");
    navItems = navItems.filter((item) => item.label !== "Cheques");
    navItems = navItems.filter((item) => item.label !== "Libros");
  }

  return (
    <div className="px-4 h-full overflow-auto mt-0 flex flex-col items-center justify-start">
      <div className="w-full flex flex-col sticky top-0 z-10 rounded pb-4 items-center justify-center mt-10">
        <h1 className="inline-block font-extrabold text-gray-900 tracking-tight ">
          Bienvenido {sessionStorage.name}
        </h1>
        <p className="text-gray-900 italic">selecciona la opcion deseada</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {navItems.map((item, index) => (
          <HomeButton key={index} item={item} />
        ))}
      </div>
    </div>
  );
}

function HomeButton({ item }) {
  const [isLoading, setIsLoading] = useState(false);

  const onClick = () => {
    setIsLoading(true);
    setTimeout(() => {
      window.location.href = item.path;
    }, 1000);
  };

  return (
    <div
      className="flex items-center justify-center p-3 hover:bg-gray-100 rounded-lg cursor-pointer border h-24 shadow-lg transition-colors duration-200 w-28 bg-white"
      onClick={() => onClick()}
    >
      <div className="flex flex-col items-center gap-2">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <MoonLoader size={40} />
          </div>
        ) : (
          <item.icon className="w-6 h-6 sm:w-10 sm:h-10 text-gray-600" />
        )}
        <span className="text-gray-900 text-xs">{item.label}</span>
      </div>
    </div>
  );
}
