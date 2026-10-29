import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initAndroidShell } from "./lib/android-shell";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

initAndroidShell();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
