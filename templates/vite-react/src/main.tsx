import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./components/ui";
import { blueprint } from "./generated/blueprint";
import { AppRoutes } from "./routes";
import "./index.css";

document.documentElement.dataset.accent = blueprint.theme.accent;
document.title = blueprint.name;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
