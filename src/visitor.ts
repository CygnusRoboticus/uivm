import { tuple } from "fp-ts/lib/function";
import { combineLatest } from "rxjs";
import { map } from "rxjs/operators";
import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import {
  AbstractExtras,
  AbstractHints,
  Disabler,
  Executor,
  Hinter,
  KeyValueControls,
  Trigger,
  Validator,
} from "./controls.types";
import { FuzzyExecutableRegistry } from "./executable";
import { BaseItemConfig } from "./primitives";
import { isArrayConfig, isFieldConfig, isGroupConfig, toObservable } from "./utils";
import { getRegistryValue, getRegistryValues } from "./visitor.utils";

export interface Visitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints,
  TExtras
> {
  itemInit: (
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    children: ItemControl<THints, TExtras>[],
  ) => ItemControl<THints, TExtras>;
  fieldInit: (
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    value?: any,
  ) => FieldControl<{}, THints, TExtras>;
  groupInit: (
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    bundled: KeyValueControls<{}, THints, TExtras>,
    children: ItemControl<THints, TExtras>[],
  ) => GroupControl<{}, {}, THints, TExtras>;
  arrayInit: (
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    bundled: KeyValueControls<{}, THints, TExtras>,
    value?: any,
  ) => ArrayControl<{}, {}, THints, TExtras>;

  itemComplete: (
    control: ItemControl<THints, TExtras>,
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) => void;
  fieldComplete: (
    control: FieldControl<TRegistry, THints, TExtras>,
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) => void;
  groupComplete: (
    control: GroupControl<{}, {}, THints, TExtras>,
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) => void;
  arrayComplete: (
    control: ArrayControl<{}, {}, THints, TExtras>,
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras>,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) => void;
}

export class DefaultVisitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints,
  TExtras
> implements Visitor<TConfig, TRegistry, THints, TExtras> {
  itemInit(config: ItemConfig<TRegistry, THints, TExtras> & TConfig) {
    return new ItemControl<THints, TExtras>();
  }
  fieldInit(config: FieldConfig<TRegistry, THints, TExtras> & TConfig, value?: any) {
    return new FieldControl<any, THints, TExtras>(value ?? null);
  }
  groupInit(
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    bundled: KeyValueControls<{}, THints, TExtras>,
  ) {
    return new GroupControl<{}, {}, THints, TExtras>(bundled);
  }
  arrayInit(
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    bundled: KeyValueControls<{}, THints, TExtras>,
    value?: any[],
  ) {
    return new ArrayControl<{}, {}, THints, TExtras>(
      () => new GroupControl<{}, {}, THints, TExtras>(bundled),
      value ?? [],
    );
  }

  itemComplete(
    control: ItemControl<THints, TExtras>,
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initItem(control, parent, config, registry);
  }
  fieldComplete(
    control: FieldControl<TRegistry, THints, TExtras>,
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }
  groupComplete(
    control: GroupControl<{}, {}, THints, TExtras>,
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }
  arrayComplete(
    control: ArrayControl<{}, {}, THints, TExtras>,
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras>,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    root: GroupControl<{}, {}, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initField(control, parent, config, registry);
  }

  initItem(
    control: ItemControl<THints, TExtras>,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    config: ItemConfig<TRegistry, THints, TExtras>,
    registry: TRegistry,
  ) {
    const hints = Object.entries(config.hints ?? {}).reduce((acc, [key, value]) => {
      const sources = getRegistryValues<
        typeof registry,
        typeof config,
        typeof control,
        Executor<typeof control, boolean>,
        THints,
        TExtras
      >(registry, "hints", config, control, value as any).map(s => (c: ItemControl<THints, TExtras>) =>
        toObservable(s(c)).pipe(map(v => tuple(key, v))),
      );
      acc.push(...sources);
      return acc;
    }, <Hinter<ItemControl<THints, TExtras>, THints>[]>[]);

    const extrasSource = Object.entries(config.extras ?? {}).reduce((acc, [key, value]) => {
      const source = getRegistryValue<
        typeof registry,
        typeof config,
        typeof control,
        Executor<ItemControl<THints, TExtras>, TExtras[keyof TExtras]>,
        THints,
        TExtras
      >(registry, "extras", config, control, value as any);
      if (source) {
        acc.push([key as keyof TExtras, source]);
      }
      return acc;
    }, <[keyof TExtras, Executor<ItemControl<THints, TExtras>, TExtras[keyof TExtras]>][]>[]);
    const extras = (c: ItemControl<THints, TExtras>) => {
      return combineLatest(extrasSource.map(([k, s]) => toObservable(s(c)).pipe(map(v => tuple(k, v))))).pipe(
        map(values =>
          values.reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
          }, <Partial<TExtras>>{}),
        ),
      );
    };

    const messages = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Validator<typeof control>,
      THints,
      TExtras
    >(registry, "validators", config, control, (config.messagers ?? []) as any);

    control.setHinters(hints);
    control.setExtraers(extras);
    control.setMessagers(messages);

    if (!control.parent && parent) {
      control.setParent(parent);
    }
  }

  initField(
    control: FieldControl<any, THints, TExtras>,
    parent: GroupControl<{}, {}, THints, TExtras> | null,
    config: FieldConfig<TRegistry, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initItem(control, parent, config, registry);

    const disablers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Disabler<typeof control>,
      THints,
      TExtras
    >(registry, "hints", config, control, config.disablers ?? ([] as any));

    const validators = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Validator<typeof control>,
      THints,
      TExtras
    >(registry, "validators", config, control, config.validators ?? ([] as any));

    const triggers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      Trigger<typeof control>,
      THints,
      TExtras
    >(registry, "triggers", config, control, config.triggers ?? ([] as any));

    control.setDisablers(disablers);
    control.setTriggers(triggers);
    control.setValidators(validators);
  }
}

