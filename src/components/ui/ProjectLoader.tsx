import "./ProjectLoader.css"

export function ProjectLoader() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
      <div className="loader-wrapper">
        <span className="loader-letter">L</span>
        <span className="loader-letter">o</span>
        <span className="loader-letter">a</span>
        <span className="loader-letter">d</span>
        <span className="loader-letter">i</span>
        <span className="loader-letter">n</span>
        <span className="loader-letter">g</span>
        <div className="loader"></div>
      </div>
    </div>
  )
}
