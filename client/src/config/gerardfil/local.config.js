const brand = process.env.BRAND || "GERARDFIL";
const baseUrl = process.env.REACT_APP_BASE_URL || "http://localhost:3000";

export const config = {
  brand,
  baseUrl,
  defaultUserImage:
    "https://static.vecteezy.com/system/resources/previews/005/544/718/non_2x/profile-icon-design-free-vector.jpg",
  imgbbApiKey: "f369e564a35464c187abaecc81d252ab",
  email: "info@gerardfilsrl.com.ar",
  phone: "+1 (123) 456-7890",
  address: "123 Main St, City, Country",
  socialMedia: {
    facebook: "https://facebook.com/gerardfil",
    twitter: "https://twitter.com/gerardfil",
    instagram: "https://instagram.com/gerardfil",
    linkedin: "https://linkedin.com/company/gerardfil",
  },
  theme: {
    logo: baseUrl + "/logo.png",
    colors: {
      primaryColor: "#d1d5db",
      secondaryColor: "#6b7280",
      tertiaryColor: "bg-gray-300",
      quaternaryColor: "bg-gray-300",
      textMenuColor: "#1c1917",
      textMenuHoverColor: "#ffffff",
      textMenuBrandColor: "#000000",
    },
  },
};
