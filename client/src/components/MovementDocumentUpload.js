import { forwardRef, useImperativeHandle, useState } from "react";
import { UploadIcon } from "lucide-react";
import * as utils from "../utils/utils";

const MovementDocumentUpload = forwardRef(function MovementDocumentUpload(
  {
    savedImageKey = null,
    label = "Comprobante (opcional)",
    hint = "Arrastrá el comprobante acá o hacé click para subir",
  },
  ref
) {
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    getImageFile: () => imageFile,
    reset: () => setImageFile(null),
  }));

  return (
    <div>
      <label className="text-xs font-sans text-gray-900 mb-2 block">{label}</label>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer?.files?.[0];
          if (f) setImageFile(f);
        }}
        className={utils.cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-300 hover:bg-blue-50/40"
        )}
      >
        <UploadIcon className="h-7 w-7" />
        <span className="text-sm font-medium">{hint}</span>
        <span className="text-xs">Imagen o PDF</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </label>
      {imageFile && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span className="truncate">{imageFile.name}</span>
          <button
            type="button"
            onClick={() => setImageFile(null)}
            className="text-red-500 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}
      {savedImageKey && !imageFile && (
        <p className="text-xs text-slate-500 mt-2">
          Ya hay un comprobante cargado para este movimiento.
        </p>
      )}
    </div>
  );
});

export default MovementDocumentUpload;
