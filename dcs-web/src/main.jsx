import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { CredentialsProvider } from "./lib/credentials.jsx";
import "./styles/dcs.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <CredentialsProvider>
        <App />
      </CredentialsProvider>
    </BrowserRouter>
  </React.StrictMode>
);