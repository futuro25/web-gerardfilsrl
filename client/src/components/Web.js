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
        <div className="flex flex-col items-center gap-2 mt-4">
          <span className="text-xs text-zinc-400">Sitio desarrollado por</span>
          <a 
            href="https://dosmil12.com/?utm_source=gerardfilsrl&utm_medium=web-home" 
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
      </footer>
    </main>
  );
}
