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
import { array as AR, option as O } from "fp-ts";
import { pipe } from "fp-ts/pipeable";
import { BaseItemConfig } from "./primitives";
import { isArrayConfig, isFieldConfig, isGroupConfig, toObservable } from "./utils";
import { getRegistryValue, getRegistryValues } from "./visitor.utils";

export interface Visitor<
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  THints extends AbstractHints,
  TExtras
> {
  itemInit: (config: ItemConfig<TRegistry, THints, TExtras> & TConfig) => TItemControl;
  fieldInit: (config: FieldConfig<TRegistry, THints, TExtras> & TConfig) => TFieldControl;
  groupInit: (
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TConfig,
      TRegistry,
      THints,
      TExtras
    >[],
  ) => TGroupControl;
  arrayInit: (
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<
      TConfig,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TConfig,
      TRegistry,
      THints,
      TExtras
    >[],
  ) => TArrayControl;

  itemComplete: (
    control: TItemControl,
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  fieldComplete: (
    control: TFieldControl,
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  groupComplete: (
    control: TGroupControl,
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: TGroupControl[],
    registry: TRegistry,
  ) => void;
  arrayComplete: (
    control: TArrayControl,
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras>,
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
  bundle: Bundle<
    TConfig,
    ItemControl<THints, TExtras>,
    ItemControl<THints, TExtras>,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >,
): Bundle<TConfig, ItemControl<THints, TExtras>, ItemControl<THints, TExtras>, TConfig, TRegistry, THints, TExtras>[] {
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
>(
  children: Bundle<
    TConfig,
    ItemControl<THints, TExtras>,
    ItemControl<THints, TExtras>,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >[],
) {
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
      ItemControl<THints, TExtras>,
      FieldControl<any, THints, TExtras>,
      GroupControl<{}, {}, THints, TExtras>,
      ArrayControl<{}, {}, THints, TExtras>,
      TConfig,
      TRegistry,
      THints,
      TExtras
    > {
  itemInit(_: ItemConfig<TRegistry, THints, TExtras> & TConfig) {
    return new ItemControl<THints, TExtras>();
  }
  fieldInit(_: FieldConfig<TRegistry, THints, TExtras> & TConfig) {
    return new FieldControl<any, THints, TExtras>(null);
  }
  groupInit(
    _: GroupConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<
      TConfig,
      ItemControl<THints, TExtras>,
      ItemControl<THints, TExtras>,
      TConfig,
      TRegistry,
      THints,
      TExtras
    >[],
  ) {
    const controls = childrenToFields(children);
    return new GroupControl<{}, {}, THints, TExtras>(controls);
  }
  arrayInit(
    _: ArrayConfig<TConfig, TRegistry, THints, TExtras> & TConfig,
    children: Bundle<
      TConfig,
      ItemControl<THints, TExtras>,
      ItemControl<THints, TExtras>,
      TConfig,
      TRegistry,
      THints,
      TExtras
    >[],
  ) {
    const controls = childrenToFields(children);
    return new ArrayControl<{}, {}, THints, TExtras>(() => new GroupControl<{}, {}, THints, TExtras>(controls));
  }

  itemComplete(
    control: ItemControl<THints, TExtras>,
    config: ItemConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, {}, THints, TExtras>[],
    registry: TRegistry,
  ) {
    this.initItem(control, parents, config, registry);
  }
  fieldComplete(
    control: FieldControl<TRegistry, THints, TExtras>,
    config: FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, {}, THints, TExtras>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }
  groupComplete(
    control: GroupControl<{}, {}, THints, TExtras>,
    config: GroupConfig<TConfig, TRegistry, THints, TExtras> & FieldConfig<TRegistry, THints, TExtras> & TConfig,
    parents: GroupControl<{}, {}, THints, TExtras>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }
  arrayComplete(
    control: ArrayControl<{}, {}, THints, TExtras>,
    config: ArrayConfig<TConfig, TRegistry, THints, TExtras>,
    parents: GroupControl<{}, {}, THints, TExtras>[],
    registry: TRegistry,
  ) {
    this.initField(control, parents, config, registry);
  }

  private initItem(
    control: ItemControl<THints, TExtras>,
    parents: GroupControl<{}, {}, THints, TExtras>[],
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

    const parent = pipe(AR.last(parents), O.toNullable);
    if (!control.parent && parent) {
      control.setParent(parent);
    }
  }

  private initField(
    control: FieldControl<any, THints, TExtras>,
    parents: GroupControl<{}, {}, THints, TExtras>[],
    config: FieldConfig<TRegistry, THints, TExtras>,
    registry: TRegistry,
  ) {
    this.initItem(control, parents, config, registry);

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

export interface Bundle<
  T extends TConfig,
  TControl,
  TAllControls,
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry = FuzzyExecutableRegistry,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras
> {
  config: T;
  control: TControl;
  registry: TRegistry;
  children: Bundle<TConfig, TAllControls, TAllControls, TConfig, TRegistry, THints, TExtras>[];
}

export function createConfigBundler<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl,
  THints extends AbstractHints = AbstractHints,
  TExtras = AbstractExtras,
  TVisitor extends Visitor<
    TItemControl,
    TFieldControl,
    TGroupControl,
    TArrayControl,
    TConfig,
    TRegistry,
    THints,
    TExtras
  > = Visitor<TItemControl, TFieldControl, TGroupControl, TArrayControl, TConfig, TRegistry, THints, TExtras>
>(registry: TRegistry, visitor: TVisitor) {
  return <TRootControl extends TItemControl | TFieldControl | TGroupControl | TArrayControl>(
    config: TConfig,
    overrideRegistry?: TRegistry,
  ) => {
    const bundle = bundleConfig2<
      TConfig,
      TRegistry,
      TItemControl,
      TFieldControl,
      TGroupControl,
      TArrayControl,
      THints,
      TExtras,
      TVisitor
    >(config, overrideRegistry ?? registry, visitor);
    completeConfig2(bundle, [], overrideRegistry ?? registry, visitor as any);
    return bundle as Bundle<
      TConfig,
      TRootControl,
      TItemControl | TFieldControl | TGroupControl | TArrayControl,
      TConfig,
      TRegistry,
      THints,
      TExtras
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
  THints extends AbstractHints,
  TExtras,
  TVisitor extends Visitor<
    TItemControl,
    TFieldControl,
    TGroupControl,
    TArrayControl,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >
>(
  bundle: Bundle<
    TConfig,
    TItemControl | TFieldControl | TGroupControl | TArrayControl,
    TItemControl | TFieldControl | TGroupControl | TArrayControl,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >,
  parents: TGroupControl[],
  registry: TRegistry,
  visitor: TVisitor,
) {
  const { config, control, children } = bundle;
  children.forEach(c => completeConfig2(c, [], registry, visitor as any));

  if (isFieldConfig<TConfig>(config)) {
    if (isArrayConfig<TConfig>(config)) {
      visitor.arrayComplete(control as any, config as any, parents, registry);
    } else if (isGroupConfig<TConfig>(config)) {
      visitor.groupComplete(control as any, config as any, parents, registry);
    } else {
      visitor.fieldComplete(control as any, config as any, parents, registry);
    }
  }
  visitor.itemComplete(control as any, config as any, parents, registry);
}

function bundleConfig2<
  TConfig extends BaseItemConfig,
  TRegistry extends FuzzyExecutableRegistry,
  TItemControl,
  TFieldControl,
  TGroupControl,
  TArrayControl,
  THints extends AbstractHints,
  TExtras,
  TVisitor extends Visitor<
    TItemControl,
    TFieldControl,
    TGroupControl,
    TArrayControl,
    TConfig,
    TRegistry,
    THints,
    TExtras
  >
>(
  config: TConfig,
  registry: TRegistry,
  visitor: TVisitor,
): Bundle<
  TConfig,
  TItemControl | TFieldControl | TGroupControl | TArrayControl,
  TItemControl | TFieldControl | TGroupControl | TArrayControl,
  TConfig,
  TRegistry,
  THints,
  TExtras
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
          THints,
          TExtras,
          TVisitor
        >({ ...f, name: "group" }, registry, visitor);
        return { ...group, config: f };
      }
      return bundleConfig2<
        TConfig,
        TRegistry,
        TItemControl,
        TFieldControl,
        TGroupControl,
        TArrayControl,
        THints,
        TExtras,
        TVisitor
      >(f, registry, visitor);
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
