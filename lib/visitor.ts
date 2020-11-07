import { first, map } from "rxjs/operators";
import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl, KeyValueControls } from "./controls";
import { AbstractHints, Disabler, Hinter, ObservableExecutor, Trigger, Validator } from "./controls.types";
import { Executable, ExecutableDefinition, FuzzyExecutableRegistry, SearchResolver } from "./executable";
import { BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldTypeMap, FormControls, FormValue } from "./typing";
import { isArrayConfig, isFieldConfig, isGroupConfig, notNullish, toObservable } from "./utils";
import { array as AR } from "fp-ts";
import { combineLatest } from "rxjs";

export interface Visitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
> {
  itemInit: (config: ItemConfig<TRegistry, THints> & TConfig, children: ItemControl<THints>[]) => ItemControl<THints>;
  fieldInit: (config: FieldConfig<TRegistry, THints> & TConfig) => FieldControl<{}, THints>;
  groupInit: (
    config: GroupConfig<TConfig, TRegistry, THints> & TConfig,
    bundled: KeyValueControls<{}, THints>,
    children: ItemControl<THints>[],
  ) => GroupControl<{}, {}, THints>;
  arrayInit: (
    config: ArrayConfig<TConfig, TRegistry, THints> & TConfig,
    bundled: KeyValueControls<{}, THints>,
  ) => ArrayControl<{}, {}, THints>;

  itemComplete: (
    control: ItemControl<THints>,
    config: ItemConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) => void;
  fieldComplete: (
    control: FieldControl<TRegistry, THints>,
    config: FieldConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) => void;
  groupComplete: (
    control: GroupControl<{}, {}, THints>,
    config: GroupConfig<TConfig, TRegistry, THints> & FieldConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) => void;
  arrayComplete: (
    control: ArrayControl<{}, {}, THints>,
    config: ArrayConfig<TConfig, TRegistry, THints>,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) => void;
}

class DefaultVisitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
> implements Visitor<TConfig, TRegistry, THints> {
  itemInit(config: ItemConfig<TRegistry, THints> & TConfig) {
    return new ItemControl<THints>();
  }
  fieldInit(config: FieldConfig<TRegistry, THints> & TConfig) {
    return new FieldControl<any, THints>(null);
  }
  groupInit(config: GroupConfig<TConfig, TRegistry, THints> & TConfig, bundled: KeyValueControls<{}, THints>) {
    return new GroupControl<{}, {}, THints>(bundled);
  }
  arrayInit(config: ArrayConfig<TConfig, TRegistry, THints> & TConfig, bundled: KeyValueControls<{}, THints>) {
    return new ArrayControl<{}, {}, THints>(() => new GroupControl<{}, {}, THints>(bundled));
  }

  itemComplete(
    control: ItemControl<THints>,
    config: ItemConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) {
    this.initItem(control, parent, config, registry);
  }
  fieldComplete(
    control: FieldControl<TRegistry, THints>,
    config: FieldConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }
  groupComplete(
    control: GroupControl<{}, {}, THints>,
    config: GroupConfig<TConfig, TRegistry, THints> & FieldConfig<TRegistry, THints> & TConfig,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }
  arrayComplete(
    control: ArrayControl<{}, {}, THints>,
    config: ArrayConfig<TConfig, TRegistry, THints>,
    parent: GroupControl<{}, {}, THints> | null,
    root: GroupControl<{}, {}, THints>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }

  initItem(
    control: ItemControl<THints>,
    parent: GroupControl<{}, {}, THints> | null,
    config: ItemConfig<TRegistry, THints>,
    registry: TRegistry,
  ) {
    const hints = Object.entries(config.hints ?? {}).reduce((acc, [key, value]) => {
      const sources = getRegistryValues<
        typeof registry,
        typeof config,
        typeof control,
        ObservableExecutor<typeof control, boolean>,
        THints
      >(registry, "hints", config, control, value as any).map(s => (c: ItemControl<THints>) =>
        toObservable(s(c)).pipe(map(v => [key, v] as [keyof THints, boolean])),
      );
      acc.push(...sources);
      return acc;
    }, <Hinter<ItemControl<THints>, THints>[]>[]);

    const messages = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Validator<typeof control>,
      THints
    >(registry, "messagers", config, control, (config.messagers ?? []) as any);

    control.setHinters(hints);
    control.setMessagers(messages);

    if (!control.parent && parent) {
      control.setParent(parent);
    }
  }

  initField(
    control: FieldControl<any, THints>,
    parent: GroupControl<{}, {}, THints> | null,
    config: FieldConfig<TRegistry, THints>,
    registry: TRegistry,
  ) {
    this.initItem(control, parent, config, registry);

    const disablers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Disabler<typeof control>,
      THints
    >(registry, "hints", config, control, config.disablers ?? ([] as any));

    const validators = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Validator<typeof control>,
      THints
    >(registry, "validators", config, control, config.validators ?? ([] as any));

    const triggers = getRegistryValues<typeof registry, typeof config, typeof control, Trigger<typeof control>, THints>(
      registry,
      "triggers",
      config,
      control,
      config.triggers ?? ([] as any),
    );

    control.setDisablers(disablers);
    control.setTriggers(triggers);
    control.setValidators(validators);
  }
}

