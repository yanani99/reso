import { Routes, Route, Navigate } from "react-router-dom";
import Connect from "./pages/Connect";
import Profile from "./pages/Profile";
import Generate from "./pages/Generate";
import Result from "./pages/Result";

export default function App() {
  return (
    <div className="min-h-screen bg-bg">
      <Routes>
        <Route path="/" element={<Connect />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/generate" element={<Generate />} />
        <Route path="/result" element={<Result />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
