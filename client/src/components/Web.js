import React, { useState, useEffect } from "react";
import Button from "./common/Button";
import config from "../config";

export default function Web() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = window.screen.width < 640;
  return (
    <main className="min-h-screen bg-gray-lighter text-gray-600">
      <div className="flex flex-col items-center justify-between p-4">
        <h1 class="font-semibold text-gray-900 text-2xl mt-2">Gerardfil SRL</h1>
        <p class="text-gray-500 mt-2 text-xs">Sitio en construccion</p>
      </div>
      <footer
        className={`bg-gray-800 text-xs text-white py-4 mt-8 bottom-0 absolute w-full text-center`}
      >
        <p>
          &copy; {new Date().getFullYear()} {config.brand}. Todos los derechos
          reservados.
          <a href="/login" className="text-white ml-4 py-2">
            Acceso
          </a>
        </p>
      </footer>
    </main>
  );
}
