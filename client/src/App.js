"use client";

import {
  NavLink,
  Route,
  Routes,
  Outlet,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import ForgotPassword from "./components/ForgotPassword";
import { isMobile } from "react-device-detect";
import Payments from "./components/Payments";
import Users from "./components/Users";
import Home from "./components/Home";
import Cashflow from "./components/Cashflow";
import Deliveries from "./components/Deliveries";
import BooksNavigation from "./components/BooksNavigation";
import DeliveryNotes from "./components/DeliveryNotes";
import { DeliveryNoteView } from "./components/DeliveryNoteView";
import Clients from "./components/Clients";
import CashflowSelector from "./components/CashflowSelector";
import CashflowIn from "./components/CashflowIn";
import CashflowOut from "./components/CashflowOut";
import Invite from "./components/Invite";
import Invoices from "./components/Invoices";
import Paychecks from "./components/Paychecks";
import Suppliers from "./components/Suppliers";
import Products from "./components/Products";
import Orders from "./components/Orders";
import Web from "./components/Web";
import Logout from "./components/Logout";
import _, { capitalize } from "lodash";
import { useState } from "react";
import { cn } from "./utils/utils";
import "./App.css";
import config from "./config";

function getMenu() {
  let menu = ["home", "usuarios", "pagos", "facturas", "proveedores", "logout"];

  menu = _.uniq(menu);

  return menu;
}

export default function App() {
  const [searchParams] = useSearchParams();
  const user = sessionStorage.email || null;
  const userType = sessionStorage.type || null;
  const inviteId = searchParams.get("inviteId") || null;
  const location = useLocation();
  const [open, setOpen] = useState(false); // Moved useState hook to top level

  if (user === undefined || user === null) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            // <Navigate to="/login" state={{ referrer: location.pathname }} />
            <Web />
          }
        />
        <Route path="login" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite" element={<Invite inviteId={inviteId} />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/">
        <Route element={<RootLayout />}>
          <Route index element={<Home />} />
          {userType === "ADMIN" && (
            <>
              <Route path="usuarios" element={<Users />} />
            </>
          )}
          <Route path="pagos" element={<Payments />} />
          <Route path="facturas" element={<Invoices />} />
          <Route path="proveedores" element={<Suppliers />} />
          <Route path="cashflow" element={<Cashflow />} />
          <Route path="cashflow-selector" element={<CashflowSelector />} />
          <Route path="cashflowin" element={<CashflowIn />} />
          <Route path="cashflowout" element={<CashflowOut />} />
          <Route path="cheques" element={<Paychecks />} />
          <Route path="home" element={<Home />} />
          <Route path="entregas" element={<Deliveries />} />
          <Route path="remitos" element={<DeliveryNotes />} />
          <Route path="remito/:id" element={<DeliveryNoteView />} />
          <Route path="libros-selector" element={<BooksNavigation />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="productos" element={<Products />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="logout" element={<Logout />} />
        </Route>
        <Route
          path="*"
          element={
            <div className="bg-black">
              <div className="w-9/12 m-auto py-16 min-h-screen flex items-center justify-center">
                <div className="bg-white shadow overflow-hidden sm:rounded-lg pb-8">
                  <div className="border-t border-gray-200 text-center pt-8">
                    <h1 className="text-9xl font-bold text-gray-400">404</h1>
                    <h1 className="text-6xl font-medium py-8">
                      Pagina no encontrada
                    </h1>
                    <p className="text-2xl pb-8 px-12 font-medium">
                      Ups! La pagina que esta buscando no existe. Vuelva al
                      inicio haciendo click en el boton.
                    </p>
                    <button
                      className="bg-black hover:from-pink-500 hover:to-orange-500 text-white font-semibold px-6 py-3 rounded-md mr-6"
                      onClick={() => window.location.assign("/")}
                    >
                      IR AL INICIO
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

function RootLayout() {
  const location = useLocation();

  console.log("location", location.pathname);

  return (
    <>
      {location.pathname.includes("/remito/") ? (
        <Outlet />
      ) : (
        <Layout>
          <Outlet />
        </Layout>
      )}
    </>
  );
}

function getTheme() {
  return {
    primaryColor: `bg-[${config.theme.colors.primaryColor}]`,
    secondaryColor: `bg-[${config.theme.colors.secondaryColor}]`,
    textMenuBrandColor: `text-[${config.theme.colors.textMenuBrandColor}]`,
    textMenuColor: `text-[${config.theme.colors.textMenuColor}]`,
    textMenuHoverColor: `text-[${config.theme.colors.textMenuHoverColor}]`,
  };
}

function Layout({ children }) {
  const theme = getTheme();
  const [open, setOpen] = useState(false); // Declare setOpen here

  return (
    <div className="flex-col w-full h-screen text-gray-700">
      <nav
        className={cn(
          `left-0 flex justify-between items-center pr-6 w-full h-16 ${theme.textMenuColor} print:hidden ${theme.primaryColor}`
        )}
      >
        <div
          className="flex gap-2 items-center cursor-pointer"
          onClick={() => window.location.assign("/")}
        >
          <div className="flex items-center">
            <img
              src={config.theme.logo || "/placeholder.svg"}
              alt="logo"
              className="ml-4 w-12 h-12 object-cover"
            />
            <h1
              className={`inline-block text-2xl sm:text-3xl ${theme.textMenuBrandColor} pl-2 tracking-tight`}
            >
              {capitalize(config.brand)}
            </h1>
          </div>
        </div>
        {isMobile ? <MobileMenu open={open} setOpen={setOpen} /> : <Profile />}
      </nav>

      <div
        className="fixed top-16 flex overflow-auto w-full"
        style={{
          height: isMobile ? "calc(100vh - 4rem)" : "calc(100vh - 4rem)",
        }}
      >
        {/* Main content */}
        {isMobile ? (
          <main className="flex-1 bg-white w-[calc(10vh)]">{children}</main>
        ) : (
          <main className="flex-1 bg-cold-white w-[calc(100%-140px)]">
            {children}
          </main>
        )}
      </div>
    </div>
  );
}

function Profile() {
  return (
    <div className="flex items-center justify-end gap-2 h-full mt-2">
      <p>{sessionStorage.username}</p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    </div>
  );
}

function MobileMenu({ open, setOpen }) {
  const theme = getTheme();
  return (
    <div>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </div>
      <div
        id="menu"
        className={cn(
          `absolute z-10 top-16 right-0 h-[calc(100%-4rem)] ${theme.primaryColor} transition-all duration-200 z-20 w-[160px]`,
          open && "w-[160px]",
          !open && "hidden"
        )}
      >
        <div className="flex flex-col justify-start items-center">
          <div
            className={cn(
              `h-14 w-full flex flex-col items-start text-xs justify-center pl-4 hover:${theme.secondaryColor}`
            )}
          >
            <span>Hola {sessionStorage.name}</span>
            <span>{sessionStorage.type}</span>
            <div className="w-full h-[1px] bg-gray-200 mt-2 -ml-2" />
          </div>
          {getMenu().map((el, i) => {
            return (
              <NavLink
                key={i}
                className={`h-10 w-full flex items-center ${theme.textMenuColor} pl-4 hover:${theme.secondaryColor} cursor-pointer`}
                to={el}
                onClick={() => setOpen(!open)}
              >
                {capitalize(el.replaceAll("-", " "))}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
