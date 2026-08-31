import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faGlobe, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'

const ISO_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(' ')

const NAMES = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

const flag = code => code === 'XK'
  ? 'ðŸ‡½ðŸ‡°'
  : String(code).toUpperCase().replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt()))

export const COUNTRIES = ISO_CODES
  .map(code => ({ code, name: NAMES?.of(code) || code, flag: flag(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function countryByCode(code) {
  return COUNTRIES.find(country => country.code === String(code || '').toUpperCase()) ||
    COUNTRIES.find(country => country.code === 'NO')
}

export default function CountrySelect({ value = 'NO', onChange, className = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  const selected = countryByCode(value)
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return COUNTRIES
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(term) || country.code.toLowerCase().includes(term)
    )
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('mobile-sheet-open')
    requestAnimationFrame(() => searchRef.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('mobile-sheet-open')
    }
  }, [open])

  const choose = country => {
    onChange?.(country.code, country)
    setOpen(false)
    setQuery('')
  }

  const panel = (
    <section className="country-select__panel" role="dialog" aria-modal="true" aria-label="Search location">
      <div className="country-select__handle" />
      <header className="country-select__header">
        <div><strong>Search location</strong><span>Choose the country whose results you want to analyze</span></div>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)}><FontAwesomeIcon icon={faXmark} /></button>
      </header>
      <label className="country-select__search">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search countries..." />
      </label>
      <div className="country-select__options" role="listbox">
        {filtered.map(country => (
          <button key={country.code} type="button" role="option" aria-selected={country.code === selected.code}
            className={country.code === selected.code ? 'is-selected' : ''} onClick={() => choose(country)}>
            <span className="country-select__flag">{country.flag}</span>
            <span className="country-select__name">{country.name}</span>
            <span className="country-select__code">{country.code}</span>
            {country.code === selected.code && <FontAwesomeIcon icon={faCheck} />}
          </button>
        ))}
        {!filtered.length && <div className="country-select__empty">No countries found</div>}
      </div>
    </section>
  )

  return (
    <div className={`country-select ${className}`.trim()}>
      <button type="button" className="country-select__trigger" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(current => !current)}>
        <span className="country-select__flag">{selected.flag}</span>
        <span className="country-select__trigger-copy"><small>Location</small><strong>{selected.name}</strong></span>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      {open && <>
        <div className="country-select__desktop-panel">{panel}</div>
        {createPortal(<div className="country-select__overlay" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>{panel}</div>, document.body)}
      </>}
    </div>
  )
}
