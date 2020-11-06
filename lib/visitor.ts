import { map } from "rxjs/operators";
import { AbstractFlags, ArrayConfig, FieldConfig, GroupConfig, ItemConfig, Messages } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl, KeyValueControls } from "./controls";
import { Executable, ExecutableDefinition, ExecutableRegistry, ObservableExecutor } from "./executable";
import { BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldTypeMap, FormControls, FormValue } from "./typing";
import { isArrayConfig, isFieldConfig, isGroupConfig, notNullish, toObservable } from "./utils";

export interface Visitor<
  TConfig extends BaseItemConfig,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
> {
  itemInit: (config: ItemConfig<TRegistry, TFlags> & TConfig, children: ItemControl<TFlags>[]) => ItemControl<TFlags>;
  fieldInit: (config: FieldConfig<TRegistry, TFlags> & TConfig) => FieldControl<{}, TFlags>;
  groupInit: (
    config: GroupConfig<TConfig, TRegistry, TFlags> & TConfig,
    bundled: KeyValueControls<{}, TFlags>,
    children: ItemControl<TFlags>[],
  ) => GroupControl<{}, {}, TFlags>;
  arrayInit: (
    config: ArrayConfig<TConfig, TRegistry, TFlags> & TConfig,
    bundled: KeyValueControls<{}, TFlags>,
  ) => ArrayControl<{}, {}, TFlags>;

  itemComplete: (
    control: ItemControl<TFlags>,
    config: ItemConfig<TRegistry, TFlags> & TConfig,
    root: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) => void;
  fieldComplete: (
    control: FieldControl<TRegistry, TFlags>,
    config: FieldConfig<TRegistry, TFlags> & TConfig,
    root: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) => void;
  groupComplete: (
    control: GroupControl<{}, {}, TFlags>,
    config: GroupConfig<TConfig, TRegistry, TFlags> & FieldConfig<TRegistry, TFlags> & TConfig,
    root: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) => void;
  arrayComplete: (
    control: ArrayControl<{}, {}, TFlags>,
    config: ArrayConfig<TConfig, TRegistry, TFlags>,
    root: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) => void;
}

