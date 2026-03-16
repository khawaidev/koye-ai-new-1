import React from "react"

export function DebugInfo() {
  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      right: 0, 
      background: "red", 
      color: "white", 
      padding: "10px",
      zIndex: 9999,
      fontSize: "12px"
    }}>
      React is working!
    </div>
  )
}

