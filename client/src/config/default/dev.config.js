const brand = process.env.BRAND || "Gerardfil";
const baseUrl =
  process.env.REACT_APP_BASE_URL ||
  "https://Gerardfil-adc75de38188.herokuapp.com";

export const config = {
  brand,
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
      primaryColor: "#4A90E2",
      secondaryColor: "#50E3C2",
      tertiaryColor: "#F5A623",
      quaternaryColor: "#9013FE",
      textMenuColor: "#FFFFFF",
      textMenuHoverColor: "#FFFFFF",
    },
  },
};