class DefaultVisitor<TConfig extends BaseItemConfig, TRegistry extends ExecutableRegistry, TFlags extends AbstractFlags>
  implements Visitor<TConfig, TRegistry, TFlags> {
  itemInit(config: ItemConfig<TRegistry, TFlags> & TConfig) {
    return new ItemControl<TFlags>();
  }
  fieldInit(config: FieldConfig<TRegistry, TFlags> & TConfig) {
    return new FieldControl<any, TFlags>(null);
  }
  groupInit(config: GroupConfig<TConfig, TRegistry, TFlags> & TConfig, bundled: KeyValueControls<{}, TFlags>) {
    return new GroupControl<{}, {}, TFlags>(bundled);
  }
  arrayInit(config: ArrayConfig<TConfig, TRegistry, TFlags> & TConfig, bundled: KeyValueControls<{}, TFlags>) {
    return new ArrayControl<{}, {}, TFlags>(() => new GroupControl<{}, {}, TFlags>(bundled));
  }

  itemComplete(
    control: ItemControl<TFlags>,
    config: ItemConfig<TRegistry, TFlags> & TConfig,
    _: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) {
    this.initItem(control, config, registry);
  }
  fieldComplete(
    control: FieldControl<TRegistry, TFlags>,
    config: FieldConfig<TRegistry, TFlags> & TConfig,
    _: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) {
    this.initField(control, config, registry);
  }
  groupComplete(
    control: GroupControl<{}, {}, TFlags>,
    config: GroupConfig<TConfig, TRegistry, TFlags> & FieldConfig<TRegistry, TFlags> & TConfig,
    _: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) {
    this.initField(control, config, registry);
  }
  arrayComplete(
    control: ArrayControl<{}, {}, TFlags>,
    config: ArrayConfig<TConfig, TRegistry, TFlags>,
    _: GroupControl<{}, {}, TFlags>,
    registry: TRegistry,
  ) {
    this.initField(control, config, registry);
  }

  initItem(control: ItemControl<TFlags>, config: ItemConfig<TRegistry, TFlags>, registry: TRegistry) {
    const flags = Object.entries(config.flags ?? {}).reduce((acc, [key, value]) => {
      const sources = value
        .map(def => {
          const method = getRegistryMethod<TRegistry, boolean, TFlags>(registry, "flags", def as any);
          const params = (def as any).params;
          return method ? method(config, control, params) : null;
        })
        .filter(notNullish)
        .map(s => (c: ItemControl<TFlags>) => toObservable(s(c)).pipe(map(v => [key, v] as [keyof TFlags, boolean])));
      acc.push(...sources);
      return acc;
    }, <ObservableExecutor<ItemControl<TFlags>, [keyof TFlags, boolean]>[]>[]);

    const messages = (config.messagers ?? [])
      .map(def => {
        const method = getRegistryMethod<TRegistry, Messages | null, TFlags>(registry, "messagers", def as any);
        const params = (def as any).params;
        return method ? method(config, control, params) : null;
      })
      .filter(notNullish);

    control.setFlaggers(flags);
    control.setMessagers(messages);
  }

  initField(control: FieldControl<any, TFlags>, config: FieldConfig<TRegistry, TFlags>, registry: TRegistry) {
    this.initItem(control, config, registry);

    const disablers = (config.disablers ?? [])
      .map(def => {
        const method = getRegistryMethod<TRegistry, boolean, TFlags>(registry, "flags", def as any);
        const params = (def as any).params;
        return method ? method(config, control, params) : null;
      })
      .filter(notNullish);

    const validators = (config.validators ?? [])
      .map(def => {
        const method = getRegistryMethod<TRegistry, Messages | null, TFlags>(registry, "validators", def as any);
        const params = (def as any).params;
        return method ? method(config, control, params) : null;
      })
      .filter(notNullish);

    const triggers = (config.triggers ?? [])
      .map(def => {
        const method = getRegistryMethod<TRegistry, void, TFlags>(registry, "triggers", def as any);
        const params = (def as any).params;
        return method ? method(config, control, params) : null;
      })
      .filter(notNullish);

    control.setDisablers(disablers as any);
    control.setTriggers(triggers);
    control.setValidators(validators);
  }
}

export interface ConfigBundle<
  T extends TConfig,
  TControl extends ItemControl<TFlags>,
  TConfig extends BaseItemConfig,
  TRegistry extends ExecutableRegistry = ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags
> {
  registry: TRegistry;
  control: TControl;
  config: T;
  children: ConfigBundle<TConfig, ItemControl<TFlags>, TConfig, TRegistry, TFlags>[];
}

export function bundleConfig<
  T extends TConfig & BaseGroupConfig<TConfig>,
  TConfig extends BaseItemConfig,
  TTypes extends FieldTypeMap<TConfig, TS, TN, TB, TArray, TNull>,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags = AbstractFlags,
  TS = unknown,
  TN = unknown,
  TB = unknown,
  TArray = unknown,
  TNull = unknown
>(
  config: T,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, TFlags> = new DefaultVisitor<TConfig, TRegistry, TFlags>(),
) {
  const bundle = bundleConfig2<
    GroupControl<
      // @ts-ignore
      FormValue<T["fields"], TConfig, TTypes>,
      FormControls<T["fields"], TConfig, TTypes, TFlags>,
      TFlags
    >,
    TConfig,
    TRegistry,
    TFlags
  >(config, registry, visitor);
  // @ts-ignore
  completeConfig2(bundle, registry, bundle, visitor);
  return bundle;
}

