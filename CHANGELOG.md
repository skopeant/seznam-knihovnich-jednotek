# Changelog

## [1.0.0] - 2026-09-10

### Changed
- SRU configuration now accepts either a full URL or a relative `/view/sru/...` path resolved against the current Alma host.
- Added configurable Czech/English print-title prefix with defaults `Knihovna` / `Library`.
- Print title now includes the selected location code in parentheses after the location name.
- Location dropdown is now sorted by location code numerically first, then by location name.
- Reworked output fields to match the required item list: inventory number, MMS ID, barcode, title, author, year, description and Internal Note 3.
- Library and location remain selection filters and are not output columns.
- All output fields are selected by default and can be individually included or excluded.
- Added selectable sorting field; default sorting is by inventory number.
- Empty values are always sorted to the end.
- Generalized SRU configuration for public use across Alma institutions.
- Standard SRU endpoint is derived automatically from the current Alma environment; no institution-specific URL is hard-coded.
- Added support for anonymous SRU as well as HTTP Basic Authentication.
- Custom SRU URL remains available for institutions with non-standard endpoints.
- Updated direct dependencies based on npm audit: `lodash` 4.18.1, `uuid` 11.1.1 and `postcss` 8.5.23.
- Kept Angular and Ex Libris SDK versions unchanged to preserve Cloud App SDK compatibility.
- Renamed the Czech barcode column heading from `ČÁROVÝ KÓD` to `ČÁR.KÓD`.
- Aligned printing with the proven Purchase Order Printing pattern: a normal print-preview window with a visible Print button in the upper-right corner.
- Removed automatic printing; the user explicitly opens the browser print dialog from the preview window.
- Simplified the introductory text and removed the implementation detail about Analytics.
- Clarified loading progress as two explicit stages: title search and item loading.
- Replaced bitmap PDF generation (`html2canvas` + `jsPDF`) with browser-native A4 landscape printing.
- Print/PDF output is now real selectable/searchable text instead of page images.
- Large locations no longer require rendering every page to canvas before printing.
- Removed `html2canvas` and `jsPDF` runtime dependencies.

### Fixed
- Corrected the English label from `Inventory Number` to Alma terminology `Inventory Number`.
- Restored call number (Signatura / Call Number) as a selectable output field, selected by default.
- Fixed Angular HttpClient overload typing for SRU text responses (`responseType: 'text' as const`).
- Restored the authenticated `getSruText()` / Basic Auth helper after the text-PDF refactor.
- Optimized PDF generation for large locations: native-resolution rendering, no artificial per-page delay and 50 one-line items per A4 landscape page.
- Kept HTML/canvas rendering so Czech and other Unicode characters remain reliable in the generated PDF without embedding an additional font.
- Fixed SRU library/location filtering so an empty first ID variant no longer prevents trying the documented location code.
- The documented combination (library ID + location code) is now attempted first.
- Narrowed the main UI to fit the Alma Cloud App side panel without horizontal overflow.

### Added
- Library selector loaded from Alma REST API.
- Location selector loaded dynamically for the selected library.
- Physical-item discovery without Alma Analytics.
- Alma SRU integration with dynamic Item Library / Item Location index discovery.
- Institution-wide SRU URL, username and password configuration using `CloudAppConfigService`.
- HTTP Basic Authentication for SRU requests.
- Physical item retrieval through the Alma REST API.
- Czech and English user interface following the Alma session language.
- A4 landscape PDF output.
- Compact one-item-per-row layout.
- Fixed PDF columns: call number, inventory number, barcode, title, author and year.
- Long values are kept on one line and truncated with an ellipsis.
- Read-only operation with no embedded Alma API key.