export interface ConfigBundle<
  T extends TConfig,
  TControl extends ItemControl<THints, TExtras>,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> {
  id: string;
  registry: TRegistry;
  control: TControl;
  config: T;
  children: ConfigBundle<TConfig, ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>[];
}

export function bundleConfig<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TValue = any,
  TControls = any
>(
  config: TConfig,
  registry: TRegistry,
  value?: TValue,
  visitor: Visitor<TConfig, TRegistry, THints, TExtras> = new DefaultVisitor<TConfig, TRegistry, THints, TExtras>(),
) {
  const bundle = bundleConfig2<
    GroupControl<
      // @ts-ignore
      TValue,
      TControls,
      THints,
      TExtras
    >,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >(config.type, config, value, registry, visitor);
  completeConfig2(bundle, null, bundle, registry, visitor);
  return bundle;
}

function completeConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints,
  TExtras
>(
  bundle: ConfigBundle<TConfig, ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>,
  parentBundle: ConfigBundle<
    TConfig,
    GroupControl<any, any, THints, TExtras>,
    TConfig,
    TRegistry,
    THints,
    TExtras
  > | null,
  rootBundle: ConfigBundle<TConfig, GroupControl<any, any, THints, TExtras>, TConfig, TRegistry, THints, TExtras>,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, THints, TExtras>,
) {
  const { config, control, children } = bundle;
  children.forEach(c =>
    completeConfig2(
      c,
      bundle as ConfigBundle<TConfig, GroupControl<any, any, THints, TExtras>, TConfig, TRegistry, THints, TExtras>,
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
  TControl extends ItemControl<THints, TExtras>,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints,
  TExtras
>(
  id: string,
  config: TConfig,
  value: any | undefined,
  registry: TRegistry,
  visitor: Visitor<TConfig, TRegistry, THints, TExtras>,
): ConfigBundle<TConfig, TControl, TConfig, TRegistry, THints, TExtras> {
  if (isGroupConfig<TConfig>(config)) {
    const items = config.fields.map((f, i) => {
      if (isFieldConfig<TConfig>(f)) {
        const fieldBundle = bundleConfig2<ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>(
          `${id}-${f.name}`,
          f,
          value?.[f.name],
          registry,
          visitor,
        );
        return { controls: { [f.name]: fieldBundle.control }, config: f, items: [fieldBundle] };
      } else if (isGroupConfig<TConfig>(f)) {
        const groupBundle = bundleConfig2<ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>(
          `${id}-${i}`,
          { ...f, name: "group" },
          value,
          registry,
          visitor,
        );
        return {
          controls: {
            ...(groupBundle.control as GroupControl<{}, {}, THints, TExtras>).controls,
          },
          config: f,
          items: [groupBundle],
        };
      }
      const bundle = bundleConfig2<ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>(
        `${id}-${i}`,
        f,
        value,
        registry,
        visitor,
      );
      return { controls: {}, config: f, items: [bundle] };
    });

    const controls = items.reduce((acc, f) => ({ ...acc, ...f.controls }), {});
    const children = items.reduce((acc, f) => [...acc, ...f.items], <typeof items[0]["items"]>[]);

    if (isArrayConfig<TConfig>(config)) {
      const arrayControl = visitor.arrayInit(config as any, controls, value);
      return {
        id: `${id}-${config.name}`,
        registry,
        config,
        control: arrayControl as any,
        children,
      };
    } else if (isFieldConfig<TConfig>(config)) {
      const fieldControl = visitor.groupInit(
        config as any,
        controls,
        children.map(c => c.control),
      );
      return {
        id: `${id}-${config.name}`,
        registry,
        config,
        control: fieldControl as any,
        children,
      };
    } else {
      const itemControl = visitor.itemInit(
        config as any,
        children.map(c => c.control),
      );
      return {
        id: `${id}-${config.type}`,
        registry,
        config,
        control: itemControl as any,
        children,
      };
    }
  } else if (isFieldConfig<TConfig>(config)) {
    const fieldControl = visitor.fieldInit(config as any, value);
    return {
      id: `${id}-${config.name}`,
      registry,
      config,
      control: fieldControl as any,
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