export function getRegistryMethod<
  TRegistry extends ExecutableRegistry,
  TValue = unknown,
  TFlags extends AbstractFlags = AbstractFlags
>(
  registry: TRegistry,
  kind: keyof TRegistry,
  def: ExecutableDefinition<TRegistry[typeof kind], TValue>,
): Executable<BaseItemConfig, any, ItemControl<TFlags>, TValue, TFlags> | null {
  const method = registry[kind]?.[def.name] as any;
  if (method && registry[kind]) {
    return method.bind(registry[kind]);
  }
  return null;
}

function completeConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
>(
  bundle: ConfigBundle<TConfig, ItemControl<TFlags>, TConfig, TRegistry, TFlags>,
  registry: TRegistry,
  rootBundle: ConfigBundle<TConfig, GroupControl<{}, {}, TFlags>, TConfig, TRegistry, TFlags>,
  visitor: Visitor<TConfig, TRegistry, TFlags>,
) {
  const { config, control, children } = bundle;
  children.forEach(c => completeConfig2(c, registry, rootBundle, visitor));

  if (isFieldConfig<TConfig>(config)) {
    if (isArrayConfig<TConfig>(config) && control instanceof FieldControl) {
      visitor.arrayComplete(control as any, config as any, rootBundle.control, registry);
    } else if (isGroupConfig<TConfig>(config) && control instanceof GroupControl) {
      visitor.groupComplete(control, config as any, rootBundle.control, registry);
    } else if (control instanceof FieldControl) {
      visitor.fieldComplete(control, config as any, rootBundle.control, registry);
    }
  }
  visitor.itemComplete(control, config as any, rootBundle.control, registry);
}

function bundleConfig2<
  TControl extends ItemControl<TFlags>,
  TConfig extends BaseItemConfig,
  TRegistry extends ExecutableRegistry,
  TFlags extends AbstractFlags
>(
  config: TConfig,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, TFlags>,
): ConfigBundle<TConfig, TControl, TConfig, TRegistry, TFlags> {
  if (isGroupConfig<TConfig>(config)) {
    const items = config.fields.map(f => {
      if (isFieldConfig<TConfig>(f)) {
        const bundle = bundleConfig2<ItemControl<TFlags>, TConfig, TRegistry, TFlags>(f, registry, visitor);
        return { controls: { [f.name]: bundle.control }, config: f, items: [bundle] };
      } else if (isGroupConfig<TConfig>(f)) {
        const bundle = bundleConfig2<ItemControl<TFlags>, TConfig, TRegistry, TFlags>(
          { ...f, name: "group" },
          registry,
          visitor,
        );
        return {
          controls: {
            ...(bundle.control as GroupControl<{}, {}, TFlags>).controls,
          },
          config: f,
          items: [bundle],
        };
      }
      const bundle = bundleConfig2<ItemControl<TFlags>, TConfig, TRegistry, TFlags>(f, registry, visitor);
      return { controls: {}, config: f, items: [bundle] };
    });

    const controls = items.reduce((acc, f) => ({ ...acc, ...f.controls }), {});
    const children = items.reduce((acc, f) => [...acc, ...f.items], <typeof items[0]["items"]>[]);

    if (isArrayConfig<TConfig>(config)) {
      const control = visitor.arrayInit(config as any, controls);
      return { registry, config, control: control as any, children };
    } else if (isFieldConfig<TConfig>(config)) {
      const control = visitor.groupInit(
        config as any,
        controls,
        children.map(c => c.control),
      );
      return { registry, config, control: control as any, children };
    } else {
      const control = visitor.itemInit(
        config as any,
        children.map(c => c.control),
      );
      return { registry, config, control: control as any, children };
    }
  } else if (isFieldConfig<TConfig>(config)) {
    const control = visitor.fieldInit(config as any);
    return { registry, config, control: control as any, children: [] };
  }

  const control = visitor.itemInit(config as any, []);
  return { registry, config, control: control as any, children: [] };
}
