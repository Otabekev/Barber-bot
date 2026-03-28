import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Do NOT call .ready() or .expand() here — App.jsx controls that
// after it confirms initData is present and auth succeeded.
// Calling .ready() too early can hide Telegram's loading spinner prematurely.

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
