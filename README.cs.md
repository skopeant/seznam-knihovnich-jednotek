# Seznam knihovních jednotek

[English](README.md) | [Česky](README.cs.md)

Seznam knihovních jednotek je Ex Libris Alma Cloud App, která načte fyzické jednotky z vybrané dílčí knihovny a fyzické lokace a otevře kompaktní tiskový výstup A4 na šířku. Ten lze přímo vytisknout nebo v prohlížeči uložit jako textové PDF.

## Výstup

Uživatel si může vybrat, které údaje budou zobrazeny v náhledu a v tiskovém/PDF výstupu. Ve výchozím stavu jsou vybrány všechny:

- Signatura
- Přírůstkové číslo
- MMS ID
- Čárový kód
- Název
- Autor
- Rok
- Popis
- Poznámka (Internal Note 3)

Dílčí knihovna a lokace slouží jako filtry a nejsou samostatnými sloupci výstupu. Vybraná knihovna a lokace včetně kódu lokace se zobrazí v záhlaví tisku.

Výchozí řazení je podle přírůstkového čísla. Uživatel může zvolit jiné pole. Záznamy bez hodnoty v právě zvoleném řadicím poli se zařadí na konec.

Dlouhé hodnoty se nezalamují. Zůstanou v jednom řádku a při nedostatku místa se vizuálně zkrátí pomocí výpustky (`…`).

## Zdroje dat

Aplikace **nepoužívá Alma Analytics**.

Používá:
- `GET /almaws/v1/conf/libraries` pro číselník dílčích knihoven
- `GET /almaws/v1/conf/libraries/{libraryCode}/locations` pro číselník lokací
- Alma SRU pro nalezení bibliografických záznamů s jednotkami ve vybrané knihovně/lokaci
- `GET /almaws/v1/bibs/{mms_id}/holdings/ALL/items` pro načtení konkrétních knihovních jednotek

Lokace ve výběru se řadí nejprve přirozeně podle kódu lokace a při shodě podle názvu.

## Požadavek na SRU a konfigurace

Instituce musí mít aktivní Alma SRU integration profile.

Aplikace automaticky odvodí standardní SRU adresu z aktuálního prostředí Almy:

`/view/sru/<institution-code>`

Pole pro vlastní SRU adresu přijímá:
- celou URL, například `https://alma.example.edu/view/sru/INSTITUTION_CODE`
- pouze cestu, například `/view/sru/INSTITUTION_CODE`

Pokud je pole prázdné, použije se standardní SRU adresa odvozená z aktuálního prostředí Almy.

Přihlášení k SRU je volitelné:
- pro anonymní SRU ponechte uživatelské jméno a heslo prázdné
- pokud SRU vyžaduje HTTP Basic Authentication, vyplňte obě hodnoty

V centrální konfiguraci lze také nastavit český a anglický prefix záhlaví tisku. Výchozí hodnoty jsou `Knihovna` / `Library`; každá instituce je může nahradit vlastními, například `ČVUT` / `CTU`.

Nastavení se ukládá pomocí Alma `CloudAppConfigService` jako centrální konfigurace Cloud App pro instituci.

Aplikace načte SRU `explain` a sama vyhledá indexy Item Library a Item Location.

Alma SRU omezuje jeden dotaz na maximálně 10 000 bibliografických záznamů. Při dosažení limitu aplikace zobrazí upozornění.

## Jazyky

- čeština (`cs`)
- angličtina (`en`) — fallback

Rozhraní a záhlaví tisku se řídí jazykem aktuální relace Almy.

## Bezpečnost

- pouze čtení
- bez vloženého Alma API klíče
- bez Analytics
- bez externí databáze
- aplikace data v Almě nemění

## Lokální vývoj

```text
eca init
eca start
```

Kontrola produkčního buildu:

```text
eca build
```

`config.json`, `node_modules`, `.ng`, `build` a `dist` jsou ignorovány Gitem.

## Autor

Antonín Skopec

## Licence

MIT License.

## Verze

1.1.0


### Autentizované SRU

Anonymní Alma SRU se volá přímo. Pokud je v konfiguraci vyplněno SRU jméno a heslo, aplikace používá Ex Libris generic Cloud App proxy (`api.exldevnetwork.net/proxy`) s Cloud App JWT a hlavičkou `X-Proxy-Auth`, aby se obešel problém prohlížeče s CORS preflightem.

Pro test je název aplikace v obou jazycích dvojjazyčný: **Seznam knihovních jednotek – Physical Items List**.

Cíl proxy se posílá v `X-Proxy-Host` pouze jako název hostitele (bez `https://`).


### Verze 1.1.0

Autentizované SRU požadavky v publikované Cloud App používají Ex Libris generic proxy s Cloud App JWT a hlavičkou `X-Proxy-Auth`. Anonymní SRU se nadále volá přímo. SRU nyní načítá 100 záznamů na stránku, aby se snížil počet průchodů přes proxy.

Název aplikace je v obou jazycích Almy dvojjazyčný: **Seznam knihovních jednotek – Physical Items List**.
