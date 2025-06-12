const brand = process.env.BRAND || "DEFAULT";
const baseUrl = process.env.REACT_APP_BASE_URL || "http://localhost:3000";

export const config = {
  brand,
  email: "info@Gerardfil.com",
  phone: "+1 (123) 456-7890",
  address: "123 Main St, City, Country",
  socialMedia: {
    facebook: "https://facebook.com/Gerardfil",
    twitter: "https://twitter.com/Gerardfil",
    instagram: "https://instagram.com/Gerardfil",
    linkedin: "https://linkedin.com/company/Gerardfil",
  },
  baseUrl,
  defaultUserImage:
    "https://static.vecteezy.com/system/resources/previews/005/544/718/non_2x/profile-icon-design-free-vector.jpg",
  imgbbApiKey: "f369e564a35464c187abaecc81d252ab",
  email: "info@Gerardfil.com",
  phone: "+1 (123) 456-7890",
  address: "123 Main St, City, Country",
  socialMedia: {
    facebook: "https://facebook.com/Gerardfil",
    twitter: "https://twitter.com/Gerardfil",
    instagram: "https://instagram.com/Gerardfil",
    linkedin: "https://linkedin.com/company/Gerardfil",
  },
  theme: {
    logo: baseUrl + "/logo.png",
    colors: {
      primaryColor: "blue",
      secondaryColor: "#7A8499",
      tertiaryColor: "#F5A623",
      quaternaryColor: "#9013FE",
      textMenuBrandColor: "#FFFFFF",
      textMenuColor: "#FFFFFF",
      textMenuHoverColor: "#FFFFFF",
    },
  },
};
