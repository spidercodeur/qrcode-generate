import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [errorLevel, setErrorLevel] = useState('M')
  const [version, setVersion] = useState(4)
  const [margin, setMargin] = useState(2)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)

  const qrOptions = {
    errorCorrectionLevel: errorLevel,
    version: version,
    margin: margin,
  }

  // Trouve la version minimale requise
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
      QRCode.toCanvas(canvasRef.current, url, {
        ...qrOptions,
        width: 256,
      }).catch(async () => {
        const minVersion = await findMinVersion(url, errorLevel)
        if (minVersion && minVersion <= 6) {
          setVersion(minVersion)
        } else {
          setError('Données trop longues pour les versions disponibles')
        }
      })
    }
  }, [url, errorLevel, version, margin])

  const downloadPng = () => {
    QRCode.toDataURL(url, { ...qrOptions, width: 500 })
      .then(dataUrl => {
        const link = document.createElement('a')
        link.download = 'qrcode.png'
        link.href = dataUrl
        link.click()
      })
      .catch(() => { })
  }

  const downloadSvg = () => {
    QRCode.toString(url, { ...qrOptions, type: 'svg' })
      .then(svg => {
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const link = document.createElement('a')
        link.download = 'qrcode.svg'
        link.href = URL.createObjectURL(blob)
        link.click()
      })
      .catch(() => { })
  }

  return (
    <div className="container ">
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
          value={errorLevel}
          onChange={(e) => setErrorLevel(e.target.value)}
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
