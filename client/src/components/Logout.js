import React from "react";
import { endPresenceSession } from "../apis/api.presence";

export default function Logout() {
  // Cerramos la sesion de presencia antes de perder el token del sessionStorage.
  endPresenceSession(sessionStorage.presence_token);
  sessionStorage.clear();
  window.location.assign("/");

  return <div></div>;
}
