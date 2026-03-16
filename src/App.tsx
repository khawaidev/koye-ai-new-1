import { Navigate, Route, Routes } from "react-router-dom"
import "./App.css"
import { ToastProvider } from "./components/ui/toast"
import { WorkflowManager } from "./components/workflow/WorkflowManager"
import { AnimationsLibrary } from "./pages/AnimationsLibrary"
import { Builder } from "./pages/Builder"
import { Dashboard } from "./pages/Dashboard"
import { GameEngine } from "./pages/GameEngine"
import { LandingPage } from "./pages/LandingPage"
import { Login } from "./pages/Login"
import { Phaser2DGameEngine } from "./pages/Phaser2DGameEngine"
import { Pricing } from "./pages/Pricing"
import { ProjectEngineRender } from "./pages/ProjectEngineRender"
import { SignUp } from "./pages/SignUp"

function App() {
  console.log("App component rendering")
  return (
    <ToastProvider>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/builder/:projectId" element={<Builder />} />
        <Route path="/game-engine" element={<GameEngine />} />
        <Route path="/phaser-2d-engine" element={<Phaser2DGameEngine />} />
        <Route path="/project-engine-render" element={<ProjectEngineRender />} />
        <Route path="/animations" element={<AnimationsLibrary />} />
        <Route path="/app" element={<WorkflowManager />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}

export default App
