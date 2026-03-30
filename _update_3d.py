import os

file_path = os.path.join(os.path.dirname(__file__), 'src', 'components', 'model-generation', 'Model3DGeneration.tsx')

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Find the line with "const selectedModel ="
cut_line = None
for i, line in enumerate(lines):
    if 'const selectedModel = selectedModelIndex !== null' in line:
        cut_line = i
        break

if cut_line is None:
    print("ERROR: Could not find selectedModel line")
    exit(1)

# Keep everything up to and including that line + blank line after
header = '\n'.join(lines[:cut_line + 2])

new_return = r'''
  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* Left Sidebar - Recent Models */}
      <div className={cn(
        "shrink-0 border-r border-border bg-background flex flex-col h-full transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-72" : "w-0 overflow-hidden"
      )}>
        <div className={cn(
          "border-b border-border p-4 flex items-center justify-between shrink-0",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <h2 className="text-sm font-semibold text-foreground">Recent Models</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className={cn(
          "flex-1 overflow-y-auto p-3 space-y-2",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {generatedModels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Box className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-xs">No models generated yet</p>
            </div>
          ) : (
            generatedModels.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setSelectedModelIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selectedModelIndex === i
                    ? "bg-foreground text-background border-foreground"
                    : "bg-muted/30 border-border hover:bg-muted/60"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", selectedModelIndex === i ? "bg-background/20" : "bg-muted")}>
                  <Box className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{m.format.toUpperCase()}</p>
                  <p className="text-[10px] opacity-60 truncate">
                    {m.status === "completed" ? "Ready" : m.status === "processing" ? `${m.progress || 0}%` : m.status === "pending" ? "Queued" : "Failed"}
                  </p>
                </div>
                {m.riggingTaskId && (
                  <Bone className={cn("w-3 h-3 shrink-0", m.riggingStatus === "SUCCEEDED" ? "text-green-500" : "opacity-40")} />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sidebar Toggle */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background border-r border-b border-t border-border p-2 hover:bg-muted transition-all rounded-r-lg"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background h-full overflow-hidden relative">
        {/* 3D Viewport */}
        <div className="flex-1 relative min-h-0">
          {selectedModel && selectedModel.status === "completed" && selectedModel.url ? (
            <>
              {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
                selectedModel.riggedModelBlobUrl ? (
                  <Canvas className="w-full h-full">
                    <ModelScene modelUrl={selectedModel.riggedModelBlobUrl} format="glb" />
                  </Canvas>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 p-8 border border-border bg-background/80 backdrop-blur rounded-2xl max-w-sm">
                      <Box className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-sm font-semibold">Rigged Model Ready</p>
                      <p className="text-xs text-muted-foreground">Preview unavailable due to CORS. Download below.</p>
                      <Button onClick={() => handleDownloadRigged(selectedModel)} className="mt-2 text-xs">
                        <Download className="h-3.5 w-3.5 mr-2" /> Download Rigged GLB
                      </Button>
                    </div>
                  </div>
                )
              ) : selectedModel.format === "glb" ? (
                <Canvas className="w-full h-full">
                  <ModelScene modelUrl={selectedModel.url} format={selectedModel.format} />
                </Canvas>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3 p-8 border border-border bg-background/80 backdrop-blur rounded-2xl">
                    <Box className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm font-semibold">Preview Not Available</p>
                    <p className="text-xs text-muted-foreground">Only GLB format supports in-browser preview.</p>
                  </div>
                </div>
              )}

              {/* Viewer Controls HUD */}
              {(selectedModel.format === "glb" || selectedModel.riggedModelUrl) && (
                <div className="absolute top-4 right-4 z-10 bg-background/70 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2.5 shadow-lg">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Controls</div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>Left Drag: Rotate</div>
                    <div>Right Drag: Pan</div>
                    <div>Scroll: Zoom</div>
                  </div>
                  {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[10px] font-bold text-green-500">✓ Rigged</div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="absolute bottom-4 left-4 z-10 flex gap-2">
                {selectedModel.riggedModelUrl && selectedModel.riggingStatus === "SUCCEEDED" ? (
                  <Button onClick={() => handleDownloadRigged(selectedModel)} className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs rounded-xl shadow-lg h-8">
                    <Download className="h-3 w-3 mr-1.5" /> Rigged GLB
                  </Button>
                ) : (
                  <>
                    {selectedModel.format === "glb" && (
                      <Button
                        onClick={() => handleAutoRig(selectedModel)}
                        disabled={isRigging || !!selectedModel.riggingTaskId}
                        className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs disabled:opacity-50 rounded-xl shadow-lg h-8"
                      >
                        <Bone className="h-3 w-3 mr-1.5" />
                        {selectedModel.riggingStatus === "IN_PROGRESS" ? `Rigging ${selectedModel.riggingProgress || 0}%` : selectedModel.riggingStatus === "PENDING" ? "Pending..." : "Auto Rig"}
                      </Button>
                    )}
                    <Button onClick={() => handleDownload(selectedModel)} className="bg-foreground text-background hover:bg-foreground/90 text-xs rounded-xl shadow-lg h-8">
                      <Download className="h-3 w-3 mr-1.5" /> {selectedModel.format.toUpperCase()}
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              {isGenerating ? (
                <div className="space-y-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
                  <p className="text-muted-foreground text-xs">Generating 3D model...</p>
                  {selectedModel?.progress && <p className="text-[10px] text-muted-foreground">{selectedModel.progress}%</p>}
                </div>
              ) : (
                <div className="space-y-3 text-center opacity-30">
                  <Box className="h-16 w-16 mx-auto" />
                  <p className="text-xs">Upload images or describe your model below</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom Input Bar ── */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 px-4 flex justify-center">
          <div className="w-full max-w-3xl relative">
            {/* Error */}
            {error && (
              <div className="mb-2 mx-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs">
                {error}
              </div>
            )}

            {/* Input container */}
            <div className="relative bg-muted/60 backdrop-blur-xl border border-border rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
              {/* Input area */}
              <div className="pt-2 px-3 pb-1">
                {sourceMode === "image" ? (
                  generationMode === "single" ? (
                    /* Single image upload */
                    <div
                      className="h-[80px] w-full rounded-xl border border-dashed border-border bg-background/30 hover:bg-background/50 transition-colors cursor-pointer flex items-center justify-center overflow-hidden"
                      onClick={() => fileInputRefs.current["single"]?.click()}
                    >
                      {singleImage ? (
                        <img src={URL.createObjectURL(singleImage)} alt="Preview" className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Upload className="h-5 w-5 mb-1" />
                          <span className="text-[10px]">{isAuthenticated ? "Click to upload image" : "Login required"}</span>
                        </div>
                      )}
                      <input
                        ref={(el) => fileInputRefs.current["single"] = el}
                        type="file" accept="image/*"
                        onChange={(e) => handleImageUpload("single", e.target.files?.[0] || null)}
                        className="hidden" disabled={!isAuthenticated}
                      />
                    </div>
                  ) : (
                    /* Four image upload */
                    <div className="grid grid-cols-4 gap-2 h-[80px]">
                      {(["front", "back", "left", "right"] as const).map((view) => (
                        <div
                          key={view}
                          className="rounded-xl border border-dashed border-border bg-background/30 hover:bg-background/50 transition-colors cursor-pointer flex flex-col items-center justify-center overflow-hidden"
                          onClick={() => fileInputRefs.current[view]?.click()}
                        >
                          {fourImages[view] ? (
                            <img src={URL.createObjectURL(fourImages[view]!)} alt={view} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex flex-col items-center text-muted-foreground">
                              <Upload className="h-4 w-4 mb-0.5" />
                              <span className="text-[9px] capitalize">{view}</span>
                            </div>
                          )}
                          <input
                            ref={(el) => fileInputRefs.current[view] = el}
                            type="file" accept="image/*"
                            onChange={(e) => handleImageUpload(view, e.target.files?.[0] || null)}
                            className="hidden" disabled={!isAuthenticated}
                          />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Text prompt */
                  <textarea
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder={isAuthenticated ? "Describe the 3D model you want to generate..." : "Please login to generate"}
                    className="flex-1 w-full bg-transparent text-foreground placeholder:text-muted-foreground p-2 text-sm resize-none focus:outline-none min-h-[80px] max-h-[120px]"
                    rows={3}
                    disabled={!isAuthenticated || isGenerating}
                    maxLength={600}
                  />
                )}
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 flex-wrap gap-y-1">
                {/* Left side controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source toggle: Image to 3D / Text to 3D */}
                  <div className="flex items-center bg-background border border-border rounded-full p-0.5">
                    <button
                      onClick={() => setSourceMode("image")}
                      className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                        sourceMode === "image" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Upload className="w-3 h-3" /> Image to 3D
                    </button>
                    <button
                      onClick={() => setSourceMode("text")}
                      className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                        sourceMode === "text" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="w-3 h-3" /> Text to 3D
                    </button>
                  </div>

                  {sourceMode === "image" && (
                    <>
                      {/* Single / Multiple */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowModeSelect(!showModeSelect); setShowModelSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{generationMode === "single" ? "From Single" : "From Multiple"}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showModeSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showModeSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v: "single", l: "From Single"}, {v: "four", l: "From Multiple"}].map(o => (
                              <button key={o.v} onClick={() => { setGenerationMode(o.v as GenerationMode); setShowModeSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", generationMode === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Model */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowModelSelect(!showModelSelect); setShowModeSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{model}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showModelSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showModelSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <button onClick={() => { setModel("koye-3dv1"); setShowModelSelect(false) }}
                              className={cn("w-full text-left px-3 py-2 text-xs transition-colors", model === "koye-3dv1" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                            >koye-3dv1</button>
                          </div>
                        )}
                      </div>

                      {/* Export Format */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowFormatSelect(!showFormatSelect); setShowModeSelect(false); setShowModelSelect(false); setShowResolutionSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>.{format}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showFormatSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showFormatSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[90px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {["glb","obj","stl","fbx"].map(f => (
                              <button key={f} onClick={() => { setFormat(f as ModelFormat); setShowFormatSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", format === f ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >.{f}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {sourceMode === "text" && (
                    <>
                      {/* Art Style */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowArtStyleSelect(!showArtStyleSelect); setShowTopologySelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span className="capitalize">{artStyle}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showArtStyleSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showArtStyleSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[110px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"realistic",l:"Realistic"},{v:"sculpture",l:"Sculpture"}].map(o => (
                              <button key={o.v} onClick={() => { setArtStyle(o.v as any); setShowArtStyleSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", artStyle === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Topology */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowTopologySelect(!showTopologySelect); setShowArtStyleSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span className="capitalize">{topology}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showTopologySelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showTopologySelect && (
                          <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"triangle",l:"Triangle"},{v:"quad",l:"Quad"}].map(o => (
                              <button key={o.v} onClick={() => { setTopology(o.v as any); setShowTopologySelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", topology === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PBR toggle */}
                      <button
                        onClick={() => setEnablePbr(!enablePbr)}
                        className={cn("px-3 py-1 rounded-full text-xs font-medium transition-all border",
                          enablePbr ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >PBR Maps</button>
                    </>
                  )}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2">
                  {sourceMode === "image" && (
                    <>
                      {/* Texture */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowTextureSelect(!showTextureSelect); setShowModeSelect(false); setShowModelSelect(false); setShowFormatSelect(false); setShowResolutionSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{generationType === "both" ? "With Texture" : generationType === "mesh" ? "No Texture" : "Texture Only"}</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showTextureSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showTextureSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] right-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"both",l:"With Texture"},{v:"mesh",l:"No Texture"},{v:"texture",l:"Texture Only"}].map(o => (
                              <button key={o.v} onClick={() => { setGenerationType(o.v as GenerationType); setShowTextureSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", generationType === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Resolution */}
                      <div className="relative media-dropdown-element">
                        <button
                          onClick={() => { setShowResolutionSelect(!showResolutionSelect); setShowModeSelect(false); setShowModelSelect(false); setShowFormatSelect(false); setShowTextureSelect(false) }}
                          className="flex items-center gap-2 bg-background border border-border text-foreground text-xs px-3 py-1 rounded-full hover:bg-muted transition-colors"
                        >
                          <span>{resolution}³</span>
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", showResolutionSelect ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {showResolutionSelect && (
                          <div className="absolute bottom-[calc(100%+8px)] right-0 min-w-[130px] bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[{v:"512",l:"512³"},{v:"1024",l:"1024³"},{v:"1536",l:"1536³"},{v:"1536Pro",l:"1536³ Pro"}].map(o => (
                              <button key={o.v} onClick={() => { setResolution(o.v as ModelResolution); setShowResolutionSelect(false) }}
                                className={cn("w-full text-left px-3 py-2 text-xs transition-colors", resolution === o.v ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                              >{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isAuthenticated}
                    className="bg-foreground text-background font-semibold text-xs px-5 py-1.5 rounded-full hover:bg-foreground/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGenerating && <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />}
                    {isGenerating ? "Generating..." : isAuthenticated ? "Generate" : "Login"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'''

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(header + '\n' + new_return + '\n')

print('SUCCESS: Model3DGeneration.tsx updated.')
