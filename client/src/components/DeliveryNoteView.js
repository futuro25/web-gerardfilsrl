import { useState, useEffect } from "react";
import React from "react";
import { Input } from "./common/Input";
import Button from "./common/Button";
import { Card, CardContent } from "./common/Card";
import { PrinterIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { useDeliveryNoteByIdQuery } from "../apis/api.deliverynotes";
import { queryDeliveryNotesByIdKey } from "../apis/queryKeys";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

const PRODUCTS_PER_PAGE = 10;

export function DeliveryNoteView() {
  const { id } = useParams();

  const [deliveryNote, setDeliveryNote] = useState({
    id: "REM-2024-001",
    client_id: "",
    created_at: new Date().toISOString().split("T")[0],
    updated_at: new Date().toISOString().split("T")[0],
    deleted_at: null,
    amount: 0,
    description: "",
    invoice_id: "",
  });

  const [products, setProducts] = useState([
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
    {
      id: "1",
      deliverynote_id: "REM-2024-001",
      product_id: "PROD-001",
      quantity: 1,
      price: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      product_name: "",
      product_description: "",
    },
  ]);

  const [clientData, setClientData] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryDeliveryNotesByIdKey(id),
    queryFn: () => useDeliveryNoteByIdQuery(),
  });

  console.log(data);

  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const pages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
    setTotalPages(pages > 0 ? pages : 1);
  }, [products]);

  const getProductsForPage = (pageNumber) => {
    const startIndex = (pageNumber - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    return products.slice(startIndex, endIndex);
  };

  const Header = ({ pageNumber, totalPages }) => (
    <div className="bg-[#d1d5db] text-gray-900 p-6 print:bg-[#d1d5db] print:text-gray-900">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">GERARDFIL</h1>
          <p className="text-blue-100">Soluciones Industriales</p>
          <div className="mt-4 text-sm">
            <p>Av. Industrial 1234, Buenos Aires</p>
            <p>Tel: (011) 4567-8900 | Email: info@gerardfil.com</p>
            <p>CUIT: 30-12345678-9</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold mb-2">REMITO</h2>
          <div className="bg-white text-blue-600 p-3 rounded">
            <p className="font-bold">N° {deliveryNote.id}</p>
            <p className="text-sm">Fecha: {deliveryNote.created_at}</p>
            <p className="text-sm font-medium">
              Página {pageNumber}/{totalPages}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const Footer = ({ pageNumber, totalPages, isLastPage }) => (
    <div className="mt-8 pt-6 border-t">
      {isLastPage && (
        <>
          {/* Observaciones solo en la última página */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-4">Observaciones</h3>
              <div className="min-h-[60px] border border-gray-300 p-2 rounded">
                {deliveryNote.description || "Sin observaciones"}
              </div>
            </CardContent>
          </Card>

          {/* Firmas solo en la última página */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-12">
                <p className="text-sm font-medium">Firma y Aclaración</p>
                <p className="text-xs text-gray-600">Entregado por</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-12">
                <p className="text-sm font-medium">Firma y Aclaración</p>
                <p className="text-xs text-gray-600">Recibido por</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-12">
                <p className="text-sm font-medium">Fecha de Entrega</p>
                <p className="text-xs text-gray-600">DD/MM/AAAA</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Total en todas las páginas */}
      <div className="flex justify-end mb-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-right">
            <p className="text-lg font-bold">
              Total: ${calculateTotal().toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Información de página */}
      <div className="text-center text-sm text-gray-600">
        <p>
          Página {pageNumber} de {totalPages}
        </p>
        {!isLastPage && (
          <p className="font-medium">Continúa en la siguiente página...</p>
        )}
      </div>
    </div>
  );

  const calculateTotal = () => {
    return products.reduce(
      (total, product) => total + product.quantity * product.price,
      0
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {Array.from({ length: totalPages }, (_, pageIndex) => {
        const pageNumber = pageIndex + 1;
        const pageProducts = getProductsForPage(pageNumber);
        const isLastPage = pageNumber === totalPages;

        return (
          <div
            key={pageNumber}
            className="bg-white shadow-lg print:shadow-none mb-8 print:mb-0 print:break-after-page"
          >
            <Header pageNumber={pageNumber} totalPages={totalPages} />

            <div className="p-6">
              {/* Datos del cliente solo en la primera página */}
              {pageNumber === 1 && (
                <Card className="mb-6">
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-4">
                      Datos del Cliente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div htmlFor="client-name">Razón Social</div>
                        <Input
                          id="client-name"
                          value={clientData.name}
                          onChange={(e) =>
                            setClientData({
                              ...clientData,
                              name: e.target.value,
                            })
                          }
                          placeholder="Nombre del cliente"
                        />
                      </div>
                      <div>
                        <div htmlFor="client-phone">Teléfono</div>
                        <Input
                          id="client-phone"
                          value={clientData.phone}
                          onChange={(e) =>
                            setClientData({
                              ...clientData,
                              phone: e.target.value,
                            })
                          }
                          placeholder="Teléfono"
                        />
                      </div>
                      <div>
                        <div htmlFor="client-address">Dirección</div>
                        <Input
                          id="client-address"
                          value={clientData.address}
                          onChange={(e) =>
                            setClientData({
                              ...clientData,
                              address: e.target.value,
                            })
                          }
                          placeholder="Dirección completa"
                        />
                      </div>
                      <div>
                        <div htmlFor="client-email">Email</div>
                        <Input
                          id="client-email"
                          type="email"
                          value={clientData.email}
                          onChange={(e) =>
                            setClientData({
                              ...clientData,
                              email: e.target.value,
                            })
                          }
                          placeholder="Email"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabla de productos para esta página */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">
                      Productos{" "}
                      {pageNumber > 1 &&
                        `(Continuación - Página ${pageNumber})`}
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 p-2 text-left">
                            Código
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Producto
                          </th>
                          <th className="border border-gray-300 p-2 text-left">
                            Descripción
                          </th>
                          <th className="border border-gray-300 p-2 text-center">
                            Cantidad
                          </th>
                          {/* <th className="border border-gray-300 p-2 text-right">
                            Precio Unit.
                          </th>
                          <th className="border border-gray-300 p-2 text-right">
                            Subtotal
                          </th> */}
                        </tr>
                      </thead>
                      <tbody>
                        {pageProducts.map((product) => (
                          <tr key={product.id}>
                            <td className="border border-gray-300 p-2">
                              <div className="text-xs text-gray-400">
                                {product.product_id}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-2">
                              <div className="text-xs text-gray-400">
                                {product.product_id}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-2">
                              <div className="text-xs text-gray-400">
                                {product.description}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-2 text-center">
                              <div className="text-xs text-gray-400">
                                {product.quantity}
                              </div>
                            </td>
                            {/* <td className="border border-gray-300 p-2 text-right">
                            <div>{product.price}</div>
                            </td>
                            <td className="border border-gray-300 p-2 text-right font-medium">
                              ${(product.quantity * product.price).toFixed(2)}
                            </td> */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Footer
                pageNumber={pageNumber}
                totalPages={totalPages}
                isLastPage={isLastPage}
              />
            </div>
          </div>
        );
      })}

      <div className="bg-white shadow-lg p-6 mt-8 print:hidden">
        <Card className="mb-6">
          <CardContent className="p-4">
            <h3 className="font-bold text-lg mb-4">Observaciones</h3>
            <textarea
              value={deliveryNote.description}
              onChange={(e) =>
                setDeliveryNote({
                  ...deliveryNote,
                  description: e.target.value,
                })
              }
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <PrinterIcon className="w-4 h-4 mr-2" />
            Imprimir Remito ({totalPages} página{totalPages > 1 ? "s" : ""})
          </Button>
        </div>
      </div>
    </div>
  );
}
