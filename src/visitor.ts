import { array as AR, option as O } from "fp-ts";
import { tuple } from "fp-ts/lib/function";
import { pipe } from "fp-ts/pipeable";
import { combineLatest } from "rxjs";
import { map } from "rxjs/operators";
import { ArrayConfig, FieldConfig, GroupConfig, ItemConfig } from "./configs";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "./controls";
import { AbstractExtras, AbstractHints, Disabler, Executor, Hinter, Trigger, Validator } from "./controls.types";
import { FuzzyExecutableRegistry } from "./executable";
import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { isArrayConfig, isFieldConfig, isGroupConfig, toObservable } from "./utils";
import { getRegistryValue, getRegistryValues } from "./visitor.utils";

export interface Visitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl
> {
  itemInit: (config: BaseItemConfig & TConfig) => TItemControl;
  fieldInit: (config: BaseFieldConfig & TConfig) => TFieldControl;
  groupInit: (
    config: BaseGroupConfig<TConfig> & BaseFieldConfig & TConfig,
    children: Bundle<
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TRegistry
    >[],
  ) => TGroupControl;
  arrayInit: (
    config: BaseArrayConfig<TConfig> & TConfig,
    children: Bundle<
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TRegistry
    >[],
  ) => TArrayControl;

  itemComplete: (
    control: TItemControl,
    config: BaseItemConfig & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  fieldComplete: (
    control: TFieldControl,
    config: BaseFieldConfig & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  groupComplete: (
    control: TGroupControl,
    config: BaseGroupConfig<TConfig> & BaseFieldConfig & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  arrayComplete: (
    control: TArrayControl,
    config: BaseArrayConfig<TConfig> & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
}

function collectChildren<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(
  bundle: Bundle<TConfig, ItemControl<THints, TExtras>, TConfig, ItemControl<THints, TExtras>, TRegistry>,
): Bundle<TConfig, ItemControl<THints, TExtras>, TConfig, ItemControl<THints, TExtras>, TRegistry>[] {
  if (isGroupConfig<TConfig>(bundle.config) && !isFieldConfig<TConfig>(bundle.config)) {
    return AR.flatten(bundle.children.map(collectChildren));
  }
  return [bundle];
}

function childrenToFields<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
>(children: Bundle<TConfig, ItemControl<THints, TExtras>, TConfig, ItemControl<THints, TExtras>, TRegistry>[]) {
  return pipe(
    children,
    AR.map(collectChildren),
    AR.flatten,
    AR.reduce({} as Record<string, typeof children[number]["control"]>, (acc, child) =>
      isFieldConfig<TConfig>(child.config) ? ((acc[child.config.name] = child.control), acc) : acc,
    ),
  );
}

export class ControlVisitor<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> implements
    Visitor<
      TConfig,
      TRegistry,
      ItemControl<THints, TExtras>,
      FieldControl<unknown, THints, TExtras>,
      GroupControl<{}, THints, TExtras, {}>,
      ArrayControl<{}, THints, TExtras, {}>
    > {
  itemInit(_: ItemConfig<TRegistry, THints, TExtras> & TConfig) {
    return new ItemControl<THints, TExtras>();
  }
  fieldInit(_: FieldConfig<TRegistry, THints, TExtras> & TConfig) {
    return new FieldControl<unknown, THints, TExtras>(null);
  }
  groupInit(
    _: GroupConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<TConfig, ItemControl<THints, TExtras>, TConfig, ItemControl<THints, TExtras>, TRegistry>[],
  ) {
    const controls = childrenToFields(children);
    return new GroupControl<{}, THints, TExtras, {}>(controls);
  }
  arrayInit(
    _: ArrayConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<TConfig, ItemControl<THints, TExtras>, TConfig, ItemControl<THints, TExtras>, TRegistry>[],
  ) {
    const controls = childrenToFields(children);
    return new ArrayControl<{}, THints, TExtras, {}>(() => new GroupControl<{}, THints, TExtras, {}>(controls));
  }

  itemComplete(
    control: ItemControl<THints, TExtras>,
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    registry: TRegistry,
  ) {
    this.initItem(control, parents, config, registry);
  }
  fieldComplete(
    control: FieldControl<unknown, THints, TExtras>,
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }
  groupComplete(
    control: GroupControl<{}, THints, TExtras, {}>,
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }
  arrayComplete(
    control: ArrayControl<{}, THints, TExtras, {}>,
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras>,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }

  private initItem(
    control: ItemControl<THints, TExtras>,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    config: ItemConfig<TRegistry, THints, TExtras>,
    registry: TRegistry,
  ) {
    const hints = Object.entries(config.hints ?? {}).reduce((acc, [key, value]) => {
      const sources = getRegistryValues<
        typeof registry,
        typeof config,
        typeof control,
        Executor<typeof control, boolean>
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
        Executor<ItemControl<THints, TExtras>, TExtras[keyof TExtras]>
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

    const messages = getRegistryValues<typeof registry, typeof config, typeof control, Validator<typeof control>>(
      registry,
      "validators",
      config,
      control,
      (config.messagers ?? []) as any,
    );

    control.setHinters(hints);
    control.setExtraers(extras);
    control.setMessagers(messages);

    const parent = pipe(AR.last(parents), O.toNullable);
    if (!control.parent && parent) {
      control.setParent(parent);
    }
  }

  private initField(
    control: FieldControl<any, THints, TExtras>,
    parents: GroupControl<{}, THints, TExtras, {}>[],
    config: FieldConfig<TRegistry, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initItem(control, parents, config, registry);

    const disablers = getRegistryValues<typeof registry, typeof config, typeof control, Disabler<typeof control>>(
      registry,
      "hints",
      config,
      control,
      config.disablers ?? ([] as any),
    );

    const validators = getRegistryValues<typeof registry, typeof config, typeof control, Validator<typeof control>>(
      registry,
      "validators",
      config,
      control,
      config.validators ?? ([] as any),
    );

    const triggers = getRegistryValues<typeof registry, typeof config, typeof control, Trigger<typeof control>>(
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

export interface Bundle<
  TConfig extends TAllConfigs,
  TControl,
  TAllConfigs extends BaseItemConfig,
  TAllControls,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry
> {
  config: TConfig;
  control: TControl;
  registry: TRegistry;
  children: Bundle<TAllConfigs, TAllControls, TAllConfigs, TAllControls, TRegistry>[];
}

export function createConfigBundler<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TVisitor extends Visitor<TConfig, TRegistry, TItemControl, TFieldControl, TGroupControl, TArrayControl>,
  TItemControl = any,
  TFieldControl = any,
  TGroupControl = any,
  TArrayControl = any
>(registry: TRegistry, visitor: TVisitor) {
  return <
    TRootControl extends ReturnType<
      TVisitor["itemInit"] | TVisitor["fieldInit"] | TVisitor["groupInit"] | TVisitor["arrayInit"]
    >
  >(
    config: TConfig,
    overrideRegistry?: TRegistry,
  ) => {
    const bundle = bundleConfig2<
      TConfig,
      TRegistry,
      ReturnType<TVisitor["itemInit"]>,
      ReturnType<TVisitor["fieldInit"]>,
      ReturnType<TVisitor["groupInit"]>,
      ReturnType<TVisitor["arrayInit"]>,
      any
    >(config, overrideRegistry ?? registry, visitor);
    completeConfig2(bundle, [], overrideRegistry ?? registry, visitor as any);
    return bundle as Bundle<
      TConfig,
      TRootControl,
      TConfig,
      ReturnType<TVisitor["itemInit"] | TVisitor["fieldInit"] | TVisitor["groupInit"] | TVisitor["arrayInit"]>,
      TRegistry
    >;
  };
}

function completeConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl,
  TVisitor extends Visitor<TConfig, TRegistry, TItemControl, TFieldControl, TGroupControl, TArrayControl>
>(
  bundle: Bundle<
    TConfig,
    TItemControl | TFieldControl | TGroupControl | TArrayControl,
    TConfig,
    TItemControl | TFieldControl | TGroupControl | TArrayControl,
    TRegistry
  >,
  parents: TGroupControl[],
  registry: TRegistry,
  visitor: TVisitor,
) {
  const { config, control, children } = bundle;
  children.forEach(c => completeConfig2(c, [], registry, visitor));

  if (isFieldConfig<TConfig>(config)) {
    if (isArrayConfig<TConfig>(config)) {
      visitor.arrayComplete(control as any, config, parents, registry);
    } else if (isGroupConfig<TConfig>(config)) {
      visitor.groupComplete(control as any, config, parents, registry);
    } else {
      visitor.fieldComplete(control as any, config, parents, registry);
    }
  }
  visitor.itemComplete(control as any, config, parents, registry);
}

function bundleConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl,
  TVisitor extends Visitor<TConfig, TRegistry, TItemControl, TFieldControl, TGroupControl, TArrayControl>
>(
  config: TConfig,
  registry: TRegistry,
  visitor: TVisitor,
): Bundle<
  TConfig,
  TItemControl | TFieldControl | TGroupControl | TArrayControl,
  TConfig,
  TItemControl | TFieldControl | TGroupControl | TArrayControl,
  TRegistry
> {
  if (isGroupConfig<TConfig>(config)) {
    const children = config.fields.map(f => {
      if (isGroupConfig<TConfig>(f) && !isFieldConfig<TConfig>(f)) {
        const group = bundleConfig2<
          TConfig,
          TRegistry,
          TItemControl,
          TFieldControl,
          TGroupControl,
          TArrayControl,
          TVisitor
        >({ ...f, name: "group" }, registry, visitor);
        return { ...group, config: f };
      }
      return bundleConfig2<TConfig, TRegistry, TItemControl, TFieldControl, TGroupControl, TArrayControl, TVisitor>(
        f,
        registry,
        visitor,
      );
    });

    if (isArrayConfig<TConfig>(config)) {
      return { config, control: visitor.arrayInit(config, children), registry, children };
    } else if (isFieldConfig<TConfig>(config)) {
      return { config, control: visitor.groupInit(config, children), registry, children };
    }
    return { config, control: visitor.itemInit(config), registry, children };
  } else if (isFieldConfig<TConfig>(config)) {
    return { config, control: visitor.fieldInit(config), registry, children: [] };
  }

  return { config, control: visitor.itemInit(config), registry, children: [] };
}
