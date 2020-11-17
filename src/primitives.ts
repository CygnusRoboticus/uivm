import { FieldDataTypeDefinition } from "./typing";

export interface BaseItemConfig {
  type: string;
}

export interface BaseFieldConfig extends BaseItemConfig {
  name: string;
  dataType?: FieldDataTypeDefinition;
}

export interface BaseGroupConfig<TConfig extends BaseItemConfig> extends BaseItemConfig {
  fields: readonly TConfig[];
}

export interface BaseArrayConfig<TConfig extends BaseItemConfig> extends BaseGroupConfig<TConfig>, BaseFieldConfig {
  array: true;
}