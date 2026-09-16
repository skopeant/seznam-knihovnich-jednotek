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
  library: string;
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

      const mmsIds = await this.searchMmsIds(library, location);

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
        ? this.t('Main.Count', { count: this.items.length })
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

    const byScore = (
      tokens: string[],
      fallbacks: string[]
    ): string | null => {
      const scored = candidates.map(c => {
        const blob = `${c.name} ${c.title}`.toLowerCase().replace(/[^a-z0-9]/g, '');
        let score = 0;
        for (const token of tokens) {
          if (blob.includes(token)) score += 10;
        }
        if (blob.includes('item')) score += 5;
        return { ...c, score };
      }).filter(x => x.score >= 25)
        .sort((a, b) => b.score - a.score);

      if (scored.length) return scored[0].name;

      for (const fallback of fallbacks) {
        const found = candidates.find(
          c => c.name.toLowerCase() === fallback.toLowerCase()
        );
        if (found) return found.name;
      }
      return null;
    };

    const library = byScore(
      ['item', 'library'],
      ['alma.itemLibrary', 'alma.item_library']
    );
    const location = byScore(
      ['item', 'location'],
      ['alma.itemLocation', 'alma.item_location']
    );

    if (!library || !location) {
      console.warn('SRU indexes returned by Explain:', candidates);
      throw new Error(this.t('Errors.SruIndexes'));
    }

    return { library, location };
  }

  private async searchMmsIds(
    library: AlmaLibrary,
    location: AlmaLocation
  ): Promise<string[]> {
    if (!this.sruIndexes) {
      throw new Error(this.t('Errors.SruIndexes'));
    }

    // Ex Libris documents that library search indexes use the library ID.
    // Location ID is attempted first as well. If a particular institution's
    // SRU configuration expects codes instead, the fallback query handles it.
    // Alma documents that library indexes use the library ID.
    // For locations, the Configuration API explicitly says the location CODE
    // should be used in subsequent queries. Try that documented combination first.
    const valuePairs = [
      { library: library.id, location: location.code },
      { library: library.id, location: location.id },
      { library: library.code, location: location.code },
      { library: library.code, location: location.id }
    ].filter((x, i, arr) =>
      arr.findIndex(y => y.library === x.library && y.location === x.location) === i
    );

    let lastError: any = null;
    let successfulQuery = false;

    for (const values of valuePairs) {
      try {
        console.debug('SRU item filter attempt', {
          libraryIndex: this.sruIndexes.library,
          locationIndex: this.sruIndexes.location,
          libraryValue: values.library,
          locationValue: values.location
        });

        const ids = await this.executeSruSearch(
          this.sruIndexes.library,
          this.sruIndexes.location,
          values.library,
          values.location
        );

        successfulQuery = true;

        // A syntactically valid SRU query can return zero records even when
        // a different ID/code representation is required. Do not stop at the
        // first empty result; try the remaining documented/fallback variants.
        if (ids.length > 0) {
          return ids;
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (successfulQuery) {
      return [];
    }

    throw lastError || new Error(this.t('Errors.SruQuery'));
  }

  private async executeSruSearch(
    libraryIndex: string,
    locationIndex: string,
    libraryValue: string,
    locationValue: string
  ): Promise<string[]> {
    const query =
      `${libraryIndex} == "${this.escapeCql(libraryValue)}" and ` +
      `${locationIndex} == "${this.escapeCql(locationValue)}"`;

    const mmsIds: string[] = [];
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

      const records = Array.from(doc.getElementsByTagNameNS('*', 'record'));
      let foundThisPage = 0;

      for (const record of records) {
        const controls = Array.from(record.getElementsByTagNameNS('*', 'controlfield'));
        const cf001 = controls.find(x => x.getAttribute('tag') === '001');
        const mmsId = (cf001?.textContent || '').trim();
        if (mmsId && !mmsIds.includes(mmsId)) {
          mmsIds.push(mmsId);
          foundThisPage++;
        }
      }

      this.progressMessage = this.t('Main.SearchProgress', {
        current: Math.min(startRecord + records.length - 1, Math.min(total, this.sruMaxRecords)),
        total: Math.min(total, this.sruMaxRecords)
      });

      if (!records.length || startRecord + records.length > Math.min(total, this.sruMaxRecords)) {
        break;
      }

      startRecord += records.length;
      if (foundThisPage === 0 && records.length === 0) break;
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
    <button type="button" onclick="window.print()">${this.escapeHtml(this.t('Main.PrintButton'))}</button>
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
