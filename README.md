# Physical Items List

[English](README.md) | [Česky](README.cs.md)

Physical Items List is an Ex Libris Alma Cloud App that lists physical items from a selected library and physical location and opens a compact A4 landscape print view. The browser can print it directly or save it as a text-based PDF.

## Output

Users can choose which fields are included in the preview and print/PDF output. All fields are selected by default:

- Call Number
- Inventory Number
- MMS ID
- Barcode
- Title
- Author
- Year
- Description
- Note (Internal Note 3)

Library and location are selection filters, not separate output columns. The selected library and location, including the location code, are shown in the print header.

The default sort field is Inventory Number. Users can select another output field for sorting. Empty values in the selected sort field are placed at the end.

Long values remain on one line and are visually truncated with an ellipsis so every physical item occupies one row.

## Data sources

The app does **not** use Alma Analytics.

It uses:

- `GET /almaws/v1/conf/libraries` for the library selector
- `GET /almaws/v1/conf/libraries/{libraryCode}/locations` for the location selector
- Alma SRU to find bibliographic records that have items in the selected library/location
- `GET /almaws/v1/bibs/{mms_id}/holdings/ALL/items` to retrieve item details

Locations in the selector are sorted by location code using natural numeric ordering and then by location name.

## SRU requirement and configuration

The institution must have an Alma SRU integration profile enabled.

The app automatically derives the standard SRU endpoint from the current Alma environment:

`/view/sru/<institution-code>`

The custom SRU field accepts either:
- a complete URL, for example `https://alma.example.edu/view/sru/INSTITUTION_CODE`
- a relative path, for example `/view/sru/INSTITUTION_CODE`

If the field is empty, the app uses the standard SRU endpoint derived from the current Alma environment.

SRU authentication is optional:
- leave username and password empty for anonymous SRU
- enter both values when the SRU profile requires HTTP Basic Authentication

The institution-wide configuration also contains a configurable Czech and English print-header prefix. Defaults are `Knihovna` / `Library`; each institution can replace them with its own values, for example `ČVUT` / `CTU`.

The settings are stored with Alma `CloudAppConfigService` as institution-wide Cloud App configuration.

The app reads the SRU `explain` response and discovers the Item Library and Item Location search indexes dynamically.

Alma SRU limits a single search to 10,000 bibliographic records. The app displays a warning if this limit is reached.

## Languages

- English (`en`) — fallback
- Czech (`cs`)

The interface and print headings follow the current Alma session language.

## Security

- Read-only
- No Alma API key embedded in the Cloud App
- No Analytics
- No external database
- No Alma data is modified

## Local development

```text
eca init
eca start
```

For production validation:

```text
eca build
```

`config.json`, `node_modules`, `.ng`, `build` and `dist` are ignored by Git.

## Author

Antonín Skopec

## License

MIT License.

## Version

1.0.0
