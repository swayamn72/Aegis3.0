import axios from "axios";

const API = axios.create({
  baseURL: "/api/admin",
});

// login admin
export const adminLoginAPI = async (credentials) => {
  const { data } = await API.post("/login", credentials);
  return data;
};
