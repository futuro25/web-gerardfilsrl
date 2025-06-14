import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import Button from "./common/Button";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import Spinner from "./common/Spinner";
import { useForm } from "react-hook-form";
import { useUpdateUserMutation, useUserByIdQuery } from "../apis/api.users";
import { queryUserKey } from "../apis/queryKeys";

export default function Invite({ inviteId }) {
  const [errorInvite, setErrorInvite] = useState("");
  const [selectedUser, setSelectedUser] = useState();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["users", inviteId],
    queryFn: () => useUserByIdQuery(inviteId),
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateUserMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryUserKey(inviteId) });
      console.log("Usuario creado:", data);
    },
    onError: (error) => {
      console.error("Error creando usuario:", error);
    },
  });

  const onSubmit = async (formData) => {
    debugger;
    if (formData.username === data.username && formData.password) {
      // formData.password = md5(formData.password);
      await updateMutation.mutateAsync({ id: data.id, ...formData });
      navigate("/login");
    } else {
      setErrorInvite("Ingrese una clave");
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen text-white bg-gray-900">
      <div className="flex h-[calc(100vh-4rem)]">
        <main className="flex-1">
          <div className="h-full overflow-auto mt-4">
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center justify-center p-4 rounded w-[400px] ">
                <h1 className="rounded p-4 text-white inline-block text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight ">
                  Invitacion
                </h1>
                {isLoading && (
                  <div>
                    <Spinner />
                  </div>
                )}
                {error && <div>{error}</div>}
                {data && (
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full flex flex-col"
                  >
                    <input
                      type="text"
                      defaultValue={data.username}
                      readOnly
                      {...register("username", { required: true })}
                      className="mt-2 rounded border border-slate-200  p-4 pl-8 text-slate-500 "
                    />
                    {errors.username && (
                      <span className="px-2 text-red-500">* Obligatorio</span>
                    )}
                    <input
                      type="password"
                      {...register("password", { required: true })}
                      className="mt-2 rounded border border-slate-200  p-4 pl-8 text-slate-500 "
                    />
                    {errors.password && (
                      <span className="px-2 text-red-500">* Obligatorio</span>
                    )}
                    <Button className="mt-2">Register</Button>
                    {errorInvite && (
                      <span className="p-2 text-red-500">{errorInvite}</span>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
