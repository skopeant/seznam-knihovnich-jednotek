import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  CloudAppConfigService,
  CloudAppEventsService,
  CloudAppRestService
} from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { normalizeSruConfig, SruConfig } from '../sru-config';
import { firstValueFrom } from 'rxjs';

interface AlmaLibrary {
  code: string;
  id: string;
  name: string;
}

interface AlmaLocation {
  code: string;
  id: string;
  name: string;
}

type OutputColumnKey =
  | 'callNumber'
  | 'accessionNumber'
  | 'mmsId'
  | 'barcode'
  | 'title'
  | 'author'
  | 'year'
  | 'description'
  | 'internalNote3';

interface ListItem {
  callNumber: string;
  accessionNumber: string;
  mmsId: string;
  barcode: string;
  title: string;
  author: string;
  year: string;
  description: string;
  internalNote3: string;
}

interface OutputColumn {
  key: OutputColumnKey;
  labelKey: string;
  width: number;
}

interface SruIndexes {
  location: string;
}

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  libraries: AlmaLibrary[] = [];
  locations: AlmaLocation[] = [];
  items: ListItem[] = [];

  selectedLibraryCode = '';
  selectedLocationCode = '';

  readonly outputColumns: OutputColumn[] = [
    { key: 'callNumber', labelKey: 'Columns.CallNumber', width: 12 },
    { key: 'accessionNumber', labelKey: 'Columns.AccessionNumber', width: 13 },
    { key: 'mmsId', labelKey: 'Columns.MmsId', width: 12 },
    { key: 'barcode', labelKey: 'Columns.Barcode', width: 12 },
    { key: 'title', labelKey: 'Columns.Title', width: 24 },
    { key: 'author', labelKey: 'Columns.Author', width: 16 },
    { key: 'year', labelKey: 'Columns.Year', width: 7 },
    { key: 'description', labelKey: 'Columns.Description', width: 10 },
    { key: 'internalNote3', labelKey: 'Columns.InternalNote3', width: 16 }
  ];

  selectedColumns: Record<OutputColumnKey, boolean> = {
    callNumber: true,
    accessionNumber: true,
    mmsId: true,
    barcode: true,
    title: true,
    author: true,
    year: true,
    description: true,
    internalNote3: true
  };

  sortKey: OutputColumnKey = 'accessionNumber';

  loadingLibraries = false;
  loadingLocations = false;
  loading = false;
  creatingPrint = false;

  progressMessage = '';
  resultMessage = '';
  warningMessage = '';
  errorMessage = '';

  private almaUrl = '';
  private instCode = '';
  private sruBaseUrl = '';
  private sruConfig: SruConfig = {
    sruUrl: '',
    username: '',
    password: '',
    headerLabelCs: 'Knihovna',
    headerLabelEn: 'Library'
  };
  private sruIndexes: SruIndexes | null = null;

  private readonly sruPageSize = 100;
  private readonly sruMaxRecords = 10000;
  private readonly itemPageSize = 100;

  constructor(
    private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private configService: CloudAppConfigService,
    private http: HttpClient,
    private translate: TranslateService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    this.loadingLibraries = true;
    this.errorMessage = '';

    try {
      const init: any = await firstValueFrom(this.eventsService.getInitData());
      this.instCode = String(init?.instCode || '').trim();
      this.almaUrl = String(init?.urls?.alma || '').trim();

      if (!this.instCode || !this.almaUrl) {
        throw new Error(this.t('Errors.Init'));
      }

      const defaultSruUrl = new URL(
        `/view/sru/${encodeURIComponent(this.instCode)}`,
        this.almaUrl
      ).toString();

      const storedConfig = await firstValueFrom(this.configService.get());
      this.sruConfig = normalizeSruConfig(storedConfig);
      this.sruBaseUrl = this.resolveSruBaseUrl(
        this.sruConfig.sruUrl,
        defaultSruUrl
      );

      await this.loadLibraries();
    } catch (e: any) {
      this.errorMessage = e?.message || this.t('Errors.Init');
    } finally {
      this.loadingLibraries = false;
    }
  }

  async loadLibraries(): Promise<void> {
    const result: AlmaLibrary[] = [];
    let offset = 0;

    try {
      while (true) {
        const response: any = await firstValueFrom(
          this.restService.call(`/conf/libraries?limit=100&offset=${offset}&format=json`)
        );

        const rows = this.arrayOf(response?.library ?? response?.libraries?.library);
        for (const row of rows) {
          const code = String(row?.code || '').trim();
          if (!code) continue;

          result.push({
            code,
            id: String(row?.id || code).trim(),
            name: String(row?.name || row?.desc || code).trim()
          });
        }

        const total = Number(response?.total_record_count ?? result.length);
        if (rows.length < 100 || result.length >= total) break;
        offset += rows.length;
      }

      this.libraries = result.sort((a, b) =>
        a.name.localeCompare(b.name, this.currentLang(), {
          numeric: true,
          sensitivity: 'base'
        })
      );
    } catch {
      throw new Error(this.t('Errors.Libraries'));
    }
  }

  async onLibraryChange(): Promise<void> {
    this.locations = [];
    this.selectedLocationCode = '';
    this.items = [];
    this.resultMessage = '';
    this.warningMessage = '';
    this.errorMessage = '';

    if (!this.selectedLibraryCode) return;

    this.loadingLocations = true;

    try {
      const response: any = await firstValueFrom(
        this.restService.call(
          `/conf/libraries/${encodeURIComponent(this.selectedLibraryCode)}/locations?format=json`
        )
      );

      const rows = this.arrayOf(response?.location ?? response?.locations?.location);
      this.locations = rows
        .map((row: any) => {
          const code = String(row?.code || '').trim();
          const externalName = String(row?.external_name || '').trim();
          const name = externalName || String(row?.name || row?.desc || code).trim();
          return {
            code,
            id: String(row?.id || code).trim(),
            name
          } as AlmaLocation;
        })
        .filter((x: AlmaLocation) => !!x.code)
        .sort((a: AlmaLocation, b: AlmaLocation) => {
          const byCode = a.code.localeCompare(b.code, this.currentLang(), {
            numeric: true,
            sensitivity: 'base'
          });
          if (byCode !== 0) return byCode;

          return a.name.localeCompare(b.name, this.currentLang(), {
            numeric: true,
            sensitivity: 'base'
          });
        });
    } catch {
      this.errorMessage = this.t('Errors.Locations');
    } finally {
      this.loadingLocations = false;
    }
  }

  async loadItems(): Promise<void> {
    if (!this.selectedLibraryCode || !this.selectedLocationCode) {
      this.errorMessage = this.t('Errors.SelectBoth');
      return;
    }

    const hasUsername = !!this.sruConfig.username;
    const hasPassword = !!this.sruConfig.password;
    if (hasUsername !== hasPassword) {
      this.errorMessage = this.t('Errors.SruCredentialsIncomplete');
      return;
    }

    this.loading = true;
    this.items = [];
    this.errorMessage = '';
    this.warningMessage = '';
    this.resultMessage = '';
    this.progressMessage = '';

    try {
      if (!this.sruIndexes) {
        this.sruIndexes = await this.discoverSruIndexes();
      }

      const library = this.selectedLibrary;
      const location = this.selectedLocation;
      if (!library || !location) {
        throw new Error(this.t('Errors.SelectBoth'));
      }

      // SRU is used only to obtain the bibliographic records which have at least
      // one item in the selected physical location. The final library + location
      // filter is deliberately applied to the item data returned by Alma REST.
      // This mirrors Alma's Physical Items search: one bibliographic record may
      // contain several matching physical items.
      const mmsIds = await this.searchMmsIds(location);

      if (!mmsIds.length) {
        this.resultMessage = this.t('Main.NoItems');
        return;
      }

      const allItems: ListItem[] = [];
      let completed = 0;

      const groups = this.chunk(mmsIds, 8);
      for (const group of groups) {
        const results = await Promise.all(
          group.map(mmsId => this.loadItemsForBib(mmsId))
        );

        for (const rows of results) {
          allItems.push(...rows);
        }

        completed += group.length;
        this.progressMessage = this.t('Main.ItemsProgress', {
          current: Math.min(completed, mmsIds.length),
          total: mmsIds.length
        });
      }

      this.items = allItems;
      this.sortItems();

      this.progressMessage = '';
      this.resultMessage = this.items.length
        ? this.t('Main.CountWithTitles', {
            count: this.items.length,
            titles: mmsIds.length
          })
        : this.t('Main.NoItems');

    } catch (e: any) {
      this.progressMessage = '';
      this.errorMessage = e?.message || this.t('Errors.Items');
    } finally {
      this.loading = false;
    }
  }

  private async discoverSruIndexes(): Promise<SruIndexes> {
    let xmlText = '';

    try {
      const url = this.buildSruUrl({
        version: '1.2',
        operation: 'explain'
      });
      xmlText = await this.getSruText(url);
    } catch {
      throw new Error(this.t('Errors.SruUnavailable'));
    }

    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error(this.t('Errors.SruUnavailable'));
    }

    const candidates: Array<{ name: string; title: string }> = [];
    const indexElements = Array.from(doc.getElementsByTagNameNS('*', 'index'));

    for (const indexEl of indexElements) {
      const title = Array.from(indexEl.getElementsByTagNameNS('*', 'title'))
        .map(x => (x.textContent || '').trim())
        .filter(Boolean)
        .join(' ');

      for (const nameEl of Array.from(indexEl.getElementsByTagNameNS('*', 'name'))) {
        const rawName = (nameEl.textContent || '').trim();
        if (!rawName) continue;
        const set = (nameEl.getAttribute('set') || '').trim();
        const name = set && !rawName.includes('.') ? `${set}.${rawName}` : rawName;
        candidates.push({ name, title });
      }
    }

    // Prefer Alma's physical-location SRU index when it is exposed by Explain.
    // Keep conservative fallbacks for other Alma environments.
    const preferredNames = [
      'alma.itemPhysicalLocation',
      'alma.itemLocation',
      'alma.item_location'
    ];

    let location: string | null = null;
    for (const preferred of preferredNames) {
      const found = candidates.find(
        c => c.name.toLowerCase() === preferred.toLowerCase()
      );
      if (found) {
        location = found.name;
        break;
      }
    }

    if (!location) {
      const scored = candidates
        .map(c => {
          const name = c.name.toLowerCase();
          const title = c.title.toLowerCase();
          let score = 0;
          if (name.includes('item')) score += 20;
          if (name.includes('physical')) score += 20;
          if (name.includes('location')) score += 20;
          if (title === 'location') score += 30;
          if (title.includes('physical location')) score += 20;
          if (title.includes('temporary')) score -= 40;
          if (title.includes('permanent')) score -= 20;
          if (title.includes('former')) score -= 40;
          if (title.includes('electronic')) score -= 40;
          return { ...c, score };
        })
        .filter(c => c.score >= 50)
        .sort((a, b) => b.score - a.score);

      location = scored[0]?.name || null;
    }

    if (!location) {
      console.warn('SRU indexes returned by Explain:', candidates);
      throw new Error(this.t('Errors.SruIndexes'));
    }

    console.debug('Using SRU physical location index:', location);
    return { location };
  }

  private async searchMmsIds(location: AlmaLocation): Promise<string[]> {
    if (!this.sruIndexes) {
      throw new Error(this.t('Errors.SruIndexes'));
    }

    // Alma's Location configuration API distinguishes the location code from
    // the internal ID. Use the location code for the SRU physical-location query.
    const locationCode = String(location.code || '').trim();
    if (!locationCode) {
      throw new Error(this.t('Errors.SruQuery'));
    }

    console.debug('SRU physical location filter', {
      locationIndex: this.sruIndexes.location,
      locationCode
    });

    return this.executeSruSearch(
      this.sruIndexes.location,
      locationCode
    );
  }

  private async executeSruSearch(
    locationIndex: string,
    locationValue: string
  ): Promise<string[]> {
    const query =
      `${locationIndex} == "${this.escapeCql(locationValue)}"`;

    const mmsIds: string[] = [];
    const seenMmsIds = new Set<string>();
    let startRecord = 1;
    let total = 0;
    let first = true;

    while (first || startRecord <= Math.min(total, this.sruMaxRecords)) {
      const url = this.buildSruUrl({
        version: '1.2',
        operation: 'searchRetrieve',
        recordSchema: 'marcxml',
        query,
        startRecord: String(startRecord),
        maximumRecords: String(this.sruPageSize)
      });

      let text: string;
      try {
        text = await this.getSruText(url);
      } catch {
        throw new Error(this.t('Errors.SruQuery'));
      }

      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) {
        throw new Error(this.t('Errors.SruQuery'));
      }

      const diagnostic = doc.getElementsByTagNameNS('*', 'diagnostic')[0];
      if (diagnostic) {
        const msg =
          diagnostic.getElementsByTagNameNS('*', 'message')[0]?.textContent?.trim() ||
          this.t('Errors.SruQuery');
        throw new Error(msg);
      }

      total = Number(
        doc.getElementsByTagNameNS('*', 'numberOfRecords')[0]?.textContent || 0
      );

      if (first && total > this.sruMaxRecords) {
        this.warningMessage = this.t('Main.SruLimit');
      }
      first = false;

      // IMPORTANT: an SRU response contains an SRU <record> wrapper and, inside
      // <recordData>, another MARC <record>. Searching for every element named
      // "record" therefore counts each result twice and breaks pagination.
      // Use one <recordData> element per SRU result instead. This is also the
      // correct unit for advancing startRecord.
      const recordDataNodes = Array.from(
        doc.getElementsByTagNameNS('*', 'recordData')
      );

      for (const recordData of recordDataNodes) {
        const controls = Array.from(
          recordData.getElementsByTagNameNS('*', 'controlfield')
        );
        const cf001 = controls.find(x => x.getAttribute('tag') === '001');
        const mmsId = (cf001?.textContent || '').trim();
        if (mmsId && !seenMmsIds.has(mmsId)) {
          seenMmsIds.add(mmsId);
          mmsIds.push(mmsId);
        }
      }

      const limit = Math.min(total, this.sruMaxRecords);
      const current = recordDataNodes.length
        ? Math.min(startRecord + recordDataNodes.length - 1, limit)
        : Math.min(startRecord - 1, limit);

      this.progressMessage = this.t('Main.SearchProgress', {
        current,
        total: limit
      });

      if (!recordDataNodes.length || current >= limit) {
        break;
      }

      // Prefer the SRU-provided next position when available. Fall back to the
      // actual number of SRU records returned on this page (not MARC nodes).
      const nextRecordPosition = Number(
        doc.getElementsByTagNameNS('*', 'nextRecordPosition')[0]?.textContent || 0
      );

      if (nextRecordPosition > startRecord && nextRecordPosition <= limit) {
        startRecord = nextRecordPosition;
      } else {
        startRecord += recordDataNodes.length;
      }
    }

    return mmsIds;
  }

  private async loadItemsForBib(mmsId: string): Promise<ListItem[]> {
    const selectedLibrary = this.selectedLibraryCode;
    const selectedLocation = this.selectedLocationCode;
    const result: ListItem[] = [];
    let offset = 0;

    while (true) {
      const response: any = await firstValueFrom(
        this.restService.call(
          `/bibs/${encodeURIComponent(mmsId)}/holdings/ALL/items` +
          `?limit=${this.itemPageSize}&offset=${offset}&format=json`
        )
      );

      const rows = this.arrayOf(response?.item ?? response?.items?.item);

      for (const row of rows) {
        const data = row?.item_data || {};
        const holding = row?.holding_data || {};
        const bib = row?.bib_data || {};

        const libraryCode = this.value(data?.library);
        const locationCode = this.value(data?.location);

        if (
          libraryCode !== selectedLibrary ||
          locationCode !== selectedLocation
        ) {
          continue;
        }

        result.push({
          callNumber: this.firstText(
            holding?.call_number,
            holding?.permanent_call_number,
            data?.alternative_call_number
          ),
          accessionNumber: this.firstText(
            data?.inventory_number,
            holding?.accession_number
          ),
          mmsId,
          barcode: this.firstText(data?.barcode),
          title: this.cleanText(this.firstText(bib?.title)),
          author: this.cleanText(this.firstText(bib?.author)),
          year: this.extractYear(this.firstText(
            bib?.date_of_publication,
            data?.year_of_issue
          )),
          description: this.cleanText(this.firstText(data?.description)),
          internalNote3: this.cleanText(this.firstText(data?.internal_note_3))
        });
      }

      const total = Number(response?.total_record_count ?? 0);
      if (!rows.length || rows.length < this.itemPageSize) break;

      offset += rows.length;
      if (total > 0 && offset >= total) break;
    }

    return result;
  }

  get selectedOutputColumns(): OutputColumn[] {
    return this.outputColumns.filter(column => this.selectedColumns[column.key]);
  }

  get hasSelectedOutputColumns(): boolean {
    return this.selectedOutputColumns.length > 0;
  }

  itemValue(item: ListItem, key: OutputColumnKey): string {
    return item[key] || '';
  }

  onSortChange(): void {
    this.sortItems();
  }

  private sortItems(): void {
    const collator = new Intl.Collator(this.currentLang(), {
      numeric: true,
      sensitivity: 'base'
    });

    const key = this.sortKey;

    this.items.sort((a, b) => {
      const aValue = this.itemValue(a, key).trim();
      const bValue = this.itemValue(b, key).trim();

      // Empty values always go to the end, regardless of the selected field.
      if (!aValue && bValue) return 1;
      if (aValue && !bValue) return -1;

      const primary = collator.compare(aValue, bValue);
      if (primary !== 0) return primary;

      const accession = collator.compare(
        a.accessionNumber || '',
        b.accessionNumber || ''
      );
      if (accession !== 0) return accession;

      return collator.compare(a.barcode || '', b.barcode || '');
    });
  }

  downloadCsv(): void {
    if (!this.items.length || !this.hasSelectedOutputColumns) return;

    try {
      const columns = this.selectedOutputColumns;
      const lines: string[] = [];

      lines.push(
        columns
          .map(column => this.csvCell(this.t(column.labelKey)))
          .join(';')
      );

      for (const item of this.items) {
        lines.push(
          columns
            .map(column => this.csvCell(this.itemValue(item, column.key)))
            .join(';')
        );
      }

      // UTF-8 BOM + semicolon delimiter work well when opening the file
      // directly in Czech/European Microsoft Excel installations.
      const csv = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const libraryCode = this.safeFilePart(
        this.selectedLibrary?.code || this.selectedLibraryCode
      );
      const locationCode = this.safeFilePart(
        this.selectedLocation?.code || this.selectedLocationCode
      );
      const date = new Date().toISOString().slice(0, 10);
      const filename =
        `physical-items-${libraryCode}-${locationCode}-${date}.csv`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.resultMessage = this.t('Main.CsvDownloaded');
    } catch (e: any) {
      console.error(e);
      this.errorMessage = e?.message || this.t('Errors.Csv');
    }
  }

  printOrSavePdf(): void {
    if (!this.items.length || !this.hasSelectedOutputColumns || this.creatingPrint) return;

    this.creatingPrint = true;
    this.errorMessage = '';
    this.resultMessage = '';

    try {
      const printWindow = window.open('', '_blank', 'width=1200,height=900');

      if (!printWindow) {
        throw new Error(this.t('Errors.PopupBlocked'));
      }

      const libraryName = this.selectedLibrary?.name || this.selectedLibraryCode;
      const locationName = this.selectedLocation?.name || this.selectedLocationCode;
      const locationCode = this.selectedLocation?.code || this.selectedLocationCode;
      const headerLabel = this.currentLang() === 'cs'
        ? this.sruConfig.headerLabelCs
        : this.sruConfig.headerLabelEn;
      const locationPart = locationCode
        ? `${locationName} (${locationCode})`
        : locationName;
      const title = `${headerLabel} ${libraryName} – ${locationPart}`;

      const date = new Intl.DateTimeFormat(
        this.currentLang() === 'cs' ? 'cs-CZ' : 'en-GB',
        { day: 'numeric', month: 'numeric', year: 'numeric' }
      ).format(new Date());

      const columns = this.selectedOutputColumns;
      const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);

      const columnStyles = columns.map((column, index) =>
        `th:nth-child(${index + 1}), td:nth-child(${index + 1}) { width: ${(column.width / totalWeight * 100).toFixed(2)}%; }`
      ).join('\n');

      const headers = columns.map(column =>
        `<th>${this.escapeHtml(this.t(column.labelKey))}</th>`
      ).join('');

      const rows = this.items.map(item => `
        <tr>
          ${columns.map(column => {
            const value = this.itemValue(item, column.key);
            return `<td title="${this.escapeHtml(value)}">${this.escapeHtml(value)}</td>`;
          }).join('')}
        </tr>
      `).join('');

      const html = `
<!doctype html>
<html lang="${this.escapeHtml(this.currentLang())}">
<head>
  <meta charset="utf-8">
  <title>${this.escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 9mm 10mm 9mm;
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10mm;
      margin-bottom: 4mm;
    }

    .title {
      min-width: 0;
      font-size: 13pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .date {
      flex: 0 0 auto;
      font-size: 9pt;
      white-space: nowrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 7.6pt;
      line-height: 1.05;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    th {
      text-align: left;
      font-weight: 700;
      border-bottom: 0.4mm solid #222;
      padding: 1.2mm 1.2mm;
      white-space: nowrap;
      overflow: hidden;
    }

    td {
      height: 5.15mm;
      border-bottom: 0.2mm solid #ddd;
      padding: 0.8mm 1.2mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }

    ${columnStyles}

    .screen-only {
      position: sticky;
      top: 0;
      z-index: 10;
      margin: 0 0 6mm;
      text-align: right;
      background: #fff;
    }

    .screen-only button {
      font: inherit;
      font-size: 10pt;
      padding: 7px 18px;
      border: 1px solid #777;
      border-radius: 4px;
      background: #f5f5f5;
      cursor: pointer;
    }

    .screen-only button:hover {
      background: #e9e9e9;
    }

    @media screen {
      body {
        padding: 8mm;
      }
    }

    @media print {
      .screen-only {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="screen-only">
    <button id="print-button" type="button">${this.escapeHtml(this.t('Main.PrintButton'))}</button>
  </div>

  <div class="header">
    <div class="title">${this.escapeHtml(title)}</div>
    <div class="date">${this.escapeHtml(date)}</div>
  </div>

  <table>
    <thead>
      <tr>${headers}</tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      const printButton = printWindow.document.getElementById('print-button');
      if (printButton) {
        printButton.addEventListener('click', () => {
          printWindow.focus();
          printWindow.print();
        });
      }

      setTimeout(() => printWindow.focus(), 150);
      this.resultMessage = this.t('Main.PrintPreviewReady');
    } catch (e: any) {
      console.error(e);
      this.errorMessage = e?.message || this.t('Errors.Print');
    } finally {
      this.creatingPrint = false;
    }
  }

  private async getSruText(url: string): Promise<string> {
    try {
      if (this.sruConfig.username && this.sruConfig.password) {
        /*
         * Authenticated SRU cannot be called directly from a published Cloud App:
         * the browser sends a CORS preflight request and Alma SRU answers it with 401.
         *
         * Use the Ex Libris generic Cloud App proxy instead. The Cloud App JWT
         * authenticates this app to the proxy and X-Proxy-Auth is forwarded to
         * the target SRU endpoint as its Authorization header.
         */
        const target = new URL(url);
        const proxyUrl =
          `https://api.exldevnetwork.net/proxy${target.pathname}${target.search}`;
        const cloudAppToken = await firstValueFrom(
          this.eventsService.getAuthToken()
        );
        const sruAuthorization = this.basicAuthorization(
          this.sruConfig.username,
          this.sruConfig.password
        );

        return await firstValueFrom(
          this.http.get(proxyUrl, {
            responseType: 'text' as const,
            headers: new HttpHeaders({
              'X-Proxy-Host': target.host,
              'Authorization': `Bearer ${cloudAppToken}`,
              'X-Proxy-Auth': sruAuthorization,
              'Accept': 'application/xml,text/xml,*/*'
            })
          })
        );
      }

      // Anonymous SRU can be called directly because Alma SRU provides CORS headers.
      return await firstValueFrom(
        this.http.get(url, {
          responseType: 'text' as const
        })
      );
    } catch (e: any) {
      if (e?.status === 401 || e?.status === 403 || e?.status === 407) {
        throw new Error(this.t('Errors.SruAuth'));
      }
      throw e;
    }
  }

  private basicAuthorization(username: string, password: string): string {
    const value = `${username}:${password}`;
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return `Basic ${btoa(binary)}`;
  }

  private resolveSruBaseUrl(configuredUrl: string, defaultUrl: string): string {
    const value = String(configuredUrl || '').trim();

    if (!value) {
      return defaultUrl;
    }

    if (value.startsWith('/')) {
      return new URL(value, this.almaUrl).toString();
    }

    return value;
  }

  private buildSruUrl(params: Record<string, string>): string {
    const url = new URL(this.sruBaseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private get selectedLibrary(): AlmaLibrary | undefined {
    return this.libraries.find(x => x.code === this.selectedLibraryCode);
  }

  private get selectedLocation(): AlmaLocation | undefined {
    return this.locations.find(x => x.code === this.selectedLocationCode);
  }

  private t(key: string, params?: Record<string, any>): string {
    return this.translate.instant(key, params);
  }

  private currentLang(): string {
    return String(
      this.translate.currentLang || this.translate.defaultLang || 'en'
    ).toLowerCase().split('-')[0];
  }

  private arrayOf(value: any): any[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  private value(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      return String(value.value ?? value.code ?? '').trim();
    }
    return String(value).trim();
  }

  private firstText(...values: any[]): string {
    for (const value of values) {
      const text = this.value(value);
      if (text) return text;
    }
    return '';
  }

  private cleanText(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  private extractYear(value: string): string {
    const text = String(value || '').trim();
    const match = text.match(/(?:1[5-9]\d{2}|20\d{2}|21\d{2})/);
    return match ? match[0] : text;
  }

  private escapeCql(value: string): string {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private csvCell(value: string): string {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${text}"`;
  }

  private safeFilePart(value: string): string {
    return String(value || '')
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'x';
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }
}
