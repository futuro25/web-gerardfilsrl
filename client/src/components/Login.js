import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import logo from "../logo.svg";
import Button from "./common/Button";
import { EyeIcon } from "./icons";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useLoginUserMutation, useUpdateUserMutation } from "../apis/api.users";
import config from "../config";

export default function Login() {
  const [errorLogin, setErrorLogin] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: useLoginUserMutation,
    onSuccess: (data) => {
      console.log("Usuario logueado:", data);
    },
    onError: (error) => {
      console.error("Error logueando usuario:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateUserMutation,
    onSuccess: (data) => {
      console.log("Usuario creado:", data);
    },
    onError: (error) => {
      console.error("Error creando usuario:", error);
    },
  });

  const setCredentials = (userLogin) => {
    sessionStorage.username = userLogin.username;
    sessionStorage.email = userLogin.email;
    sessionStorage.name = userLogin.name;
    sessionStorage.last_name = userLogin.last_name;
    sessionStorage.type = userLogin.type;
    sessionStorage.user_id = userLogin.id;
    navigate("/home");
  };

  const onSubmit = async (formData) => {
    const body = {
      username: formData.username,
      password: formData.password,
    };

    try {
      const userLogin = await loginMutation.mutateAsync(body);
      const user_id = userLogin.id;
      updateMutation.mutate(user_id, {
        last_login: new Date(),
      });
      setCredentials(userLogin);
    } catch (error) {
      console.log(error);
      setErrorLogin("Usuario o Clave erroneos");
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-cold-white">
      <div className="flex h-[calc(100vh-4rem)]">
        <main className="flex-1">
          <div className="h-full overflow-auto mt-4">
            <div className="flex flex-col items-center justify-center h-full mb-4">
              <div className="flex items-center justify-center mb-4">
                <img
                  src={config.theme.logo}
                  alt="logo"
                  className="w-12 h-12 object-cover"
                />
                <h1 className="inline-block text-2xl sm:text-3xl text-gray-400 pl-2 tracking-tight ">
                  {config.brand}
                </h1>
              </div>
              <div className="flex flex-col items-start justify-center p-4 rounded-lg w-[100%] max-w-[500px] shadow-lg border border-gray-100 bg-white">
                <header className="mb-4">
                  <h1 className="mb-2 text-2xl font-bold text-gray-900">
                    Sign in
                  </h1>
                </header>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="w-full flex flex-col"
                >
                  <div className="text-xs-special mb-2 font-sans text-gray-900 block">
                    Email
                  </div>
                  <input
                    type="text"
                    {...register("username", { required: true })}
                    className="mt-2 rounded border border-slate-200  p-4 pl-8 text-slate-500 "
                  />
                  {errors.username && (
                    <span className="px-2 text-red-500">* Obligatorio</span>
                  )}
                  <div className="flex flex-col mt-6">
                    <div className="text-xs-special mb-2 font-sans text-gray-900 block">
                      Password
                    </div>
                    <div className="flex">
                      <input
                        type={isPasswordVisible ? "text" : "password"}
                        {...register("password", { required: true })}
                        className="mt-2 w-full rounded border border-slate-200  p-4 pl-8 text-slate-500 "
                      />
                      <div
                        className="relative mt-8 -ml-5 right-2.5	text-gray-900 cursor-pointer"
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      >
                        <EyeIcon className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  {errors.password && (
                    <span className="px-2 text-red-500">* Obligatorio</span>
                  )}
                  <Button className="mt-6">Sign in</Button>
                  {errorLogin && (
                    <span className="p-2 text-red-500">{errorLogin}</span>
                  )}
                </form>
              </div>
              <div className="flex flex-col items-center justify-center mt-4">
                <p className="mt-4 text-sm text-gray-500">
                  No tenés cuenta?{" "}
                  <a href="/register" className="text-gray-900 underline">
                    Registrate
                  </a>
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Olvidaste tu contraseña?{" "}
                  <a
                    href="/forgot-password"
                    className="text-gray-900 underline"
                  >
                    Recuperar contraseña
                  </a>
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
