import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";

export function notNullish<T>(value: T | null | undefined): value is T {
  return !!value;
}

export function isPromise<T>(value: any): value is Promise<T> {
  return value && typeof value.then === "function";
}

export function isFieldConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseFieldConfig & TConfig {
  return config && !!(config as any).name;
}
export function isGroupConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseGroupConfig<TConfig> & TConfig {
  return config && !!(config as any).fields;
}
export function isArrayConfig<TConfig extends BaseItemConfig>(
  config: BaseItemConfig,
): config is BaseArrayConfig<TConfig> & TConfig {
  return isGroupConfig<TConfig>(config) && (config as any).array;
}
