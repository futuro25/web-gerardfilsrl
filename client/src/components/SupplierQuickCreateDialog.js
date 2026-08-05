import { forwardRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import FormActions from "./common/FormActions";
import { useCreateSupplierMutation, useSuppliersQuery } from "../apis/api.suppliers";
import { querySuppliersKey } from "../apis/queryKeys";
import * as utils from "../utils/utils";

const TAX_REGIMES = [
  "RESPONSABLE INSCRIPTO",
  "MONOTRIBUTISTA",
  "EXENTO",
  "CONSUMIDOR FINAL",
];

const selectClass =
  "w-full h-12 px-2 border border-gray-100 rounded text-sm-special font-sans text-gray-900 bg-white focus:outline-none focus:border-slate-400";
const selectErrorClass =
  "w-full h-12 px-2 border border-danger-light rounded text-sm-special font-sans text-danger bg-white focus:outline-none";

/**
 * Campo select con la misma presentación que el Input común.
 * forwardRef es obligatorio: react-hook-form entrega el ref del campo por prop
 * y sin reenviarlo al <select> el campo no queda registrado.
 */
const SelectField = forwardRef(function SelectField(
  { label, error, children, ...props },
  ref
) {
  return (
    <div>
      <label className="text-xs font-sans text-gray-900 mb-2 block">
        {label}
      </label>
      <select
        ref={ref}
        className={error ? selectErrorClass : selectClass}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-sm pt-2 font-sans text-danger">{error}</p>}
    </div>
  );
});

export default function SupplierQuickCreateDialog({ open, onOpenChange, onCreated }) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Necesario para validar que la razón social no esté repetida, igual que en
  // la sección Proveedores.
  const { data: suppliers } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled: open,
  });

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

  const fantasyNameValidation = (value) => {
    const norm = String(value || "").trim().toLowerCase();
    if (!norm) return true;
    const exists = (Array.isArray(suppliers) ? suppliers : []).some(
      (s) => String(s.fantasy_name || "").trim().toLowerCase() === norm
    );
    return exists ? "Proveedor existente" : true;
  };

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      const body = {
        name: data.name || "",
        last_name: data.last_name || "",
        fantasy_name: data.fantasy_name || data.name,
        email: data.email || "",
        phone: data.phone || "",
        cuit: data.cuit || "",
        street: data.street || "",
        street_number: data.street_number || "",
        city: data.city || "",
        zip_code: data.zip_code || "",
        category: data.category || "",
        // En la sección Proveedores el servicio replica la categoría.
        service: data.category || "",
        tax_regime: data.tax_regime || "",
        clasificacion: data.clasificacion || "",
        alias: data.alias || "",
        cbu: data.cbu || "",
        horario: data.horario || "",
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
      window.alert(e.message || "No se pudo crear el proveedor");
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-6 gap-4">
        <DialogTitle className="text-lg font-semibold text-slate-800">
          Nuevo proveedor
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Input
                label="Razón social"
                {...register("fantasy_name", {
                  required: "Ingrese la razón social",
                  validate: fantasyNameValidation,
                })}
                intent={errors.fantasy_name ? "danger" : "default"}
                helperText={errors.fantasy_name?.message}
              />
            </div>

            <Input
              label="Nombre"
              {...register("name", { required: "Ingrese el nombre" })}
              intent={errors.name ? "danger" : "default"}
              helperText={errors.name?.message}
            />
            <Input
              label="Apellido"
              {...register("last_name", { required: "Ingrese el apellido" })}
              intent={errors.last_name ? "danger" : "default"}
              helperText={errors.last_name?.message}
            />

            <Input label="CUIT" placeholder="20-12345678-9" {...register("cuit")} />
            <SelectField
              label="Régimen"
              error={errors.tax_regime?.message}
              {...register("tax_regime", { required: "Seleccione el régimen" })}
            >
              <option value="">Seleccionar</option>
              {TAX_REGIMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>

            <div className="sm:col-span-2">
              <SelectField
                label="Categoría"
                error={errors.category?.message}
                {...register("category", { required: "Seleccione la categoría" })}
              >
                <option value="">Seleccionar</option>
                {utils.getSupplierCategories().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </div>

            <Input label="Email" type="email" {...register("email")} />
            <Input label="Teléfono" {...register("phone")} />

            <Input label="Calle" {...register("street")} />
            <Input label="Número" {...register("street_number")} />
            <Input label="Ciudad" {...register("city")} />
            <Input label="Código Postal" {...register("zip_code")} />

            <Input label="Clasificación" {...register("clasificacion")} />
            <Input label="Alias" {...register("alias")} />
            <Input label="CBU" {...register("cbu")} />
            <Input
              label="Horario"
              placeholder="Ej: Lunes a Viernes 9:00 - 18:00"
              {...register("horario")}
            />
          </div>

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
