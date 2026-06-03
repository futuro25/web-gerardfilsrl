import Button from "./Button";
import { cn } from "../../utils/utils";

/**
 * Botones de formulario: Cancelar a la izquierda, acción principal a la derecha.
 */
export default function FormActions({
  onCancel,
  cancelLabel = "Cancelar",
  submitLabel = "Guardar",
  loadingLabel = "Guardando...",
  isLoading = false,
  disabled = false,
  submitType = "submit",
  onSubmit,
  className,
  equalWidth = false,
  cancelVariant = "outlined",
  submitVariant = "default",
  cancelClassName,
  submitClassName,
  submitContent,
}) {
  const widthClass = equalWidth ? "flex-1" : undefined;

  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        type="button"
        variant={cancelVariant}
        className={cn(widthClass, cancelClassName)}
        onClick={onCancel}
        disabled={isLoading}
      >
        {cancelLabel}
      </Button>
      <Button
        type={submitType}
        variant={submitVariant}
        className={cn(widthClass, submitClassName)}
        disabled={disabled || isLoading}
        onClick={onSubmit}
      >
        {submitContent ?? (isLoading ? loadingLabel : submitLabel)}
      </Button>
    </div>
  );
}
