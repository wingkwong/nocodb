import type { XcForm } from '~/types/nc-plugin';

import type XcPlugin from './XcPlugin';
import type XcPluginMigration from './XcPluginMigration';

export interface XcPluginDoc{
  title: string;
  url: string;
}

export default interface XcPluginConfig {
  title: string;
  logo?: string;
  tags?: string;
  description?: string;
  version: string;
  category?: string;
  permissions?: string[];
  inputs?: XcForm;
  price?: string;
  builder: Constructor<any>;
  migrations?: XcPluginMigration[];
  msgOnInstall?: string;
  msgOnUninstall?: string;
  docs?: XcPluginDoc[];
}

type Constructor<T extends XcPlugin> = {
  new (...args: any[]): T;
};
