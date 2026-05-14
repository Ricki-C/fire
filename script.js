# The Fire Feedback — D3 Scrollytelling

A scrollytelling visualization of CMIP6 climate model projections for the
fire-climate feedback loop over the contiguous United States.

## Run locally

```bash
cd fire-climate-d3
python3 -m http.server 8000
# then open http://localhost:8000
```

Or in VS Code, install the **Live Server** extension and right-click
`index.html` → "Open with Live Server".

## File structure

```
fire-climate-d3/
├── index.html          Editorial scrollytelling layout
├── style.css           Typography + warm sunset palette
├── script.js           D3 stages controlled by IntersectionObserver
└── data/
    ├── feedback_loop.csv          Enriched with 10-yr rolling means
    └── feedback_loop_raw.csv      Original Colab output
```

## How the story works

Six scrolly stages, each triggers a chart transition:

1. **intro** — all three temperature lines fade in together
2. **warming** — temperature stays central, end-of-century delta labels appear
3. **drying** — chart pivots to soil moisture, baseline highlighted
4. **burning** — burnt area, with warm-glow area fill under SSP5-8.5
5. **loop** — chart morphs into a circular feedback diagram
6. **end** — small-multiples showing all three variables together

## Design choices

**Typography pairing**: Fraunces (display serif, expressive italics) +
Inter (workhorse sans) + JetBrains Mono (data labels). Avoids the default
sans-serif look.

**Color**: warm sunset palette — bg `#1a0f0a` → ink `#f5ede0`. SSP585 is
`#ff7849` (warm coral), SSP126 is `#87ceeb` (sky blue) — both readable on
dark, evoke heat vs. cool.

**Smoothing**: every variable uses a 10-year centered rolling mean for the
bold line, with the raw jagged data shown at 30% opacity behind. Lets the
reader see both the trend and the noise.

**End labels**: at the end of every line, show the actual 2100 value
relative to the 1995–2014 baseline (e.g. "+7.9°C", "3.6×").

## Data provenance

- **Model**: NCAR CESM2, member r1i1p1f1
- **Experiments**: `historical` (1995–2014), `ssp126` and `ssp585` (2015–2100)
- **Variables**: `tas`, `mrsos`, `burntFractionAll`
- **Aggregation**: area-weighted mean over CONUS (excludes Alaska, Hawaii),
  then averaged to annual values
- **Source**: Pangeo CMIP6 archive on Google Cloud Storage (`gs://cmip6/`)

Note: `fFire` (fire carbon flux) was not available in the CESM2 archive on
GCS for this combination, so the "fire releases carbon" leg of the loop is
shown schematically in stage 5 rather than as a quantitative chart.
