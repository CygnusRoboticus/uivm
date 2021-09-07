import {
  Executable,
  ExecutableDefinition,
  ExecutableDefinitionDefault,
  FuzzyExecutableRegistry,
  isExecutableDefinitionObject,
} from "./executable";
import { BaseItemConfig } from "./primitives";
import { notNullish } from "./utils";

export function getRegistryMethods<TRegistry extends FuzzyExecutableRegistry, TControl, TValue>(
  registry: TRegistry,
  kind: keyof TRegistry,
  defs: readonly (
    | ExecutableDefinition<TRegistry[typeof kind], TValue, any, any>
    | ExecutableDefinitionDefault
    | TValue
  )[],
) {
  return defs
    .map(def => {
      const method = getRegistryMethod<TRegistry, TControl, TValue>(registry, kind, def);
      return method ? { method, def } : null;
    })
    .filter(notNullish);
}

export function getRegistryMethod<TRegistry extends FuzzyExecutableRegistry, TControl, TValue>(
  registry: TRegistry,
  kind: keyof TRegistry,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault | TValue,
): Executable<BaseItemConfig, TControl, any, TValue> | null {
  if (isExecutableDefinitionObject<TValue>(def as ExecutableDefinitionDefault)) {
    const method = (registry[kind] as any)?.[(def as any).name];
    if (method && registry[kind]) {
      return method.bind(registry[kind]);
    }
  } else {
    return () => def as any;
  }
  return null;
}

export function getRegistryValues<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl,
  TValue,
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  defs: readonly (
    | ExecutableDefinition<TRegistry[typeof kind], TValue, any, any>
    | ExecutableDefinitionDefault
    | TValue
  )[],
): TValue[] {
  const methods = getRegistryMethods<TRegistry, TControl, TValue>(registry, kind, defs);
  return methods.map(({ method, def }) => method(config, control, (def as any)?.params));
}

export function getRegistryValue<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl,
  TValue,
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault | TValue,
): TValue | null {
  const method = getRegistryMethod<TRegistry, TControl, TValue>(registry, kind, def);
  return method ? method(config, control, (def as any)?.params) : null;
}
