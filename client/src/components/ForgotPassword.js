import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import Button from "./common/Button";
import logo from "../logo.svg";
import config from "../config";
import { useUserForgotPasswordMutation } from "../apis/api.users";

export default function RecoverPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const forgotPasswordMutation = useMutation({
    mutationFn: useUserForgotPasswordMutation,
    onSuccess: (data) => {
      setSuccessMsg("Te enviamos un enlace para restablecer tu contraseña.");
      queryClient.invalidateQueries({ queryKey: queryUsersKey() });
      console.log("Forgot password success:", data);
    },
    onError: (error) => {
      setErrorMsg(error.message);
      console.error("Forgot password error:", error);
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    const requestResetPassword = await forgotPasswordMutation.mutateAsync({
      email: data.email,
    });

    console.log(requestResetPassword);

    setLoading(false);
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
                    Recuperar contraseña
                  </h1>
                  <p className="text-sm text-gray-500">
                    Ingresá tu email y te enviaremos instrucciones para
                    restablecer tu contraseña.
                  </p>
                </header>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="w-full flex flex-col space-y-4"
                >
                  <div>
                    <div className="text-xs-special mb-2 font-sans text-gray-900 block">
                      Email
                    </div>
                    <input
                      type="email"
                      {...register("email", { required: true })}
                      className="w-full rounded border border-slate-200 p-4 pl-4 text-slate-500"
                    />
                    {errors.email && (
                      <span className="px-2 text-red-500">* Obligatorio</span>
                    )}
                  </div>

                  <Button type="submit" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar instrucciones"}
                  </Button>

                  <a
                    href="/login"
                    className="text-gray-900 underline text-center"
                  >
                    Volver
                  </a>

                  {successMsg && (
                    <span className="p-2 text-green-600">{successMsg}</span>
                  )}
                  {errorMsg && (
                    <span className="p-2 text-red-500">{errorMsg}</span>
                  )}
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
