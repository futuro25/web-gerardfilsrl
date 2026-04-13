import {
  UsersIcon,
  TruckIcon,
  CircleDollarSign,
  BookOpenCheck,
  UserPlus,
  LogOutIcon,
  Layers,
  Package,
  FileText,
  ShirtIcon,
  Banknote,
  FileDown,
  Landmark,
} from "lucide-react";
import { useState, useEffect } from "react";
import { MoonLoader } from "react-spinners";

export default function Home() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  let navItems = [
    { label: "Stock", icon: ShirtIcon, path: "/stock", order: 1 },
    { label: "Pedidos", icon: BookOpenCheck, path: "/pedidos", order: 2 },
    { label: "Egreso de Mercaderia", icon: Package, path: "/remitos", order: 3 },
    { label: "Proveedores", icon: TruckIcon, path: "/proveedores", order: 4 },
    { label: "Clientes", icon: UsersIcon, path: "/clientes", order: 5 },
    { label: "Facturas", icon: FileText, path: "/entregas", order: 6 },
    { label: "Cashflow", icon: CircleDollarSign, path: "/cashflow", order: 7 },
    { label: "Cheques", icon: Banknote, path: "/cheques", order: 8 },
    { label: "Retenciones", icon: CircleDollarSign, path: "/certificados-retencion", order: 9 },
    // { label: "Libros", icon: BookOpenCheck, path: "/libros-selector", order: 10 },
    { label: "Export Fiscal", icon: FileDown, path: "/exportacion-fiscal", order: 11 },
    { label: "Logout", icon: LogOutIcon, path: "/logout", order: 99 },
  ];

  if (sessionStorage.type === "ADMIN") {
    navItems.pop();
    navItems.push({ label: "Usuarios", icon: UserPlus, path: "/usuarios", order: 12 });
    navItems.push({ label: "Control", icon: Landmark, path: "/control", order: 7.5 });
    navItems.push({ label: "Logout", icon: LogOutIcon, path: "/logout", order: 99 });
  }

  if (sessionStorage.username === "caro") {
    navItems.push({ label: "Control", icon: Landmark, path: "/control", order: 7.5 });
  }

  if (sessionStorage.username === "lcozza") {
    navItems = navItems.filter((item) => item.label !== "Cashflow");
    navItems = navItems.filter((item) => item.label !== "Cheques");
    navItems = navItems.filter((item) => item.label !== "Libros");
  }

  navItems.sort((a, b) => a.order - b.order);

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

      {/* dosmil12 signature */}
      <div className="flex flex-col items-center gap-2 mt-10 mb-6">
        <span className="text-xs text-zinc-500">Sitio desarrollado por</span>
        <a 
          href="https://dosmil12.com/?utm_source=gerardfilsrl&utm_medium=home" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <img 
            src="https://pub-8df60d5ed0274fa8a9989b2040218ce5.r2.dev/logodosmil12.png" 
            alt="dosmil12" 
            width={100} 
            height={30} 
            className="object-contain"
          />
        </a>
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
            <MoonLoader size={20} />
          </div>
        ) : (
          <div className="flex items-center justify-end w-6 h-6">
            <item.icon className="w-6 h-6 sm:w-10 sm:h-10 text-gray-600" />
          </div>
        )}
        <span className="text-gray-900 text-xs text-center h-[36px] flex items-center justify-end">{item.label}</span>
      </div>
    </div>
  );
}
