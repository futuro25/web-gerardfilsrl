import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "../config";

export const featureFlags = [];

export const getFeatureFlagValue = (feature) => {
  return featureFlags.filter((a) => a.feature === feature)[0].isEnabled;
};

export const tw = String.raw;

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const uploadResource = async (data) => {
  const formData = new FormData();
  formData.append("file", data.file[0]);

  const res = await fetch(config.resourcesLink, {
    method: "POST",
    body: formData,
  }).then((res) => res.json());

  return res;
};

export const getInviteLink = (user_id) => {
  return config.inviteLink + user_id;
};

export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Lunes

  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);

  return d;
};

export const getWeekDays = (start) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [...Array(7)].map((_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });

  // Si la semana es la actual, filtramos los días anteriores a hoy
  if (start <= today && today <= addDays(start, 6)) {
    return days.filter((day) => day >= today);
  }

  return days;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export function formatAmount(numero) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

export function formatInvoiceNumber(numero) {
  const letra = numero.charAt(0);
  const numeros = numero.slice(1);
  const parte1 = numeros.slice(0, 4);
  const parte2 = numeros.slice(4);
  return `${letra} ${parte1}-${parte2}`.toUpperCase();
}
