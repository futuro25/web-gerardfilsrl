import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import FormActions from "./common/FormActions";
import { useCreateSupplierMutation } from "../apis/api.suppliers";
import { querySuppliersKey } from "../apis/queryKeys";

export default function SupplierQuickCreateDialog({ open, onOpenChange, onCreated }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const createMutation = useMutation({
    mutationFn: useCreateSupplierMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: querySuppliersKey() });
    },
  });

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      const body = {
        name: data.name,
        last_name: data.last_name || "",
        fantasy_name: data.fantasy_name || data.name,
        email: data.email || "",
        phone: data.phone || "",
        category: data.category || "OTROS",
        service: data.category || "OTROS",
        cuit: data.cuit || "",
      };
      const created = await createMutation.mutateAsync(body);
      const row = Array.isArray(created) ? created[0] : created;
      if (row?.id) {
        onCreated?.({
          id: row.id,
          name: row.fantasy_name || row.name,
          label: row.fantasy_name || row.name,
        });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      window.alert("No se pudo crear el proveedor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md p-6 gap-4">
        <DialogTitle className="text-lg font-semibold text-slate-800">
          Nuevo proveedor
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <Input
            label="Razón social"
            {...register("fantasy_name", { required: "Ingrese la razón social" })}
            intent={errors.fantasy_name ? "danger" : "default"}
            helperText={errors.fantasy_name?.message}
          />
          <Input label="Nombre contacto" {...register("name")} />
          <Input label="CUIT" {...register("cuit")} />
          <Input label="Email" type="email" {...register("email")} />
          <Input label="Teléfono" {...register("phone")} />
          <FormActions
            className="pt-2"
            equalWidth
            isLoading={isLoading}
            onCancel={handleClose}
            submitLabel="Crear y seleccionar"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
