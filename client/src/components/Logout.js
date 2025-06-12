import React, {useState} from "react";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  sessionStorage.clear()
  // window.location.assign('login')
  window.location.assign('/')
  // const navigate = useNavigate()
  // navigate('./login');

  return (<div></div>);
}
