import { FieldDataTypeDefinition } from "./typing";

export interface BaseItemConfig {
  type: string;
}

export interface BaseFieldConfig extends BaseItemConfig {
  name: string;
  dataType?: FieldDataTypeDefinition;
}

export interface BaseGroupConfig<TConfigs extends BaseItemConfig> extends BaseItemConfig {
  fields: readonly TConfigs[];
}

export interface BaseArrayConfig<TConfigs extends BaseItemConfig> extends BaseFieldConfig {
  array: true;
  fields: BaseGroupConfig<TConfigs> & TConfigs;
}
