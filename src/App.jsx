import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import './App.css'

const drawLogo = (canvas, version, margin) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      const totalModules = (17 + 4 * version) + 2 * margin
      const mod = canvas.width / totalModules

      const dataModules = 17 + 4 * version
      let rectMods = Math.round(dataModules * 0.2)
      if (rectMods % 2 === 0) rectMods++

      const centerMod = margin + Math.floor(dataModules / 2)
      const halfRect = Math.floor(rectMods / 2)
      const rx = (centerMod - halfRect) * mod
      const ry = (centerMod - halfRect) * mod
      const rectPx = rectMods * mod

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

const buildVcard = ({ lastName, firstName, phone, website, email, organization }) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (!fullName && !phone && !website && !email && !organization) return ''
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${fullName}`,
  ]
  if (organization) lines.push(`ORG:${organization}`)
  if (phone) lines.push(`TEL:${phone}`)
  if (email) lines.push(`EMAIL:${email}`)
  if (website) lines.push(`URL:${website}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

function App() {
  const [mode, setMode] = useState('url')
  const [url, setUrl] = useState('')
  const [contact, setContact] = useState({ lastName: '', firstName: '', phone: '', website: '', email: '', organization: '' })
  const [errorLevel, setErrorLevel] = useState('M')
  const [version, setVersion] = useState(1)
  const [margin, setMargin] = useState(2)
  const [error, setError] = useState('')
  const [withLogo, setWithLogo] = useState(false)
  const canvasRef = useRef(null)

  const effectiveErrorLevel = withLogo ? 'H' : errorLevel
  const qrOptions = { errorCorrectionLevel: effectiveErrorLevel, version, margin }

  const qrContent = mode === 'url' ? url : buildVcard(contact)

  const setContactField = (field) => (e) => setContact((prev) => ({ ...prev, [field]: e.target.value }))

  const findMinVersion = async (text, level) => {
    for (let v = 1; v <= 40; v++) {
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
    if (qrContent && canvasRef.current) {
      setError('')
      QRCode.toCanvas(canvasRef.current, qrContent, { ...qrOptions, width: 256 })
        .then(async () => {
          if (withLogo) await drawLogo(canvasRef.current, version, margin)
        })
        .catch(async () => {
          const minVersion = await findMinVersion(qrContent, effectiveErrorLevel)
          if (minVersion) {
            setVersion(minVersion)
          } else {
            setError('Données trop longues pour les versions disponibles')
          }
        })
    }
  }, [qrContent, errorLevel, version, margin, withLogo])

  const downloadPng = async () => {
    const offscreen = document.createElement('canvas')
    offscreen.width = 500
    offscreen.height = 500
    try {
      await QRCode.toCanvas(offscreen, qrContent, { ...qrOptions, width: 500 })
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
      const svg = await QRCode.toString(qrContent, { ...qrOptions, type: 'svg' })
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

      const dataModules = 17 + 4 * version
      let rectMods = Math.round(dataModules * 0.21)
      if (rectMods % 2 === 0) rectMods++
      const centerMod = margin + Math.floor(dataModules / 2)
      const halfRect = Math.floor(rectMods / 2)
      const rectX = centerMod - halfRect
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

      <div className="mode-tabs">
        <button
          className={mode === 'url' ? 'active' : ''}
          onClick={() => setMode('url')}
        >
          URL
        </button>
        <button
          className={mode === 'contact' ? 'active' : ''}
          onClick={() => setMode('contact')}
        >
          Contact
        </button>
      </div>

      {mode === 'url' ? (
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
      ) : (
        <div className="contact-grid">
          <div className="form-group">
            <label>Prénom</label>
            <input type="text" value={contact.firstName} onChange={setContactField('firstName')} placeholder="Jean" />
          </div>
          <div className="form-group">
            <label>Nom</label>
            <input type="text" value={contact.lastName} onChange={setContactField('lastName')} placeholder="Dupont" />
          </div>
          <div className="form-group">
            <label>Organisation</label>
            <input type="text" value={contact.organization} onChange={setContactField('organization')} placeholder="Entreprise" />
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input type="tel" value={contact.phone} onChange={setContactField('phone')} placeholder="+33 6 00 00 00 00" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={contact.email} onChange={setContactField('email')} placeholder="jean@example.com" />
          </div>
          <div className="form-group">
            <label>Site internet</label>
            <input type="url" value={contact.website} onChange={setContactField('website')} placeholder="https://example.com" />
          </div>
        </div>
      )}

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
          {Array.from({ length: 40 }, (_, i) => i + 1).map((v) => (
            <option key={v} value={v}>{v} ({(17 + 4 * v)}x{(17 + 4 * v)})</option>
          ))}
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
        {qrContent ? (
          <>
            <canvas ref={canvasRef} />
            {error && <div className="error">{error}</div>}
          </>
        ) : (
          <div className="placeholder">
            {mode === 'url' ? 'Entrez une URL pour générer le QR code' : 'Remplissez au moins un champ pour générer le QR code'}
          </div>
        )}
      </div>

      {qrContent && !error && (
        <div className="download-buttons">
          <button onClick={downloadPng}>Télécharger PNG (500x500)</button>
          <button onClick={downloadSvg}>Télécharger SVG</button>
        </div>
      )}
    </div>
  )
}

export default App
