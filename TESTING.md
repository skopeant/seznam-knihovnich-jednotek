# Test checklist

## Build
- [ ] `eca build` completes without errors.
- [ ] `eca start` opens the Cloud App.

## Czech
- [ ] Czech Alma session shows Czech interface.
- [ ] Library list loads.
- [ ] Locations change after selecting another library.
- [ ] Selecting a library + location loads items.
- [ ] Preview shows one item per row.
- [ ] Long title/author stays on one row and is truncated.
- [ ] PDF is A4 landscape.
- [ ] PDF headings: SIGNATURA, PŘÍRŮSTKOVÉ ČÍSLO, ČÁROVÝ KÓD, TITUL, AUTOR, ROK.

## English
- [ ] English Alma session shows English interface.
- [ ] PDF headings are English.

## Data
- [ ] Call number matches Alma.
- [ ] Inventory/inventory number matches Alma `inventory_number`.
- [ ] Barcode matches Alma.
- [ ] Title matches Alma.
- [ ] Author matches Alma.
- [ ] Year matches Alma bibliographic publication date.
- [ ] Only items from the selected library/location are included.
- [ ] Sorting by call number is acceptable.

## SRU
- [ ] Institution has an active SRU integration profile.
- [ ] SRU Explain exposes Item Library and Item Location indexes.

## SRU authentication
- [ ] Open Cloud App configuration.
- [ ] Save SRU URL, username and password.
- [ ] Standard Alma SRU URL can be inserted with the default-URL button.
- [ ] Valid credentials allow SRU Explain and searchRetrieve.
- [ ] Invalid credentials produce a localized authentication error.
- [ ] Czech and English configuration pages are localized.
