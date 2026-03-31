import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import './App.css'

const drawLogo = (canvas, version, margin) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      // qrcode lib sets canvas.width = scale * totalModules (exact integer)
      const totalModules = (17 + 4 * version) + 2 * margin
      const mod = canvas.width / totalModules  // exact, no rounding error

      // White rect = odd number of modules (~21% of data area) for symmetric centering
      const dataModules = 17 + 4 * version
      let rectMods = Math.round(dataModules * 0.2)
      if (rectMods % 2 === 0) rectMods++

      const centerMod = margin + Math.floor(dataModules / 2)
      const halfRect = Math.floor(rectMods / 2)
      const rx = (centerMod - halfRect) * mod  // exact module boundary
      const ry = (centerMod - halfRect) * mod
      const rectPx = rectMods * mod

      // Logo inset by 1 module on each side
      const logoSize = (rectMods - 2) * mod
      const logoOffset = mod

      ctx.fillStyle = 'white'
      ctx.fillRect(rx, ry, rectPx, rectPx)
      ctx.drawImage(img, rx + logoOffset, ry + logoOffset, logoSize, logoSize)
      resolve()
    }
    img.onerror = resolve
    img.src = '/logo.svg'
  })
}

function App() {
  const [url, setUrl] = useState('')
  const [errorLevel, setErrorLevel] = useState('M')
  const [version, setVersion] = useState(4)
  const [margin, setMargin] = useState(2)
  const [error, setError] = useState('')
  const [withLogo, setWithLogo] = useState(false)
  const canvasRef = useRef(null)

  const effectiveErrorLevel = withLogo ? 'H' : errorLevel
  const qrOptions = { errorCorrectionLevel: effectiveErrorLevel, version, margin }

  const findMinVersion = async (text, level) => {
    for (let v = 2; v <= 6; v++) {
      try {
        await QRCode.toString(text, { errorCorrectionLevel: level, version: v })
        return v
      } catch {
        continue
      }
    }
    return null
  }

  useEffect(() => {
    if (url && canvasRef.current) {
      setError('')
      QRCode.toCanvas(canvasRef.current, url, { ...qrOptions, width: 256 })
        .then(async () => {
          if (withLogo) await drawLogo(canvasRef.current, version, margin)
        })
        .catch(async () => {
          const minVersion = await findMinVersion(url, effectiveErrorLevel)
          if (minVersion && minVersion <= 6) {
            setVersion(minVersion)
          } else {
            setError('Données trop longues pour les versions disponibles')
          }
        })
    }
  }, [url, errorLevel, version, margin, withLogo])

  const downloadPng = async () => {
    const offscreen = document.createElement('canvas')
    offscreen.width = 500
    offscreen.height = 500
    try {
      await QRCode.toCanvas(offscreen, url, { ...qrOptions, width: 500 })
      if (withLogo) await drawLogo(offscreen, version, margin)
      const dataUrl = offscreen.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = 'qrcode.png'
      link.href = dataUrl
      link.click()
    } catch {}
  }

  const downloadSvg = async () => {
    try {
      const svg = await QRCode.toString(url, { ...qrOptions, type: 'svg' })
      if (!withLogo) {
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const link = document.createElement('a')
        link.download = 'qrcode.svg'
        link.href = URL.createObjectURL(blob)
        link.click()
        return
      }

      const parser = new DOMParser()
      const logoRes = await fetch('/logo.svg')
      const logoText = await logoRes.text()
      const logoDoc = parser.parseFromString(logoText, 'image/svg+xml')
      const logoSvgEl = logoDoc.querySelector('svg')
      const logoViewBox = logoSvgEl.getAttribute('viewBox')
      const logoInner = logoSvgEl.innerHTML

      // In the qrcode SVG, viewBox units = modules (1 unit = 1 module)
      const dataModules = 17 + 4 * version
      let rectMods = Math.round(dataModules * 0.21)
      if (rectMods % 2 === 0) rectMods++
      const centerMod = margin + Math.floor(dataModules / 2)
      const halfRect = Math.floor(rectMods / 2)
      const rectX = centerMod - halfRect  // integer → exact module boundary
      const rectY = centerMod - halfRect
      const logoX = rectX + 1
      const logoY = rectY + 1
      const logoSize = rectMods - 2

      const inject = `<rect x="${rectX}" y="${rectY}" width="${rectMods}" height="${rectMods}" fill="white"/><g transform="translate(${logoX},${logoY})"><svg width="${logoSize}" height="${logoSize}" viewBox="${logoViewBox}" preserveAspectRatio="xMidYMid meet">${logoInner}</svg></g>`
      const modifiedSvg = svg.replace('</svg>', inject + '</svg>')

      const blob = new Blob([modifiedSvg], { type: 'image/svg+xml' })
      const link = document.createElement('a')
      link.download = 'qrcode.svg'
      link.href = URL.createObjectURL(blob)
      link.click()
    } catch {}
  }

  return (
    <div className="container">
      <h1>QR Code Generator</h1>

      <div className="form-group">
        <label htmlFor="url">URL</label>
        <input
          id="url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="options-grid">
        <label htmlFor="errorLevel">Correction</label>
        <select
          id="errorLevel"
          value={effectiveErrorLevel}
          onChange={(e) => setErrorLevel(e.target.value)}
          disabled={withLogo}
        >
          <option value="L">L (7%)</option>
          <option value="M">M (15%)</option>
          <option value="Q">Q (25%)</option>
          <option value="H">H (30%)</option>
        </select>

        <label htmlFor="version">Version</label>
        <select
          id="version"
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
        >
          <option value={2}>2 (25x25)</option>
          <option value={3}>3 (29x29)</option>
          <option value={4}>4 (33x33)</option>
          <option value={5}>5 (37x37)</option>
          <option value={6}>6 (41x41)</option>
        </select>

        <label htmlFor="withLogo">Logo</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
          <input
            id="withLogo"
            type="checkbox"
            checked={withLogo}
            onChange={(e) => setWithLogo(e.target.checked)}
          />
          {withLogo ? 'Activé (correction forcée H)' : 'Désactivé'}
        </label>
      </div>

      <div className="qr-container">
        {url ? (
          <>
            <canvas ref={canvasRef} />
            {error && <div className="error">{error}</div>}
          </>
        ) : (
          <div className="placeholder">Entrez une URL pour générer le QR code</div>
        )}
      </div>

      {url && !error && (
        <div className="download-buttons">
          <button onClick={downloadPng}>Télécharger PNG (500x500)</button>
          <button onClick={downloadSvg}>Télécharger SVG</button>
        </div>
      )}
    </div>
  )
}

export default App
