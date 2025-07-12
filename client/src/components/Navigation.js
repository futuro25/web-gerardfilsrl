import { Package, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";

export default function Navigation() {
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-auto flex flex-col items-center justify-start">
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Inicio</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div
          className="flex items-center justify-center p-4 hover:bg-gray-100 rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 bg-white"
          onClick={() => (window.location.href = "/remitos")}
        >
          <div className="flex flex-col items-center gap-2">
            <Package className="w-8 h-8 sm:w-16 sm:h-16 text-gray-600" />
            <span className="text-gray-900 text-sm">Crear Remito</span>
          </div>
        </div>

        <div
          className="flex items-center justify-center p-4 hover:bg-gray-100 rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 bg-white"
          onClick={() => (window.location.href = "/entregas")}
        >
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 sm:w-16 sm:h-16 text-gray-600" />
            <span className="text-gray-900 text-sm">Crear Factura</span>
          </div>
        </div>
      </div>
    </div>
  );
}
