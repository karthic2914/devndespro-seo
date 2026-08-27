import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faChevronDown,
  faCircleCheck,
  faGlobe,
  faLanguage,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'

const ICONS = {
  market: faGlobe,
  language: faLanguage,
  sort: faChartLine,
  engine: faMagnifyingGlass,
  default: faGlobe,
}

const COUNTRY_CODES = {
  norway: 'NO',
  no: 'NO',

  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US',

  'united kingdom': 'GB',
  uk: 'GB',
  gb: 'GB',

  australia: 'AU',
  au: 'AU',

  canada: 'CA',
  ca: 'CA',

  germany: 'DE',
  de: 'DE',

  india: 'IN',
  in: 'IN',

  sweden: 'SE',
  se: 'SE',

  denmark: 'DK',
  dk: 'DK',

  finland: 'FI',
  fi: 'FI',

  france: 'FR',
  fr: 'FR',

  spain: 'ES',
  es: 'ES',

  italy: 'IT',
  it: 'IT',

  netherlands: 'NL',
  nl: 'NL',

  ireland: 'IE',
  ie: 'IE',

  singapore: 'SG',
  sg: 'SG',

  'united arab emirates': 'AE',
  uae: 'AE',
  ae: 'AE',
}

function optionValue(option) {
  if (
    typeof option === 'string' ||
    typeof option === 'number'
  ) {
    return option
  }

  return option.value
}

function optionLabel(option) {
  if (
    typeof option === 'string' ||
    typeof option === 'number'
  ) {
    return String(option)
  }

  return option.label
}

function getCountryCode(option) {
  if (
    option &&
    typeof option === 'object'
  ) {
    const explicitCode =
      option.countryCode ||
      option.country_code ||
      option.code

    if (
      explicitCode &&
      /^[a-z]{2}$/i.test(
        String(explicitCode)
      )
    ) {
      return String(
        explicitCode
      ).toUpperCase()
    }
  }

  const value = String(
    optionValue(option) ?? ''
  )
    .trim()
    .toLowerCase()

  const label = String(
    optionLabel(option) ?? ''
  )
    .trim()
    .toLowerCase()

  if (COUNTRY_CODES[value]) {
    return COUNTRY_CODES[value]
  }

  if (COUNTRY_CODES[label]) {
    return COUNTRY_CODES[label]
  }

  if (/^[a-z]{2}$/i.test(value)) {
    return value.toUpperCase()
  }

  return null
}

function countryFlag(code) {
  if (!code) {
    return null
  }

  const normalized =
    String(code).toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null
  }

  return String.fromCodePoint(
    ...normalized
      .split('')
      .map(
        (letter) =>
          127397 +
          letter.charCodeAt(0)
      )
  )
}

function MarketIcon({
  option,
  fallbackIcon,
}) {
  const code = getCountryCode(option)
  const flag = countryFlag(code)

  if (flag) {
    return (
      <span
        className="kwm-country-flag"
        aria-hidden="true"
      >
        {flag}
      </span>
    )
  }

  return (
    <FontAwesomeIcon
      icon={fallbackIcon}
    />
  )
}

export default function MobileBottomSelect({
  label,
  value,
  options = [],
  onChange,
  kind = 'default',
}) {
  const [open, setOpen] =
    useState(false)

  const selected = options.find(
    (option) =>
      String(optionValue(option)) ===
      String(value)
  )

  const icon =
    ICONS[kind] ||
    ICONS.default

  const isMarket =
    kind === 'market'

  return (
    <>
      <button
        type="button"
        className="kwm-native-select-trigger"
        onClick={() => setOpen(true)}
      >
        <span className="kwm-native-select-leading">

          <span
            className={
              `kwm-native-select-icon ${kind}`
            }
          >
            {isMarket && selected ? (
              <MarketIcon
                option={selected}
                fallbackIcon={icon}
              />
            ) : (
              <FontAwesomeIcon
                icon={icon}
              />
            )}
          </span>

          <span className="kwm-native-select-copy">

            <small>
              {label}
            </small>

            <strong>
              {selected
                ? optionLabel(selected)
                : 'Select'}
            </strong>

          </span>

        </span>

        <FontAwesomeIcon
          icon={faChevronDown}
          className="kwm-native-select-chevron"
        />

      </button>

      {open && typeof document !== 'undefined' ? createPortal(

        <div
          className="kwm-native-select-backdrop"
          onClick={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false)
            }

          }}
        >

          <div className="kwm-native-select-sheet">

            <div className="kwm-native-select-handle" />

            <div className="kwm-native-select-title">

              <span
                className={
                  `kwm-native-select-icon ${kind}`
                }
              >
                <FontAwesomeIcon
                  icon={icon}
                />
              </span>

              <div>

                <strong>
                  {isMarket
                    ? 'Select market'
                    : label}
                </strong>

                <small>
                  {isMarket
                    ? 'Choose your target country'
                    : 'Select an option'}
                </small>

              </div>

            </div>

            <div className="kwm-native-select-options">

              {options.map((option) => {

                const currentValue =
                  optionValue(option)

                const selectedOption =
                  String(currentValue) ===
                  String(value)

                return (

                  <button
                    key={String(currentValue)}
                    type="button"
                    className={
                      `kwm-native-select-option ${
                        selectedOption
                          ? 'selected'
                          : ''
                      }`
                    }
                    onClick={() => {

                      onChange?.(
                        currentValue
                      )

                      setOpen(false)

                    }}
                  >

                    <span className="kwm-native-select-option-left">

                      <span
                        className={
                          `kwm-native-select-option-icon ${kind}`
                        }
                      >

                        {isMarket ? (
                          <MarketIcon
                            option={option}
                            fallbackIcon={icon}
                          />
                        ) : (
                          <FontAwesomeIcon
                            icon={icon}
                          />
                        )}

                      </span>

                      <span className="kwm-native-select-option-copy">

                        <strong>
                          {optionLabel(option)}
                        </strong>

                        {
                          !isMarket &&
                          typeof option === 'object' &&
                          option.description
                            ? (
                              <small>
                                {option.description}
                              </small>
                            )
                            : null
                        }

                      </span>

                    </span>

                    <span
                      className={
                        `kwm-native-select-radio ${
                          selectedOption
                            ? 'selected'
                            : ''
                        }`
                      }
                    >

                      {selectedOption ? (
                        <FontAwesomeIcon
                          icon={faCircleCheck}
                        />
                      ) : null}

                    </span>

                  </button>

                )

              })}

            </div>

            <button
              type="button"
              className="kwm-native-select-cancel"
              onClick={() =>
                setOpen(false)
              }
            >
              Cancel
            </button>

          </div>

        </div>,
        document.body
      ) : null}

    </>
  )
}