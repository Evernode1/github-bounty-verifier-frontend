import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <main className="wrap"><h1>Something went wrong</h1><p className="err">{String(this.state.error.message || this.state.error)}</p><button onClick={() => window.location.reload()}>Reload</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(<Boundary><App /></Boundary>);
