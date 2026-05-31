const BASE_URL = "/api/uploads";

export const uploadInvoiceImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/invoice-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al subir la imagen");
  }
  return res.json();
};

export const fetchInvoiceImageUrl = async (key) => {
  const res = await fetch(
    `${BASE_URL}/invoice-image-url?key=${encodeURIComponent(key)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al obtener la imagen");
  }
  return res.json();
};
