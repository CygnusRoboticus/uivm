import { ItemControl } from "./controls";
import { AbstractExtras, AbstractHints } from "./controls.types";
import { Executable, ExecutableDefinition, ExecutableDefinitionDefault, FuzzyExecutableRegistry } from "./executable";
import { BaseItemConfig } from "./primitives";
import { notNullish } from "./utils";

export function getRegistryMethods<
  TRegistry extends FuzzyExecutableRegistry,
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  defs: readonly (ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault)[],
) {
  return defs
    .map(def => {
      const method = getRegistryMethod<TRegistry, TValue, THints, TExtras>(registry, kind, def);
      return method ? { method, def } : null;
    })
    .filter(notNullish);
}

export function getRegistryMethod<
  TRegistry extends FuzzyExecutableRegistry,
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault,
): Executable<BaseItemConfig, ItemControl<THints, TExtras>, any, TValue, THints, TExtras> | null {
  const method = (registry[kind] as any)?.[def.name];
  if (method && registry[kind]) {
    return method.bind(registry[kind]);
  }
  return null;
}

export function getRegistryValues<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  defs: readonly (ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault)[],
): TValue[] {
  const methods = getRegistryMethods<TRegistry, TValue, THints, TExtras>(registry, kind, defs);
  return methods.map(({ method, def }) => method(config, control, (def as any).params));
}

export function getRegistryValue<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints, TExtras>,
  TValue,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue, any, any> | ExecutableDefinitionDefault,
): TValue | null {
  const method = getRegistryMethod<TRegistry, TValue, THints, TExtras>(registry, kind, def);
  return method ? method(config, control, (def as any).params) : null;
}
