import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon } from "lucide-react";
import Button from "./common/Button";
import logo from "../logo.svg";
import config from "../config";
import {
  useUsersByUsernameQuery,
  useUsersByEmailQuery,
  useRegisterUserMutation,
} from "../apis/api.users";
import {
  queryUsersUsernameValidationKey,
  queryUsersEmailValidationKey,
} from "../apis/queryKeys";

export default function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const checkUsernameExists = async (username) => {
    const res = await useUsersByUsernameQuery(username);
    return res.exists;
  };

  const checkEmailExists = async (email) => {
    const res = await useUsersByEmailQuery(email);
    return res.exists;
  };

  const onSubmit = async (data) => {
    debugger;
    setLoading(true);
    setErrorMsg("");

    // const {
    //   data: usernameExists,
    //   isLoading: isLoadingUsername,
    //   error: usernameError,
    // } = useQuery({
    //   queryKey: queryUsersUsernameValidationKey(data.username),
    //   queryFn: () => useUsersByUsernameQuery(data.username),
    //   keepPreviousData: true,
    // });

    // const {
    //   data: emailExists,
    //   isLoading: isLoadingEmail,
    //   error: emailError,
    // } = useQuery({
    //   queryKey: queryUsersEmailValidationKey(data.email),
    //   queryFn: () => useUsersByEmailQuery(data.email),
    //   keepPreviousData: true,
    // });

    // const registerMutation = useRegisterUserMutation({
    //   onSuccess: (data) => {
    //     console.log("Usuario registrado:", data);
    //   },
    //   onError: (error) => {
    //     setErrorMsg(error.message);
    //     console.error("Error registrando usuario:", error);
    //   },
    // });

    // if (usernameExists.exists) {
    //   setErrorMsg("El nombre de usuario ya está en uso");
    //   setLoading(false);
    //   return;
    // }

    // if (emailExists.exists) {
    //   setErrorMsg("El correo ya está registrado");
    //   setLoading(false);
    //   return;
    // }

    const usernameExists = await checkUsernameExists(data.username);

    if (usernameExists) {
      setErrorMsg("El nombre de usuario ya está en uso");
      setLoading(false);
      return;
    }

    const emailExists = await checkEmailExists(data.email);
    if (emailExists) {
      setErrorMsg("El correo ya está registrado");
      setLoading(false);
      return;
    }

    // Subir imagen (ejemplo con imgbb)
    let pictureUrl = "";
    if (data.picture[0]) {
      const formData = new FormData();
      formData.append("image", data.picture[0]);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${config.imgbbApiKey}`,
        {
          method: "POST",
          body: formData,
        }
      ).then((res) => res.json());

      pictureUrl = response.data.url;
    }

    // Enviar registro
    const payload = {
      ...data,
      type: "USER",
      created_at: new Date().toISOString(),
      picture: pictureUrl,
    };
    // use registerMutation
    await registerMutation.mutateAsync(payload);

    setLoading(false);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-cold-white">
      <div className="flex">
        <main className="flex-1">
          <div className="h-full mt-4">
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
                    Registrarse
                  </h1>
                </header>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="w-full flex flex-col space-y-4"
                >
                  <>
                    {[
                      { label: "Nombre", name: "name" },
                      { label: "Apellido", name: "last_name" },
                      { label: "Usuario", name: "username" },
                      { label: "Email", name: "email", type: "email" },
                    ].map(({ label, name, type = "text" }) => (
                      <div key={name}>
                        <div className="text-xs-special mb-2 font-sans text-gray-900 block">
                          {label}
                        </div>
                        <input
                          type={type}
                          {...register(name, { required: true })}
                          className="w-full rounded border border-slate-200 p-4 pl-4 text-slate-500"
                        />
                        {errors[name] && (
                          <span className="px-2 text-red-500">
                            * Obligatorio
                          </span>
                        )}
                      </div>
                    ))}

                    <div>
                      <div className="text-xs-special mb-2 font-sans text-gray-900 block">
                        Contraseña
                      </div>
                      <div className="flex">
                        <input
                          type={isPasswordVisible ? "text" : "password"}
                          {...register("password", { required: true })}
                          className="w-full rounded border border-slate-200 p-4 pl-4 text-slate-500"
                        />
                        <div
                          className="relative -ml-6 flex items-center pr-2 text-gray-900 cursor-pointer"
                          onClick={() =>
                            setIsPasswordVisible(!isPasswordVisible)
                          }
                        >
                          <EyeIcon className="w-4 h-4" />
                        </div>
                      </div>
                      {errors.password && (
                        <span className="px-2 text-red-500">* Obligatorio</span>
                      )}
                    </div>

                    <div className="flex justify-between w-full mt-4">
                      <Button
                        type="button"
                        onClick={() => console.log("Go back")}
                        variant="outline"
                      >
                        Atrás
                      </Button>
                      <Button type="submit" disabled={false}>
                        {loading ? "Registrando..." : "Registrarse"}
                      </Button>
                    </div>
                  </>

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
