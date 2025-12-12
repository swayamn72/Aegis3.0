import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AdminProvider } from "./context/AdminContext";
import { queryClient } from "./query/queryClient";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <App />
      </AdminProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