export interface ConfigBundle<
  T extends TConfig,
  TControl extends ItemControl<THints>,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints
> {
  id: string;
  registry: TRegistry;
  control: TControl;
  config: T;
  children: ConfigBundle<TConfig, ItemControl<THints>, TConfig, TRegistry, THints>[];
}

export function bundleConfig<
  T extends TConfig & BaseGroupConfig<TConfig>,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
>(
  config: T,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, THints> = new DefaultVisitor<TConfig, TRegistry, THints>(),
) {
  const bundle = bundleConfig2<
    GroupControl<
      // @ts-ignore
      FormValue<T["fields"], TConfig, TTypes>,
      FormControls<T["fields"], TConfig, TTypes, THints>,
      THints
    >,
    TConfig,
    TRegistry,
    THints
  >(config.type, config, registry, visitor);
  completeConfig2(bundle, null, bundle, registry, visitor);
  return bundle;
}

export function getRegistryMethods<
  TRegistry extends FuzzyExecutableRegistry,
  TValue,
  THints extends AbstractHints = AbstractHints
>(registry: TRegistry, kind: keyof TRegistry, defs: readonly ExecutableDefinition<TRegistry[typeof kind], TValue>[]) {
  return defs
    .map(def => {
      const method = getRegistryMethod<TRegistry, TValue, THints>(registry, kind, def);
      return method ? { method, def } : null;
    })
    .filter(notNullish);
}

export function getRegistryMethod<
  TRegistry extends FuzzyExecutableRegistry,
  TValue,
  THints extends AbstractHints = AbstractHints
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue>,
): Executable<BaseItemConfig, ItemControl<THints>, any, TValue, THints> | null {
  const method = (registry[kind] as any)?.[def.name];
  if (method && registry[kind]) {
    return method.bind(registry[kind]);
  }
  return null;
}

export function getRegistryValues<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints>,
  TValue,
  THints extends AbstractHints = AbstractHints
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  defs: readonly ExecutableDefinition<TRegistry[typeof kind], TValue>[],
): TValue[] {
  const methods = getRegistryMethods<TRegistry, TValue, THints>(registry, kind, defs);
  return methods.map(({ method, def }) => method(config, control, (def as any).params));
}

export function getRegistryValue<
  TRegistry extends FuzzyExecutableRegistry,
  TConfig extends BaseItemConfig,
  TControl extends ItemControl<THints>,
  TValue,
  THints extends AbstractHints = AbstractHints
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  config: TConfig,
  control: TControl,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue>,
): TValue | null {
  const method = getRegistryMethod<TRegistry, TValue, THints>(registry, kind, def);
  return method ? method(config, control, (def as any).params) : null;
}

function completeConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
>(
  bundle: ConfigBundle<TConfig, ItemControl<THints>, TConfig, TRegistry, THints>,
  parentBundle: ConfigBundle<TConfig, GroupControl<any, any, THints>, TConfig, TRegistry, THints> | null,
  rootBundle: ConfigBundle<TConfig, GroupControl<any, any, THints>, TConfig, TRegistry, THints>,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, THints>,
) {
  const { config, control, children } = bundle;
  children.forEach(c =>
    completeConfig2(
      c,
      bundle as ConfigBundle<TConfig, GroupControl<any, any, THints>, TConfig, TRegistry, THints>,
      rootBundle,
      registry,
      visitor,
    ),
  );

  if (isFieldConfig<TConfig>(config)) {
    if (isArrayConfig<TConfig>(config) && control instanceof FieldControl) {
      visitor.arrayComplete(control as any, config as any, parentBundle?.control ?? null, rootBundle.control, registry);
    } else if (isGroupConfig<TConfig>(config) && control instanceof GroupControl) {
      visitor.groupComplete(control, config as any, parentBundle?.control ?? null, rootBundle.control, registry);
    } else if (control instanceof FieldControl) {
      visitor.fieldComplete(control, config as any, parentBundle?.control ?? null, rootBundle.control, registry);
    }
  }
  visitor.itemComplete(control, config as any, parentBundle?.control ?? null, rootBundle.control, registry);
}

function bundleConfig2<
  TControl extends ItemControl<THints>,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints
>(
  id: string,
  config: TConfig,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, THints>,
): ConfigBundle<TConfig, TControl, TConfig, TRegistry, THints> {
  if (isGroupConfig<TConfig>(config)) {
    const items = config.fields.map((f, i) => {
      if (isFieldConfig<TConfig>(f)) {
        const bundle = bundleConfig2<ItemControl<THints>, TConfig, TRegistry, THints>(
          `${id}-${f.name}`,
          f,
          registry,
          visitor,
        );
        return { controls: { [f.name]: bundle.control }, config: f, items: [bundle] };
      } else if (isGroupConfig<TConfig>(f)) {
        const bundle = bundleConfig2<ItemControl<THints>, TConfig, TRegistry, THints>(
          `${id}-${i}`,
          { ...f, name: "group" },
          registry,
          visitor,
        );
        return {
          controls: {
            ...(bundle.control as GroupControl<{}, {}, THints>).controls,
          },
          config: f,
          items: [bundle],
        };
      }
      const bundle = bundleConfig2<ItemControl<THints>, TConfig, TRegistry, THints>(`${id}-${i}`, f, registry, visitor);
      return { controls: {}, config: f, items: [bundle] };
    });

    const controls = items.reduce((acc, f) => ({ ...acc, ...f.controls }), {});
    const children = items.reduce((acc, f) => [...acc, ...f.items], <typeof items[0]["items"]>[]);

    if (isArrayConfig<TConfig>(config)) {
      const control = visitor.arrayInit(config as any, controls);
      return {
        id: `${id}-${config.name}`,
        registry,
        config,
        control: control as any,
        children,
      };
    } else if (isFieldConfig<TConfig>(config)) {
      const control = visitor.groupInit(
        config as any,
        controls,
        children.map(c => c.control),
      );
      return {
        id: `${id}-${config.name}`,
        registry,
        config,
        control: control as any,
        children,
      };
    } else {
      const control = visitor.itemInit(
        config as any,
        children.map(c => c.control),
      );
      return {
        id: `${id}-${config.type}`,
        registry,
        config,
        control: control as any,
        children,
      };
    }
  } else if (isFieldConfig<TConfig>(config)) {
    const control = visitor.fieldInit(config as any);
    return {
      id: `${id}-${config.name}`,
      registry,
      config,
      control: control as any,
      children: [],
    };
  }

  const control = visitor.itemInit(config as any, []);
  return {
    id: `${id}-${config.type}`,
    registry,
    config,
    control: control as any,
    children: [],
  };
}
