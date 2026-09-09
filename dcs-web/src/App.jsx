import { Routes, Route } from "react-router-dom";
import SiteLayout from "./components/SiteLayout.jsx";
import Home from "./pages/Home.jsx";
import Simulator from "./pages/Simulator.jsx";
import Verify from "./pages/Verify.jsx";
import Ops from "./pages/Ops.jsx";
import Docs from "./pages/Docs.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/ops" element={<Ops />} />
        <Route path="/docs" element={<Docs />} />
      </Route>
    </Routes>
  );
}