import { Component, OnInit } from '@angular/core';
import { CloudAppConfigService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SRU_CONFIG,
  SruConfig,
  normalizeSruConfig
} from '../sru-config';

@Component({
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss']
})
export class ConfigComponent implements OnInit {
  config: SruConfig = { ...DEFAULT_SRU_CONFIG };

  loading = true;
  saved = false;
  error = '';

  constructor(
    private configService: CloudAppConfigService,
    private translate: TranslateService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const stored = await firstValueFrom(this.configService.get());
      this.config = normalizeSruConfig(stored);
    } catch (e: any) {
      this.error = e?.message || this.t('Config.Errors.Load');
    } finally {
      this.loading = false;
    }
  }

  async save(): Promise<void> {
    this.error = '';
    this.saved = false;

    try {
      this.config = normalizeSruConfig(this.config);
      await firstValueFrom(this.configService.set(this.config));
      this.saved = true;
      setTimeout(() => this.saved = false, 2500);
    } catch (e: any) {
      this.error = e?.message || this.t('Config.Errors.Save');
    }
  }

  private t(key: string): string {
    return this.translate.instant(key);
  }
}
